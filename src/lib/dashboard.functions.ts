import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getDashboardData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { loadPricingConfig } = await import("./pricing.server");
    const [{ data: wallets }, { data: txs }, { data: cards }, { data: profile }, { data: kyc }] = await Promise.all([
      supabase.from("wallets").select("id,currency,balance").eq("user_id", userId),
      supabase.from("transactions").select("id,type,status,amount,currency,description,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
      supabase.from("cards").select("id,brand,last4,currency,balance,status,failed_attempts,auto_frozen_at,created_at").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("profiles").select("full_name,email,phone,strowallet_customer_id,is_active,country").eq("id", userId).maybeSingle(),
      supabase.from("kyc_submissions").select("status,provider_status,submitted_at,first_name,last_name,date_of_birth,id_type,id_number,id_image_url,selfie_url,address,city,country").eq("user_id", userId).maybeSingle(),
    ]);
    const pricing = await loadPricingConfig();
    const kycSubmitted = !!kyc && (kyc.status === "submitted" || kyc.status === "approved" || !!kyc.submitted_at);
    const kycApproved = !!profile?.strowallet_customer_id && (kyc?.provider_status === "approved" || kyc?.status === "approved");

    // Auto-sync KYC verdict from Strowallet when local state is still pending
    let syncedKyc = kyc;
    let syncedProfile = profile;
    const needsSync = !!kyc && !kycApproved && kyc.status !== "rejected" && (kycSubmitted || !!profile?.strowallet_customer_id);
    if (needsSync) {
      try {
        const { getStrowalletCardholder, normalizeKycVerdict, extractStrowalletCustomerId, ensureStrowalletCustomer } = await import("./strowallet.server");
        let customerId = profile?.strowallet_customer_id ?? undefined;
        if (!customerId && profile?.email && profile?.phone && kyc?.first_name && kyc?.last_name && kyc?.date_of_birth && kyc?.id_type && kyc?.id_number && kyc?.id_image_url && kyc?.selfie_url && kyc?.address && kyc?.city) {
          const ensured = await ensureStrowalletCustomer({
            firstName: kyc.first_name,
            lastName: kyc.last_name,
            email: profile.email,
            phone: profile.phone,
            dob: kyc.date_of_birth,
            idType: kyc.id_type,
            idNumber: kyc.id_number,
            idImage: kyc.id_image_url,
            selfie: kyc.selfie_url,
            address: kyc.address,
            city: kyc.city,
            country: kyc.country || profile.country || "BF",
            state: kyc.city,
            zipCode: "00000",
            houseNumber: "1",
          });
          customerId = ensured.customerId;
          await supabase.from("profiles").update({ strowallet_customer_id: ensured.customerId }).eq("id", userId);
          await supabase.from("kyc_submissions").update({ provider_status: ensured.created ? "sent" : "synced", provider_response: ensured.response as any }).eq("user_id", userId);
          syncedProfile = { ...(profile ?? {} as any), strowallet_customer_id: ensured.customerId };
        }
        const res = await getStrowalletCardholder({
          customerEmail: profile?.email ?? undefined,
          customerId,
        });
        const { raw, verdict } = normalizeKycVerdict(res);
        const newCustomerId = extractStrowalletCustomerId(res);
        if (newCustomerId && newCustomerId !== profile?.strowallet_customer_id) {
          await supabase.from("profiles").update({ strowallet_customer_id: newCustomerId }).eq("id", userId);
          syncedProfile = { ...(profile ?? {} as any), strowallet_customer_id: newCustomerId };
        }
        const status = verdict === "approved" ? "approved" : verdict === "rejected" ? "rejected" : undefined;
        await supabase.from("kyc_submissions").update({
          provider_status: raw ?? verdict,
          provider_response: res as any,
          ...(status ? { status } : {}),
        }).eq("user_id", userId);
        syncedKyc = { ...(kyc as any), provider_status: raw ?? verdict, ...(status ? { status } : {}) };
      } catch {
        // Silent: keep local state if provider call fails (e.g. customer not yet created)
      }
    }
    const finalApproved = !!syncedProfile?.strowallet_customer_id && (syncedKyc?.provider_status === "approved" || syncedKyc?.status === "approved");
    const finalSubmitted = !!syncedKyc && (syncedKyc.status === "submitted" || syncedKyc.status === "approved" || !!syncedKyc.submitted_at);
    return {
      wallets: wallets ?? [],
      transactions: txs ?? [],
      cards: cards ?? [],
      profile: syncedProfile,
      kyc: syncedKyc,
      pricing,
      kycSubmitted: finalSubmitted,
      kycApproved: finalApproved,
      // Card emission requires admin/Strowallet approval — submission alone is not enough
      kycReady: finalApproved && !!syncedProfile?.strowallet_customer_id,
    };
  });

export const computePricingPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { amountUsd: number }) => ({ amountUsd: Number(d.amountUsd) || 0 }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { computeCardCost, loadPricingConfig } = await import("./pricing.server");
    const cfg = await loadPricingConfig();
    const cost = computeCardCost(data.amountUsd, cfg);
    const { data: w } = await supabase.from("wallets").select("balance").eq("user_id", userId).eq("currency", "XOF").maybeSingle();
    const available = Number(w?.balance ?? 0);
    return { ...cost, available, canAfford: available >= cost.totalXof };
  });