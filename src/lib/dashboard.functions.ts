import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeCardCost, loadPricingConfig } from "./pricing.server";

export const getDashboardData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: wallets }, { data: txs }, { data: cards }, { data: profile }, { data: kyc }] = await Promise.all([
      supabase.from("wallets").select("id,currency,balance").eq("user_id", userId),
      supabase.from("transactions").select("id,type,status,amount,currency,description,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
      supabase.from("cards").select("id,brand,last4,currency,balance,status,failed_attempts,auto_frozen_at,created_at").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("profiles").select("full_name,email,phone,strowallet_customer_id,is_active,country").eq("id", userId).maybeSingle(),
      supabase.from("kyc_submissions").select("status,provider_status,submitted_at").eq("user_id", userId).maybeSingle(),
    ]);
    const pricing = await loadPricingConfig();
    return {
      wallets: wallets ?? [],
      transactions: txs ?? [],
      cards: cards ?? [],
      profile,
      kyc,
      pricing,
      kycReady: !!profile?.strowallet_customer_id && (kyc?.provider_status === "approved" || kyc?.provider_status === "sent"),
    };
  });

export const computePricingPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { amountUsd: number }) => ({ amountUsd: Number(d.amountUsd) || 0 }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const cfg = await loadPricingConfig();
    const cost = computeCardCost(data.amountUsd, cfg);
    const { data: w } = await supabase.from("wallets").select("balance").eq("user_id", userId).eq("currency", "XOF").maybeSingle();
    const available = Number(w?.balance ?? 0);
    return { ...cost, available, canAfford: available >= cost.totalXof };
  });