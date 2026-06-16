// Cron-invoked reconciliation: polls YengaPay for withdrawals stuck in
// "processing" status, settles them, and refunds the wallet on failure.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const YENGAPAY_API_KEY = Deno.env.get("YENGAPAY_API_KEY");
const YENGAPAY_GROUP_ID = Deno.env.get("YENGAPAY_GROUP_ID");

function db() { return createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } }); }

async function lookupCashout(piid: string) {
  if (!YENGAPAY_API_KEY || !YENGAPAY_GROUP_ID || !piid) return null;
  const urls = [
    `https://api.yengapay.com/api/v1/groups/${YENGAPAY_GROUP_ID}/cash-out/${piid}`,
    `https://api.yengapay.com/api/v1/groups/${YENGAPAY_GROUP_ID}/payment-intent/${piid}`,
  ];
  for (const u of urls) {
    try {
      const r = await fetch(u, { headers: { "x-api-key": YENGAPAY_API_KEY } });
      const t = await r.text(); let b: any = t; try { b = JSON.parse(t); } catch { /**/ }
      if (r.ok) return b;
    } catch { /**/ }
  }
  return null;
}

function mapStatus(raw: string): "success" | "failed" | "pending" {
  const s = String(raw || "").toUpperCase();
  if (["SUCCESS", "COMPLETED", "PAID", "DONE", "SUCCESSFUL"].includes(s)) return "success";
  if (["FAILED", "CANCELLED", "CANCELED", "EXPIRED", "REJECTED"].includes(s)) return "failed";
  return "pending";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  const admin = db();
  // Pick withdrawals processing > 2 min, max 25 at a time
  const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data: rows } = await admin.from("withdrawals")
    .select("id,user_id,amount,currency,status,destination,created_at")
    .eq("status", "processing").lte("created_at", cutoff).limit(25);

  const summary: any[] = [];
  for (const w of rows ?? []) {
    const piid = (w.destination as any)?.yengapay?.id;
    if (!piid) { summary.push({ id: w.id, skipped: "no provider id" }); continue; }
    const body = await lookupCashout(String(piid));
    if (!body) { summary.push({ id: w.id, skipped: "lookup failed" }); continue; }
    const st = mapStatus(body?.status || body?.paymentStatus || body?.data?.status);
    if (st === "success") {
      await admin.from("withdrawals").update({
        status: "paid", destination: { ...(w.destination as any), reconcile: body },
      }).eq("id", w.id).eq("status", "processing");
      await admin.from("transactions").update({ status: "success", metadata: body })
        .eq("provider_ref", String(piid)).eq("type", "withdrawal");
      summary.push({ id: w.id, status: "paid" });
    } else if (st === "failed") {
      const { data: updated } = await admin.from("withdrawals").update({
        status: "failed", destination: { ...(w.destination as any), reconcile: body },
      }).eq("id", w.id).eq("status", "processing").select("id").maybeSingle();
      if (updated) {
        await admin.from("transactions").update({ status: "failed", metadata: body })
          .eq("provider_ref", String(piid)).eq("type", "withdrawal");
        const { data: wallet } = await admin.from("wallets").select("id,balance").eq("user_id", w.user_id).eq("currency", w.currency).maybeSingle();
        if (wallet) {
          await admin.from("wallets").update({ balance: Number(wallet.balance) + Number(w.amount) }).eq("id", wallet.id);
          await admin.from("transactions").insert({
            user_id: w.user_id, type: "withdrawal_refund", status: "success",
            amount: w.amount, currency: w.currency,
            description: "Remboursement automatique — retrait échoué (réconciliation)",
          });
        }
      }
      summary.push({ id: w.id, status: "failed", refunded: true });
    } else {
      summary.push({ id: w.id, status: "still pending" });
    }
  }
  return jsonResponse({ ok: true, processed: summary.length, summary });
});