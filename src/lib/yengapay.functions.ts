import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const initRecharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ amount: z.number().min(500).max(2_000_000) }).parse(d))
  .handler(async ({ context, data }): Promise<any> => {
    const { userId } = context;
    const { createYengaPayment } = await import("./yengapay.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const reference = `FIP-${Date.now()}-${userId.slice(0, 8)}`;
    const { error: txErr } = await supabaseAdmin.from("transactions").insert({
      user_id: userId,
      type: "deposit",
      status: "pending",
      amount: data.amount,
      currency: "XOF",
      provider: "yengapay",
      provider_ref: reference,
      description: "Recharge YengaPay",
    });
    if (txErr) throw new Error(txErr.message);

    const origin = process.env.PUBLIC_ORIGIN || "https://faso-invest-pay.lovable.app";
    const callbackUrl = `${origin}/api/public/yengapay-webhook`;
    const res = await createYengaPayment(data.amount, reference, callbackUrl);
    return { ok: true, checkout_url: res?.checkoutPageUrlWithPaymentToken || res?.checkout_url || res?.paymentUrl, reference, raw: res };
  });