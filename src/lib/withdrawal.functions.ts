import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  amount: z.number().min(500),
  method: z.enum(["mobile_money","bank"]),
  operator: z.string().min(1).max(40),
  phone: z.string().min(6).max(20).optional(),
  account: z.string().min(4).max(40).optional(),
  holder: z.string().min(1).max(120),
});

export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => schema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: w } = await supabase.from("wallets").select("id,balance").eq("user_id", userId).eq("currency","XOF").maybeSingle();
    if (!w || Number(w.balance) < data.amount) return { ok: false as const, error: "Solde XOF insuffisant" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // débit immédiat (séquestré jusqu'à validation admin)
    await supabaseAdmin.from("wallets").update({ balance: Number(w.balance) - data.amount }).eq("id", w.id);
    const { data: row, error } = await supabaseAdmin.from("withdrawals").insert({
      user_id: userId, amount: data.amount, currency: "XOF", method: data.method,
      destination: { operator: data.operator, phone: data.phone, account: data.account, holder: data.holder },
      status: "pending",
    }).select("id").single();
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("transactions").insert({
      user_id: userId, type: "withdrawal", status: "pending",
      amount: data.amount, currency: "XOF",
      description: `Demande de retrait ${data.method} ${data.operator}`,
      provider_ref: row.id,
    });
    return { ok: true as const, id: row.id };
  });