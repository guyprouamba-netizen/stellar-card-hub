import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const diagnoseStrowallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { strowalletDiagnostic } = await import("./strowallet.server");
    return strowalletDiagnostic();
  });

// Admin only — Strowallet master account balance
export const fetchStrowalletBalance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { getStrowalletBalance } = await import("./strowallet.server");
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    try {
      const data = await getStrowalletBalance();
      return { ok: true as const, data };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  });

const kycSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  phone: z.string().min(6).max(20),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  idType: z.string().min(1),
  idNumber: z.string().min(1).max(64),
  idImage: z.string().url(),
  selfie: z.string().url(),
  address: z.string().min(1).max(200),
  city: z.string().min(1).max(80),
  country: z.string().min(2).max(3),
});

export const submitKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => kycSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId, claims } = context;
    const email = (claims as { email?: string }).email!;
    const { createStrowalletCustomer } = await import("./strowallet.server");
    // Persist locally first
    const { error: insErr } = await supabase.from("kyc_submissions").upsert({
      user_id: userId,
      status: "submitted",
      first_name: data.firstName,
      last_name: data.lastName,
      date_of_birth: data.dob,
      id_type: data.idType,
      id_number: data.idNumber,
      id_image_url: data.idImage,
      selfie_url: data.selfie,
      address: data.address,
      city: data.city,
      country: data.country,
      submitted_at: new Date().toISOString(),
    });
    if (insErr) throw new Error(insErr.message);

    // Forward to Strowallet
    try {
      const res = await createStrowalletCustomer({ ...data, email });
      const customerId = (res as any)?.response?.bitvcard_customer_id || (res as any)?.customerId || null;
      await supabase.from("kyc_submissions").update({ provider_status: "sent", provider_response: res }).eq("user_id", userId);
      if (customerId) {
        await supabase.from("profiles").update({ strowallet_customer_id: String(customerId) }).eq("id", userId);
      }
      return { ok: true as const, data: res };
    } catch (e) {
      const msg = (e as Error).message;
      await supabase.from("kyc_submissions").update({ provider_status: "error", provider_response: { error: msg } }).eq("user_id", userId);
      return { ok: false as const, error: msg };
    }
  });

const issueSchema = z.object({
  amountUsd: z.number().min(2).max(1000),
  brand: z.enum(["Visa", "MasterCard"]).default("Visa"),
});

export const issueCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => issueSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId, claims } = context;
    const email = (claims as { email?: string }).email!;
    const { createStrowalletCard } = await import("./strowallet.server");
    const { computeCardCost, loadPricingConfig } = await import("./pricing.server");

    // KYC gate
    const { data: profile } = await supabase.from("profiles").select("strowallet_customer_id").eq("id", userId).maybeSingle();
    if (!profile?.strowallet_customer_id) {
      return { ok: false as const, error: "KYC non validé — soumettez votre dossier avant d'émettre une carte." };
    }

    const cfg = await loadPricingConfig();
    const cost = computeCardCost(data.amountUsd, cfg);
    const requiredXof = cost.totalXof;

    // Check XOF wallet balance
    const { data: wallet, error: wErr } = await supabase
      .from("wallets").select("balance,id").eq("user_id", userId).eq("currency", "XOF").maybeSingle();
    if (wErr) throw new Error(wErr.message);
    if (!wallet || Number(wallet.balance) < requiredXof) {
      return { ok: false as const, error: "Solde XOF insuffisant", required: requiredXof, available: Number(wallet?.balance ?? 0) };
    }

    // Debit (service role bypasses RLS via admin client inside the function)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: debErr } = await supabaseAdmin
      .from("wallets")
      .update({ balance: Number(wallet.balance) - requiredXof })
      .eq("id", wallet.id);
    if (debErr) throw new Error(debErr.message);

    // Call provider
    try {
      const res = await createStrowalletCard({ customerEmail: email, amount: cost.loadedToStrowalletUsd, brand: data.brand });
      const providerCardId = (res as any)?.response?.card_id || (res as any)?.card_id || null;
      const last4 = (res as any)?.response?.last4 || null;

      await supabaseAdmin.from("cards").insert({
        user_id: userId,
        provider: "strowallet",
        provider_card_id: providerCardId ? String(providerCardId) : null,
        brand: data.brand.toLowerCase(),
        last4,
        currency: "USD",
        balance: data.amountUsd,
        status: "active",
        metadata: res as any,
      });

      await supabaseAdmin.from("transactions").insert({
        user_id: userId,
        type: "card_issue",
        status: "success",
        amount: requiredXof,
        currency: "XOF",
        provider: "strowallet",
        provider_ref: providerCardId ? String(providerCardId) : null,
        description: `Émission carte ${data.brand} ${data.amountUsd} USD (frais ${cfg.card_issue_fee_xof} XOF)`,
        metadata: { pricing: cost },
      });

      return { ok: true as const, data: res };
    } catch (e) {
      // Refund on failure
      await supabaseAdmin.from("wallets").update({ balance: Number(wallet.balance) }).eq("id", wallet.id);
      await supabaseAdmin.from("transactions").insert({
        user_id: userId, type: "card_issue", status: "failed",
        amount: requiredXof, currency: "XOF", provider: "strowallet",
        description: "Émission carte échouée — remboursée", metadata: { error: (e as Error).message },
      });
      return { ok: false as const, error: (e as Error).message };
    }
  });

export const cardDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ card_id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { getStrowalletCardDetails } = await import("./strowallet.server");
    return getStrowalletCardDetails(data.card_id);
  });

export const cardAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ card_id: z.string().min(1), action: z.enum(["freeze","unfreeze","terminate"]) }).parse(d))
  .handler(async ({ data }) => {
    const { strowalletCardAction } = await import("./strowallet.server");
    return strowalletCardAction(data.action, data.card_id);
  });