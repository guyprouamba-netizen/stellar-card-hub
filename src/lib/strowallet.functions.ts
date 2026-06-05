import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const diagnoseStrowallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { strowalletDiagnostic } = await import("./strowallet.server");
    return strowalletDiagnostic();
  });

// Pull the latest KYC verdict from Strowallet and persist it locally.
export const syncKycStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const email = (claims as { email?: string }).email;
    const { data: profile } = await supabase
      .from("profiles")
      .select("strowallet_customer_id,email")
      .eq("id", userId)
      .maybeSingle();
    const customerEmail = profile?.email || email;
    const customerId = profile?.strowallet_customer_id || undefined;
    if (!customerEmail && !customerId) {
      return { ok: false as const, error: "Aucun identifiant Strowallet à interroger." };
    }
    try {
      const { getStrowalletCardholder, normalizeKycVerdict, extractStrowalletCustomerId } = await import("./strowallet.server");
      const res = await getStrowalletCardholder({ customerEmail, customerId });
      const { raw, verdict, reason } = normalizeKycVerdict(res);
      const newCustomerId = extractStrowalletCustomerId(res);
      if (newCustomerId && newCustomerId !== profile?.strowallet_customer_id) {
        await supabase.from("profiles").update({ strowallet_customer_id: newCustomerId }).eq("id", userId);
      }
      const status = verdict === "approved" ? "approved" : verdict === "rejected" ? "rejected" : undefined;
      await supabase.from("kyc_submissions").update({
        provider_status: raw ?? verdict,
        provider_response: res as any,
        ...(status ? { status } : {}),
      }).eq("user_id", userId);
      return { ok: true as const, verdict, raw, reason };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
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
    const { ensureStrowalletCustomer } = await import("./strowallet.server");
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
      const ensured = await ensureStrowalletCustomer({ ...data, email, state: data.city, zipCode: "00000", houseNumber: "1" });
      const customerId = ensured.customerId;
      await supabase.from("kyc_submissions").update({ provider_status: ensured.created ? "sent" : "synced", provider_response: ensured.response }).eq("user_id", userId);
      if (customerId) {
        await supabase.from("profiles").update({ strowallet_customer_id: String(customerId) }).eq("id", userId);
      }
      return { ok: true as const, data: ensured.response };
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
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { strowalletCardAction } = await import("./strowallet.server");
    // Verify ownership via provider_card_id
    const { data: card } = await supabase.from("cards").select("id,user_id").eq("provider_card_id", data.card_id).maybeSingle();
    if (!card || card.user_id !== userId) {
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
      if (!isAdmin) return { ok: false as const, error: "Carte introuvable" };
    }
    try {
      const res = await strowalletCardAction(data.action, data.card_id);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const newStatus = data.action === "freeze" ? "frozen" : data.action === "unfreeze" ? "active" : "terminated";
      await supabaseAdmin.from("cards").update({ status: newStatus, ...(data.action === "unfreeze" ? { failed_attempts: 0, auto_frozen_at: null } : {}) }).eq("provider_card_id", data.card_id);
      return { ok: true as const, data: res };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  });

export const listCardTransactions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ card_id: z.string().min(1) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: card } = await supabase.from("cards").select("user_id").eq("provider_card_id", data.card_id).maybeSingle();
    if (!card || card.user_id !== userId) {
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
      if (!isAdmin) return { ok: false as const, error: "Carte introuvable" };
    }
    try {
      const { getStrowalletCardTransactions } = await import("./strowallet.server");
      const res = await getStrowalletCardTransactions({ card_id: data.card_id });
      return { ok: true as const, data: res };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  });

const fundSchema = z.object({ card_id: z.string().min(1), amountUsd: z.number().min(1).max(1000) });

export const fundCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => fundSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { fundStrowalletCard } = await import("./strowallet.server");
    const { computeFundCost, loadPricingConfig } = await import("./pricing.server");

    const { data: card } = await supabase.from("cards").select("id,user_id,balance,provider_card_id,status").eq("provider_card_id", data.card_id).maybeSingle();
    if (!card || card.user_id !== userId) return { ok: false as const, error: "Carte introuvable" };
    if (card.status === "terminated") return { ok: false as const, error: "Carte résiliée" };

    const cfg = await loadPricingConfig();
    const cost = computeFundCost(data.amountUsd, cfg);
    const requiredXof = cost.totalXof;

    const { data: wallet, error: wErr } = await supabase
      .from("wallets").select("id,balance").eq("user_id", userId).eq("currency", "XOF").maybeSingle();
    if (wErr) throw new Error(wErr.message);
    if (!wallet || Number(wallet.balance) < requiredXof) {
      return { ok: false as const, error: "Solde XOF insuffisant", required: requiredXof, available: Number(wallet?.balance ?? 0) };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: debErr } = await supabaseAdmin.from("wallets").update({ balance: Number(wallet.balance) - requiredXof }).eq("id", wallet.id);
    if (debErr) throw new Error(debErr.message);

    try {
      const res = await fundStrowalletCard({ card_id: data.card_id, amount: data.amountUsd });
      await supabaseAdmin.from("cards").update({ balance: Number(card.balance) + data.amountUsd }).eq("id", card.id);
      await supabaseAdmin.from("transactions").insert({
        user_id: userId, type: "card_fund", status: "success",
        amount: requiredXof, currency: "XOF", provider: "strowallet",
        provider_ref: data.card_id,
        description: `Recharge carte ${data.amountUsd} USD (≈ ${requiredXof} XOF)`,
        metadata: { pricing: cost, response: res } as any,
      });
      return { ok: true as const, data: res };
    } catch (e) {
      await supabaseAdmin.from("wallets").update({ balance: Number(wallet.balance) }).eq("id", wallet.id);
      await supabaseAdmin.from("transactions").insert({
        user_id: userId, type: "card_fund", status: "failed",
        amount: requiredXof, currency: "XOF", provider: "strowallet",
        description: "Recharge carte échouée — remboursée",
        metadata: { error: (e as Error).message } as any,
      });
      return { ok: false as const, error: (e as Error).message };
    }
  });

export const listMyCards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("cards")
      .select("id,brand,last4,currency,balance,status,provider_card_id,failed_attempts,auto_frozen_at,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });