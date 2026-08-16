import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders } from "../_shared/cors.ts";
import { notifyEvent } from "../_shared/sms.ts";
import { creditDeposit } from "../_shared/yengapay.ts";

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i];
  return r === 0;
}
async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function mapPayStatus(raw: string): "success" | "failed" | "pending" {
  const s = String(raw || "").toLowerCase();
  if (["success", "completed", "paid", "done", "succeeded"].includes(s)) return "success";
  if (["failed", "cancelled", "canceled", "expired", "rejected"].includes(s)) return "failed";
  return "pending";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  const secrets = [
    Deno.env.get("YENGAPAY_WEBHOOK_SECRET"),
    Deno.env.get("YENGAPAY_PAYPAL_WEBHOOK_SECRET"),
    Deno.env.get("YENGAPAY_MERCHANT_WEBHOOK_SECRET"), // Nouveau secret marchand 9dea2ad9...
  ].filter(Boolean) as string[];
  if (secrets.length === 0) return new Response("Missing webhook secret", { status: 500, headers: corsHeaders });
  const raw = await req.text();
  const sig = req.headers.get("x-yengapay-signature") || req.headers.get("x-signature") || "";
  let signatureOk = false;
  for (const s of secrets) {
    const expected = await hmacHex(s, raw);
    if (timingSafeEqual(new TextEncoder().encode(sig), new TextEncoder().encode(expected))) { signatureOk = true; break; }
  }
  if (!signatureOk) return new Response("Invalid signature", { status: 401, headers: corsHeaders });
  let payload: any;
  try { payload = JSON.parse(raw); } catch { return new Response("Bad JSON", { status: 400, headers: corsHeaders }); }
  const reference: string | undefined = payload?.reference || payload?.data?.reference;
  const rawStatus: string | undefined = (payload?.status || payload?.data?.status || "").toLowerCase();
  const providerId: string | undefined = payload?.id || payload?.data?.id || payload?.paymentIntentId;
  if (!reference) return new Response("Missing reference", { status: 400, headers: corsHeaders });
  const status = mapPayStatus(rawStatus || "");

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  // ============ 1) Business payment link payment ============
  const { data: lp } = await admin.from("payment_link_payments")
    .select("id,business_id,amount,status,metadata,link_id").eq("reference", reference).maybeSingle();
  if (lp) {
    if (lp.status !== "pending") return new Response("ok", { headers: corsHeaders });
    if (status === "success") {
      const { data: biz } = await admin.from("businesses").select("id,balance,fee_bps").eq("id", lp.business_id).single();
      const fee = Math.round((Number(lp.amount) * Number(biz.fee_bps || 0)) / 10000);
      const net = Number(lp.amount) - fee;
      const { data: updated } = await admin.from("payment_link_payments").update({
        status: "success", fee_amount: fee, net_amount: net,
        paid_at: new Date().toISOString(),
        metadata: { ...((lp.metadata as any) || {}), webhook: payload },
      }).eq("id", lp.id).eq("status", "pending").select("id").maybeSingle();
      if (updated) {
        await admin.from("businesses").update({ balance: Number(biz.balance) + net }).eq("id", biz.id);
        // Fire-and-forget merchant callback
        const { data: link } = await admin.from("payment_links").select("callback_url").eq("id", lp.link_id).maybeSingle();
        if (link?.callback_url) {
          fetch(link.callback_url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ event: "payment.success", reference, amount: lp.amount, net, fee }),
          }).catch(() => {});
        }
      }
    } else if (status === "failed") {
      await admin.from("payment_link_payments").update({
        status: "failed", metadata: { ...((lp.metadata as any) || {}), webhook: payload },
      }).eq("id", lp.id).eq("status", "pending");
    }
    return new Response("ok", { headers: corsHeaders });
  }

  // ============ 2) Wallet recharge (transactions.provider_ref = FIP-xxx) ============
  const { data: tx } = await admin.from("transactions").select("id,user_id,amount,status,type").eq("provider_ref", reference).maybeSingle();
  if (tx) {
    if (tx.status === "success") return new Response("ok", { headers: corsHeaders });
    if (status === "success" && tx.type === "deposit") {
      const { credited } = await creditDeposit(admin, tx.user_id, reference, Number(tx.amount), { webhook: payload });
      if (credited) {
        const { data: w } = await admin.from("wallets").select("balance").eq("user_id", tx.user_id).eq("currency", "XOF").maybeSingle();
        // Notif SMS (non bloquant)
        notifyEvent(admin, "wallet_recharge", {
          userId: tx.user_id as string,
          amount: Number(tx.amount),
          currency: "XOF",
          balance: w ? Number(w.balance) : undefined,
        }).catch(() => {});
      }
    } else if (status === "failed") {
      await admin.from("transactions").update({ status: "failed", metadata: payload }).eq("id", tx.id);
    }
    return new Response("ok", { headers: corsHeaders });
  }

  // ============ 2bis) MoMo inter-network transfer (payment_reference MTR-xxx) ============
  const { data: mtr } = await admin.from("momo_transfers").select("*").eq("payment_reference", reference).maybeSingle();
  if (mtr) {
    if (status === "success" && mtr.status === "awaiting_payment") {
      await admin.from("momo_transfers").update({
        status: "paid", paid_at: new Date().toISOString(),
        metadata: { ...(mtr.metadata || {}), webhook: payload },
      }).eq("id", mtr.id).eq("status", "awaiting_payment");
      // Payout automatique vers le numéro du bénéficiaire (projet PAYOUT dédié)
      try {
        const apiKey = Deno.env.get("YENGAPAY_TRANSFER_CASHOUT_API_KEY") || Deno.env.get("YENGAPAY_TRANSFER_API_KEY");
        const groupId = Deno.env.get("YENGAPAY_TRANSFER_GROUP_ID");
        const projectId = Deno.env.get("YENGAPAY_TRANSFER_PROJECT_ID");
        const mapOp = (op: string) => {
          const o = String(op || "").toLowerCase();
          if (o.includes("orange")) return "ORANGE_MONEY";
          if (o.includes("moov")) return "MOOV_MONEY";
          if (o.includes("telecel")) return "TELECEL_MONEY";
          if (o.includes("sank")) return "SANK_MONEY";
          if (o.includes("wave")) return "WAVE_MONEY";
          return "ORANGE_MONEY";
        };
        if (!apiKey || !groupId || !projectId) {
          await admin.from("momo_transfers").update({ status: "paid", admin_note: "Projet PAYOUT non configuré — payout manuel requis" }).eq("id", mtr.id);
        } else {
          await admin.from("momo_transfers").update({ status: "disbursing" }).eq("id", mtr.id);
          const paymentMethod = mapOp(mtr.dest_operator);
          const holder = String(mtr.dest_holder || "Bénéficiaire").slice(0, 120);
          const r = await fetch(`https://api.yengapay.com/api/v1/groups/${groupId}/project/${projectId}/payout`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": apiKey },
            body: JSON.stringify({
              amount: Number(mtr.amount_send),
              destNumber: mtr.dest_phone,
              destName: holder,
              paymentMethod,
              description: `Retrait vers ${holder}`.slice(0, 140),
            }),
          });
          const txt = await r.text(); let body: any = txt; try { body = JSON.parse(txt); } catch { /**/ }
          if (r.ok) {
            const prov = String(body?.status || "PENDING").toUpperCase();
            const delivered = ["SUCCESS", "COMPLETED", "PAID", "SUCCESSFUL", "DONE"].includes(prov);
            await admin.from("momo_transfers").update({
              status: delivered ? "delivered" : "disbursing",
              delivered_at: delivered ? new Date().toISOString() : null,
              cashout_ref: body?.id || body?.transactionId || paymentMethod,
              cashout_response: body,
            }).eq("id", mtr.id);
          } else {
            await admin.from("momo_transfers").update({ status: "failed", admin_note: "Cashout refusé", cashout_response: body }).eq("id", mtr.id);
          }
        }
      } catch (e) {
        await admin.from("momo_transfers").update({ admin_note: `Cashout error: ${(e as Error).message}` }).eq("id", mtr.id);
      }
    } else if (status === "failed" && mtr.status === "awaiting_payment") {
      await admin.from("momo_transfers").update({
        status: "failed", admin_note: "Paiement échoué",
        metadata: { ...(mtr.metadata || {}), webhook: payload },
      }).eq("id", mtr.id);
    }
    return new Response("ok", { headers: corsHeaders });
  }

  // ============ 3) Withdrawal cashout (search by yengapay id in destination) ============
  if (providerId) {
    const { data: wd } = await admin.from("withdrawals")
      .select("id,user_id,amount,currency,status,destination")
      .filter("destination->yengapay->>id", "eq", String(providerId))
      .maybeSingle();
    if (wd) {
      if (wd.status === "paid" || wd.status === "failed") return new Response("ok", { headers: corsHeaders });
      if (status === "success") {
        await admin.from("withdrawals").update({
          status: "paid",
          destination: { ...(wd.destination as any), webhook: payload },
        }).eq("id", wd.id);
        // Update associated transaction
        await admin.from("transactions").update({ status: "success", metadata: payload })
          .eq("provider_ref", String(providerId)).eq("type", "withdrawal");
        notifyEvent(admin, "withdrawal_paid", {
          userId: wd.user_id as string,
          amount: Number(wd.amount),
          currency: wd.currency,
        }).catch(() => {});
      } else if (status === "failed") {
        await admin.from("withdrawals").update({
          status: "failed",
          destination: { ...(wd.destination as any), webhook: payload },
        }).eq("id", wd.id);
        await admin.from("transactions").update({ status: "failed", metadata: payload })
          .eq("provider_ref", String(providerId)).eq("type", "withdrawal");
        // Refund wallet
        const { data: w } = await admin.from("wallets").select("id,balance").eq("user_id", wd.user_id).eq("currency", wd.currency).maybeSingle();
        if (w) {
          await admin.from("wallets").update({ balance: Number(w.balance) + Number(wd.amount) }).eq("id", w.id);
          await admin.from("transactions").insert({
            user_id: wd.user_id, type: "withdrawal_refund", status: "success",
            amount: wd.amount, currency: wd.currency,
            description: "Remboursement automatique — retrait échoué (webhook)",
          });
        }
      }
      return new Response("ok", { headers: corsHeaders });
    }
  }

  return new Response("Reference not matched", { status: 404, headers: corsHeaders });
});