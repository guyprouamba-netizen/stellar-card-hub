import { supabase } from "@/integrations/supabase/client";
import { callApi } from "./api-client";

const DEFAULT_PRICING = {
  card_issue_fee_xof: 4500,
  usd_rate_xof: 869,
  strowallet_fixed_fee_usd: 1.9,
  strowallet_pct_fee: 0.01,
};

export const getDashboardData = async (_args?: any) => {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user.id;
  if (!userId) throw new Error("Session expirée. Reconnectez-vous.");

  const [w, t, c, p, wd] = await Promise.all([
    supabase.from("wallets").select("id,currency,balance").eq("user_id", userId),
    supabase.from("transactions").select("id,type,status,amount,currency,description,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
    supabase.from("cards").select("id,brand,last4,currency,balance,status,failed_attempts,auto_frozen_at,created_at").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("profiles").select("full_name,email,phone,is_active,country,referral_code,referrer_code").eq("id", userId).maybeSingle(),
    supabase.from("withdrawals").select("id,amount,currency,method,destination,status,failure_reason,paid_at,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(15),
  ]);

  const firstError = w.error || t.error || c.error || p.error;
  if (firstError) throw new Error(firstError.message);

  return {
    wallets: w.data ?? [],
    transactions: t.data ?? [],
    cards: c.data ?? [],
    profile: p.data,
    withdrawals: wd.data ?? [],
    kyc: null,
    pricing: DEFAULT_PRICING,
    kycSubmitted: true,
    kycApproved: true,
    kycReady: true,
  };
};
export const computePricingPreview = (args: { data: { amountUsd: number } }) =>
  callApi("computePricingPreview", args.data);