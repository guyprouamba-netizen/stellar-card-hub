import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getStrowalletBalance } from "./strowallet.server";

async function assertAdmin(ctx: any) {
  const { data: ok } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!ok) throw new Error("Forbidden");
}

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: users }, { data: cards }, { data: txs }, { data: kyc }, { data: withdrawals }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,full_name,email,phone,country,is_active,strowallet_customer_id,created_at").order("created_at", { ascending: false }).limit(100),
      supabaseAdmin.from("cards").select("id,user_id,brand,last4,status,balance,currency,failed_attempts,auto_frozen_at,created_at").order("created_at", { ascending: false }).limit(50),
      supabaseAdmin.from("transactions").select("id,user_id,type,status,amount,currency,description,created_at").order("created_at", { ascending: false }).limit(50),
      supabaseAdmin.from("kyc_submissions").select("*").order("submitted_at", { ascending: false, nullsFirst: false }).limit(50),
      supabaseAdmin.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(50),
    ]);

    // Totaux flux financier (mois courant)
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    const { data: monthTx } = await supabaseAdmin.from("transactions")
      .select("type,amount,currency,status").gte("created_at", monthStart.toISOString()).eq("status","success");
    const flows = { recharges_xof: 0, withdrawals_xof: 0, card_issue_xof: 0 };
    for (const t of monthTx ?? []) {
      if (t.currency !== "XOF") continue;
      const a = Number(t.amount);
      if (t.type === "recharge") flows.recharges_xof += a;
      if (t.type === "withdrawal") flows.withdrawals_xof += a;
      if (t.type === "card_issue") flows.card_issue_xof += a;
    }
    return { users: users ?? [], cards: cards ?? [], transactions: txs ?? [], kyc: kyc ?? [], withdrawals: withdrawals ?? [], flows };
  });

export const adminStrowalletBalance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    try { return { ok: true as const, data: await getStrowalletBalance() }; }
    catch (e) { return { ok: false as const, error: (e as Error).message }; }
  });

export const adminToggleUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ user_id: z.string().uuid(), is_active: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("profiles").update({ is_active: data.is_active }).eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminReviewKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ user_id: z.string().uuid(), decision: z.enum(["approved","rejected"]), note: z.string().optional() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("kyc_submissions").update({
      provider_status: data.decision,
      status: data.decision,
      provider_response: { admin_note: data.note ?? null, reviewed_at: new Date().toISOString() },
    }).eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminReviewWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), decision: z.enum(["approved","rejected","paid"]), note: z.string().optional() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: w } = await supabaseAdmin.from("withdrawals").select("*").eq("id", data.id).maybeSingle();
    if (!w) throw new Error("Retrait introuvable");

    if (data.decision === "rejected" && w.status !== "rejected") {
      // refund wallet
      const { data: wallet } = await supabaseAdmin.from("wallets").select("id,balance").eq("user_id", w.user_id).eq("currency", w.currency).maybeSingle();
      if (wallet) {
        await supabaseAdmin.from("wallets").update({ balance: Number(wallet.balance) + Number(w.amount) }).eq("id", wallet.id);
        await supabaseAdmin.from("transactions").insert({
          user_id: w.user_id, type: "withdrawal_refund", status: "success",
          amount: w.amount, currency: w.currency, description: "Retrait rejeté — remboursement",
        });
      }
    }
    await supabaseAdmin.from("withdrawals").update({
      status: data.decision, admin_note: data.note ?? null,
      reviewed_by: context.userId, reviewed_at: new Date().toISOString(),
    }).eq("id", data.id);
    return { ok: true as const };
  });