// Universal authenticated API dispatcher.
// Body shape: { fn: string, data?: any }
// Auth: requires a valid Supabase JWT in Authorization header.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import * as SW from "../_shared/strowallet.ts";
import { computeCardCost, computeFundCost, loadPricingConfig } from "../_shared/pricing.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
}

async function getAuthUser(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) throw new Error("Unauthorized");
  const token = authHeader.slice(7);
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new Error("Unauthorized");
  return { user: data.user, userClient: client };
}

async function isAdmin(admin: any, userId: string) {
  const { data } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
  return !!data;
}

// ============= Handlers =============
const HANDLERS: Record<string, (args: { data: any; user: any; admin: any; userClient: any }) => Promise<any>> = {
  // ---------- Dashboard ----------
  async getDashboardData({ user, admin, userClient }) {
    const userId = user.id;
    const [w, t, c, p, k] = await Promise.all([
      userClient.from("wallets").select("id,currency,balance").eq("user_id", userId),
      userClient.from("transactions").select("id,type,status,amount,currency,description,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
      userClient.from("cards").select("id,brand,last4,currency,balance,status,failed_attempts,auto_frozen_at,created_at").eq("user_id", userId).order("created_at", { ascending: false }),
      userClient.from("profiles").select("full_name,email,phone,strowallet_customer_id,is_active,country").eq("id", userId).maybeSingle(),
      userClient.from("kyc_submissions").select("status,provider_status,submitted_at,first_name,last_name,date_of_birth,id_type,id_number,id_image_url,selfie_url,address,city,country").eq("user_id", userId).maybeSingle(),
    ]);
    const wallets = w.data ?? []; const transactions = t.data ?? []; const cards = c.data ?? [];
    let profile = p.data; let kyc = k.data;
    const pricing = await loadPricingConfig(admin);
    const kycSubmitted = !!kyc && (kyc.status === "submitted" || kyc.status === "approved" || !!kyc.submitted_at);
    const kycApproved = !!profile?.strowallet_customer_id && (kyc?.provider_status === "approved" || kyc?.status === "approved");
    const needsSync = !!kyc && !kycApproved && kyc.status !== "rejected" && (kycSubmitted || !!profile?.strowallet_customer_id);
    if (needsSync) {
      try {
        let customerId = profile?.strowallet_customer_id ?? undefined;
        if (!customerId && profile?.email && profile?.phone && kyc?.first_name && kyc?.last_name && kyc?.date_of_birth && kyc?.id_type && kyc?.id_number && kyc?.id_image_url && kyc?.selfie_url && kyc?.address && kyc?.city) {
          const ensured = await SW.ensureStrowalletCustomer({
            firstName: kyc.first_name, lastName: kyc.last_name, email: profile.email, phone: profile.phone,
            dob: kyc.date_of_birth, idType: kyc.id_type, idNumber: kyc.id_number,
            idImage: kyc.id_image_url, selfie: kyc.selfie_url,
            address: kyc.address, city: kyc.city, country: kyc.country || profile.country || "BF",
            state: kyc.city, zipCode: "00000", houseNumber: "1",
          });
          customerId = ensured.customerId;
          await admin.from("profiles").update({ strowallet_customer_id: ensured.customerId }).eq("id", userId);
          await admin.from("kyc_submissions").update({ provider_status: ensured.created ? "sent" : "synced", provider_response: ensured.response }).eq("user_id", userId);
          profile = { ...(profile ?? {} as any), strowallet_customer_id: ensured.customerId };
        }
        const res = await SW.getStrowalletCardholder({ customerEmail: profile?.email ?? undefined, customerId });
        const { raw, verdict } = SW.normalizeKycVerdict(res);
        const newCustomerId = SW.extractStrowalletCustomerId(res);
        if (newCustomerId && newCustomerId !== profile?.strowallet_customer_id) {
          await admin.from("profiles").update({ strowallet_customer_id: newCustomerId }).eq("id", userId);
          profile = { ...(profile ?? {} as any), strowallet_customer_id: newCustomerId };
        }
        const status = verdict === "approved" ? "approved" : verdict === "rejected" ? "rejected" : undefined;
        await admin.from("kyc_submissions").update({ provider_status: raw ?? verdict, provider_response: res, ...(status ? { status } : {}) }).eq("user_id", userId);
        kyc = { ...(kyc as any), provider_status: raw ?? verdict, ...(status ? { status } : {}) };
      } catch { /* keep local state */ }
    }
    const finalApproved = !!profile?.strowallet_customer_id && (kyc?.provider_status === "approved" || kyc?.status === "approved");
    const finalSubmitted = !!kyc && (kyc.status === "submitted" || kyc.status === "approved" || !!kyc.submitted_at);
    return { wallets, transactions, cards, profile, kyc, pricing, kycSubmitted: finalSubmitted, kycApproved: finalApproved, kycReady: finalApproved && !!profile?.strowallet_customer_id };
  },

  async computePricingPreview({ data, user, admin, userClient }) {
    const cfg = await loadPricingConfig(admin);
    const cost = computeCardCost(Number(data.amountUsd), cfg);
    const { data: w } = await userClient.from("wallets").select("balance").eq("user_id", user.id).eq("currency", "XOF").maybeSingle();
    const available = Number(w?.balance ?? 0);
    return { ...cost, available, canAfford: available >= cost.totalXof };
  },

  // ---------- Strowallet user-facing ----------
  async diagnoseStrowallet() { return SW.strowalletDiagnostic(); },

  async syncKycStatus({ user, admin, userClient }) {
    const userId = user.id; const email = user.email;
    const [{ data: profile }, { data: kyc }] = await Promise.all([
      userClient.from("profiles").select("strowallet_customer_id,email,phone").eq("id", userId).maybeSingle(),
      userClient.from("kyc_submissions").select("first_name,last_name,date_of_birth,id_type,id_number,id_image_url,selfie_url,address,city,country").eq("user_id", userId).maybeSingle(),
    ]);
    const customerEmail = profile?.email || email;
    let customerId = profile?.strowallet_customer_id || undefined;
    if (!customerEmail && !customerId) return { ok: false, error: "Aucun identifiant Strowallet à interroger." };
    try {
      if (!customerId && customerEmail && profile?.phone && kyc?.first_name && kyc?.last_name && kyc?.date_of_birth && kyc?.id_type && kyc?.id_number && kyc?.id_image_url && kyc?.selfie_url && kyc?.address && kyc?.city) {
        const ensured = await SW.ensureStrowalletCustomer({
          firstName: kyc.first_name, lastName: kyc.last_name, email: customerEmail, phone: profile.phone,
          dob: kyc.date_of_birth, idType: kyc.id_type, idNumber: kyc.id_number,
          idImage: kyc.id_image_url, selfie: kyc.selfie_url,
          address: kyc.address, city: kyc.city, country: kyc.country || "BF",
          state: kyc.city, zipCode: "00000", houseNumber: "1",
        });
        customerId = ensured.customerId;
        await admin.from("profiles").update({ strowallet_customer_id: ensured.customerId }).eq("id", userId);
        await admin.from("kyc_submissions").update({ provider_status: ensured.created ? "sent" : "synced", provider_response: ensured.response }).eq("user_id", userId);
      }
      const res = await SW.getStrowalletCardholder({ customerEmail, customerId });
      const { raw, verdict, reason } = SW.normalizeKycVerdict(res);
      const newCustomerId = SW.extractStrowalletCustomerId(res);
      if (newCustomerId && newCustomerId !== profile?.strowallet_customer_id) {
        await admin.from("profiles").update({ strowallet_customer_id: newCustomerId }).eq("id", userId);
      }
      const status = verdict === "approved" ? "approved" : verdict === "rejected" ? "rejected" : undefined;
      await admin.from("kyc_submissions").update({ provider_status: raw ?? verdict, provider_response: res, ...(status ? { status } : {}) }).eq("user_id", userId);
      return { ok: true, verdict, raw, reason };
    } catch (e) { return { ok: false, error: (e as Error).message }; }
  },

  async fetchStrowalletBalance({ user, admin }) {
    if (!(await isAdmin(admin, user.id))) throw new Error("Forbidden");
    try { return { ok: true, data: await SW.getStrowalletBalance() }; }
    catch (e) { return { ok: false, error: (e as Error).message }; }
  },

  async submitKyc({ data, user, admin }) {
    const userId = user.id; const email = user.email;
    const { error: insErr } = await admin.from("kyc_submissions").upsert({
      user_id: userId, status: "submitted",
      first_name: data.firstName, last_name: data.lastName,
      date_of_birth: data.dob, id_type: data.idType, id_number: data.idNumber,
      id_image_url: data.idImage, selfie_url: data.selfie,
      address: data.address, city: data.city, country: data.country,
      submitted_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (insErr) throw new Error(insErr.message);
    try {
      const ensured = await SW.ensureStrowalletCustomer({ ...data, email, state: data.city, zipCode: "00000", houseNumber: "1" });
      const customerId = ensured.customerId;
      await admin.from("kyc_submissions").update({ provider_status: ensured.created ? "sent" : "synced", provider_response: ensured.response }).eq("user_id", userId);
      if (customerId) await admin.from("profiles").update({ strowallet_customer_id: String(customerId) }).eq("id", userId);
      return { ok: true, data: ensured.response };
    } catch (e) {
      const msg = (e as Error).message;
      await admin.from("kyc_submissions").update({ provider_status: "error", provider_response: { error: msg } }).eq("user_id", userId);
      return { ok: false, error: msg };
    }
  },

  async issueCard({ data, user, admin, userClient }) {
    const userId = user.id; const email = user.email;
    const { data: profile } = await userClient.from("profiles").select("strowallet_customer_id").eq("id", userId).maybeSingle();
    if (!profile?.strowallet_customer_id) return { ok: false, error: "KYC non validé — soumettez votre dossier avant d'émettre une carte." };
    const cfg = await loadPricingConfig(admin);
    const cost = computeCardCost(Number(data.amountUsd), cfg);
    const requiredXof = cost.totalXof;
    const { data: wallet, error: wErr } = await userClient.from("wallets").select("balance,id").eq("user_id", userId).eq("currency", "XOF").maybeSingle();
    if (wErr) throw new Error(wErr.message);
    if (!wallet || Number(wallet.balance) < requiredXof) return { ok: false, error: "Solde XOF insuffisant", required: requiredXof, available: Number(wallet?.balance ?? 0) };
    const { error: debErr } = await admin.from("wallets").update({ balance: Number(wallet.balance) - requiredXof }).eq("id", wallet.id);
    if (debErr) throw new Error(debErr.message);
    try {
      const res = await SW.createStrowalletCard({ customerEmail: email, amount: cost.loadedToStrowalletUsd, brand: data.brand });
      const providerCardId = (res as any)?.response?.card_id || (res as any)?.card_id || null;
      const last4 = (res as any)?.response?.last4 || null;
      await admin.from("cards").insert({
        user_id: userId, provider: "strowallet",
        provider_card_id: providerCardId ? String(providerCardId) : null,
        brand: String(data.brand).toLowerCase(), last4, currency: "USD",
        balance: Number(data.amountUsd), status: "active", metadata: res,
      });
      await admin.from("transactions").insert({
        user_id: userId, type: "card_issue", status: "success",
        amount: requiredXof, currency: "XOF", provider: "strowallet",
        provider_ref: providerCardId ? String(providerCardId) : null,
        description: `Émission carte ${data.brand} ${data.amountUsd} USD (frais ${cfg.card_issue_fee_xof} XOF)`,
        metadata: { pricing: cost },
      });
      return { ok: true, data: res };
    } catch (e) {
      await admin.from("wallets").update({ balance: Number(wallet.balance) }).eq("id", wallet.id);
      await admin.from("transactions").insert({
        user_id: userId, type: "card_issue", status: "failed",
        amount: requiredXof, currency: "XOF", provider: "strowallet",
        description: "Émission carte échouée — remboursée", metadata: { error: (e as Error).message },
      });
      return { ok: false, error: (e as Error).message };
    }
  },

  async cardDetails({ data, user, admin, userClient }) {
    const { data: card } = await userClient.from("cards").select("user_id").eq("provider_card_id", data.card_id).maybeSingle();
    if (!card || card.user_id !== user.id) {
      if (!(await isAdmin(admin, user.id))) throw new Error("Carte introuvable");
    }
    return SW.getStrowalletCardDetails(data.card_id);
  },

  async cardAction({ data, user, admin, userClient }) {
    const { data: card } = await userClient.from("cards").select("id,user_id").eq("provider_card_id", data.card_id).maybeSingle();
    if (!card || card.user_id !== user.id) {
      if (!(await isAdmin(admin, user.id))) return { ok: false, error: "Carte introuvable" };
    }
    try {
      const res = await SW.strowalletCardAction(data.action, data.card_id);
      const newStatus = data.action === "freeze" ? "frozen" : data.action === "unfreeze" ? "active" : "terminated";
      await admin.from("cards").update({ status: newStatus, ...(data.action === "unfreeze" ? { failed_attempts: 0, auto_frozen_at: null } : {}) }).eq("provider_card_id", data.card_id);
      return { ok: true, data: res };
    } catch (e) { return { ok: false, error: (e as Error).message }; }
  },

  async listCardTransactions({ data, user, admin, userClient }) {
    const { data: card } = await userClient.from("cards").select("user_id").eq("provider_card_id", data.card_id).maybeSingle();
    if (!card || card.user_id !== user.id) {
      if (!(await isAdmin(admin, user.id))) return { ok: false, error: "Carte introuvable" };
    }
    try { return { ok: true, data: await SW.getStrowalletCardTransactions({ card_id: data.card_id }) }; }
    catch (e) { return { ok: false, error: (e as Error).message }; }
  },

  async fundCard({ data, user, admin, userClient }) {
    const userId = user.id;
    const { data: card } = await userClient.from("cards").select("id,user_id,balance,provider_card_id,status").eq("provider_card_id", data.card_id).maybeSingle();
    if (!card || card.user_id !== userId) return { ok: false, error: "Carte introuvable" };
    if (card.status === "terminated") return { ok: false, error: "Carte résiliée" };
    const cfg = await loadPricingConfig(admin);
    const cost = computeFundCost(Number(data.amountUsd), cfg);
    const requiredXof = cost.totalXof;
    const { data: wallet, error: wErr } = await userClient.from("wallets").select("id,balance").eq("user_id", userId).eq("currency", "XOF").maybeSingle();
    if (wErr) throw new Error(wErr.message);
    if (!wallet || Number(wallet.balance) < requiredXof) return { ok: false, error: "Solde XOF insuffisant", required: requiredXof, available: Number(wallet?.balance ?? 0) };
    const { error: debErr } = await admin.from("wallets").update({ balance: Number(wallet.balance) - requiredXof }).eq("id", wallet.id);
    if (debErr) throw new Error(debErr.message);
    try {
      const res = await SW.fundStrowalletCard({ card_id: data.card_id, amount: Number(data.amountUsd) });
      await admin.from("cards").update({ balance: Number(card.balance) + Number(data.amountUsd) }).eq("id", card.id);
      await admin.from("transactions").insert({
        user_id: userId, type: "card_fund", status: "success",
        amount: requiredXof, currency: "XOF", provider: "strowallet",
        provider_ref: data.card_id,
        description: `Recharge carte ${data.amountUsd} USD (≈ ${requiredXof} XOF)`,
        metadata: { pricing: cost, response: res },
      });
      return { ok: true, data: res };
    } catch (e) {
      await admin.from("wallets").update({ balance: Number(wallet.balance) }).eq("id", wallet.id);
      await admin.from("transactions").insert({
        user_id: userId, type: "card_fund", status: "failed",
        amount: requiredXof, currency: "XOF", provider: "strowallet",
        description: "Recharge carte échouée — remboursée",
        metadata: { error: (e as Error).message },
      });
      return { ok: false, error: (e as Error).message };
    }
  },

  async listMyCards({ user, userClient }) {
    const { data, error } = await userClient.from("cards")
      .select("id,brand,last4,currency,balance,status,provider_card_id,failed_attempts,auto_frozen_at,created_at")
      .eq("user_id", user.id).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  // ---------- KYC ----------
  async submitFullKyc({ data, user, admin, userClient }) {
    const userId = user.id; const email = user.email;
    const [idSig, selfieSig] = await Promise.all([
      admin.storage.from("kyc").createSignedUrl(data.idImagePath, 60 * 60 * 24 * 7),
      admin.storage.from("kyc").createSignedUrl(data.selfiePath, 60 * 60 * 24 * 7),
    ]);
    const idImage = idSig.data?.signedUrl ?? "";
    const selfie = selfieSig.data?.signedUrl ?? "";
    const { error: upsertErr } = await userClient.from("kyc_submissions").upsert({
      user_id: userId, status: "submitted",
      first_name: data.firstName, last_name: data.lastName,
      date_of_birth: data.dob, id_type: data.idType, id_number: data.idNumber,
      id_image_url: idImage, selfie_url: selfie,
      address: data.address, city: data.city, country: data.country,
      submitted_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (upsertErr) return { ok: false, error: `Sauvegarde KYC échouée : ${upsertErr.message}` };
    try {
      const ensured = await SW.ensureStrowalletCustomer({
        firstName: data.firstName, lastName: data.lastName, email, phone: data.phone,
        dob: data.dob, idType: data.idType, idNumber: data.idNumber,
        idImage, selfie,
        address: data.address, city: data.city, country: data.country,
        state: data.state, zipCode: data.zipCode, houseNumber: data.houseNumber,
      });
      await admin.from("kyc_submissions").update({ provider_status: ensured.created ? "sent" : "synced", provider_response: ensured.response }).eq("user_id", userId);
      if (ensured.customerId) await admin.from("profiles").update({ strowallet_customer_id: String(ensured.customerId) }).eq("id", userId);
      return { ok: true, customerId: ensured.customerId };
    } catch (e) {
      const msg = (e as Error).message;
      await admin.from("kyc_submissions").update({ provider_status: "error", provider_response: { error: msg } }).eq("user_id", userId);
      return { ok: false, error: msg };
    }
  },

  async createKycUploadUrl({ data, user, admin }) {
    const path = `${user.id}/${data.kind}-${Date.now()}.${String(data.ext).toLowerCase()}`;
    const { data: signed, error } = await admin.storage.from("kyc").createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message ?? "Upload URL error");
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  },

  // ---------- Withdrawals & YengaPay ----------
  async requestWithdrawal({ data, user, admin, userClient }) {
    const userId = user.id;
    const { data: w } = await userClient.from("wallets").select("id,balance").eq("user_id", userId).eq("currency", "XOF").maybeSingle();
    if (!w || Number(w.balance) < Number(data.amount)) return { ok: false, error: "Solde XOF insuffisant" };
    await admin.from("wallets").update({ balance: Number(w.balance) - Number(data.amount) }).eq("id", w.id);
    const { data: row, error } = await admin.from("withdrawals").insert({
      user_id: userId, amount: Number(data.amount), currency: "XOF", method: data.method,
      destination: { operator: data.operator, phone: data.phone, account: data.account, holder: data.holder },
      status: "pending",
    }).select("id").single();
    if (error) throw new Error(error.message);
    await admin.from("transactions").insert({
      user_id: userId, type: "withdrawal", status: "pending",
      amount: Number(data.amount), currency: "XOF",
      description: `Demande de retrait ${data.method} ${data.operator}`,
      provider_ref: row.id,
    });
    return { ok: true, id: row.id };
  },

  async initRecharge({ data, user, admin }) {
    const userId = user.id;
    const reference = `FIP-${Date.now()}-${userId.slice(0, 8)}`;
    const { error: txErr } = await admin.from("transactions").insert({
      user_id: userId, type: "deposit", status: "pending",
      amount: Number(data.amount), currency: "XOF",
      provider: "yengapay", provider_ref: reference,
      description: "Recharge YengaPay",
    });
    if (txErr) throw new Error(txErr.message);
    const callbackUrl = `${SUPABASE_URL}/functions/v1/yengapay-webhook`;
    const apiKey = Deno.env.get("YENGAPAY_API_KEY");
    const groupId = Deno.env.get("YENGAPAY_GROUP_ID");
    const projectId = Deno.env.get("YENGAPAY_PROJECT_ID");
    if (!apiKey || !groupId || !projectId) throw new Error("YengaPay env missing");
    const url = `https://api.yengapay.com/api/v1/groups/${groupId}/payment-intent/${projectId}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({
        paymentAmount: Number(data.amount), reference,
        articles: [{ title: "Recharge FASO-INVEST PAY", description: "Recharge portefeuille", pictures: [], price: Number(data.amount) }],
        callbackUrl,
      }),
    });
    const text = await res.text(); let body: any = text;
    try { body = JSON.parse(text); } catch { /**/ }
    if (!res.ok) throw new Error(`YengaPay ${res.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
    return { ok: true, checkout_url: body?.checkoutPageUrlWithPaymentToken || body?.checkout_url || body?.paymentUrl, reference, raw: body };
  },

  // ---------- Admin ----------
  async adminOverview({ user, admin }) {
    if (!(await isAdmin(admin, user.id))) throw new Error("Forbidden");
    const [users, cards, txs, kyc, withdrawals] = await Promise.all([
      admin.from("profiles").select("id,full_name,email,phone,country,is_active,strowallet_customer_id,created_at").order("created_at", { ascending: false }).limit(100),
      admin.from("cards").select("id,user_id,brand,last4,status,balance,currency,failed_attempts,auto_frozen_at,created_at").order("created_at", { ascending: false }).limit(50),
      admin.from("transactions").select("id,user_id,type,status,amount,currency,description,created_at").order("created_at", { ascending: false }).limit(50),
      admin.from("kyc_submissions").select("*").order("submitted_at", { ascending: false, nullsFirst: false }).limit(50),
      admin.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    const { data: monthTx } = await admin.from("transactions").select("type,amount,currency,status").gte("created_at", monthStart.toISOString()).eq("status","success");
    const flows = { recharges_xof: 0, withdrawals_xof: 0, card_issue_xof: 0 };
    for (const t of monthTx ?? []) {
      if (t.currency !== "XOF") continue;
      const a = Number(t.amount);
      if (t.type === "deposit") flows.recharges_xof += a;
      if (t.type === "withdrawal") flows.withdrawals_xof += a;
      if (t.type === "card_issue") flows.card_issue_xof += a;
    }
    return { users: users.data ?? [], cards: cards.data ?? [], transactions: txs.data ?? [], kyc: kyc.data ?? [], withdrawals: withdrawals.data ?? [], flows };
  },

  async adminStrowalletBalance({ user, admin }) {
    if (!(await isAdmin(admin, user.id))) throw new Error("Forbidden");
    try { return { ok: true, data: await SW.getStrowalletBalance() }; }
    catch (e) { return { ok: false, error: (e as Error).message }; }
  },

  async adminToggleUser({ data, user, admin }) {
    if (!(await isAdmin(admin, user.id))) throw new Error("Forbidden");
    const { error } = await admin.from("profiles").update({ is_active: !!data.is_active }).eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  async adminReviewKyc({ data, user, admin }) {
    if (!(await isAdmin(admin, user.id))) throw new Error("Forbidden");
    if (data.decision === "approved") {
      const [{ data: profile }, { data: kyc }] = await Promise.all([
        admin.from("profiles").select("email,phone,full_name,country,strowallet_customer_id").eq("id", data.user_id).maybeSingle(),
        admin.from("kyc_submissions").select("first_name,last_name,date_of_birth,id_type,id_number,id_image_url,selfie_url,address,city,country").eq("user_id", data.user_id).maybeSingle(),
      ]);
      if (!profile?.strowallet_customer_id) {
        if (!profile?.email || !profile?.phone || !kyc?.first_name || !kyc?.last_name || !kyc?.date_of_birth || !kyc?.id_type || !kyc?.id_number || !kyc?.id_image_url || !kyc?.selfie_url || !kyc?.address || !kyc?.city) {
          throw new Error("Impossible d'approuver ce KYC : informations nécessaires incomplètes.");
        }
        const ensured = await SW.ensureStrowalletCustomer({
          firstName: kyc.first_name, lastName: kyc.last_name, email: profile.email, phone: profile.phone,
          dob: kyc.date_of_birth, idType: kyc.id_type, idNumber: kyc.id_number,
          idImage: kyc.id_image_url, selfie: kyc.selfie_url,
          address: kyc.address, city: kyc.city, country: kyc.country || profile.country || "BF",
          state: kyc.city, zipCode: "00000", houseNumber: "1",
        });
        const { error: pErr } = await admin.from("profiles").update({ strowallet_customer_id: ensured.customerId }).eq("id", data.user_id);
        if (pErr) throw new Error(pErr.message);
        await admin.from("kyc_submissions").update({ provider_status: ensured.created ? "sent" : "synced", provider_response: ensured.response }).eq("user_id", data.user_id);
      }
    }
    const { error } = await admin.from("kyc_submissions").update({
      provider_status: data.decision, status: data.decision,
      provider_response: { admin_note: data.note ?? null, reviewed_at: new Date().toISOString() },
    }).eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  async adminReviewWithdrawal({ data, user, admin }) {
    if (!(await isAdmin(admin, user.id))) throw new Error("Forbidden");
    const { data: w } = await admin.from("withdrawals").select("*").eq("id", data.id).maybeSingle();
    if (!w) throw new Error("Retrait introuvable");
    if (data.decision === "rejected" && w.status !== "rejected") {
      const { data: wallet } = await admin.from("wallets").select("id,balance").eq("user_id", w.user_id).eq("currency", w.currency).maybeSingle();
      if (wallet) {
        await admin.from("wallets").update({ balance: Number(wallet.balance) + Number(w.amount) }).eq("id", wallet.id);
        await admin.from("transactions").insert({
          user_id: w.user_id, type: "withdrawal_refund", status: "success",
          amount: w.amount, currency: w.currency, description: "Retrait rejeté — remboursement",
        });
      }
    }
    await admin.from("withdrawals").update({
      status: data.decision, admin_note: data.note ?? null,
      reviewed_by: user.id, reviewed_at: new Date().toISOString(),
    }).eq("id", data.id);
    return { ok: true };
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  try {
    const { user, userClient } = await getAuthUser(req);
    const admin = adminClient();
    const payload = await req.json().catch(() => ({}));
    const fn = (payload as any).fn;
    const data = (payload as any).data ?? {};
    if (!fn || typeof fn !== "string") return jsonResponse({ error: "missing fn" }, 400);
    const handler = HANDLERS[fn];
    if (!handler) return jsonResponse({ error: `unknown fn: ${fn}` }, 404);
    const result = await handler({ data, user, admin, userClient });
    return jsonResponse(result);
  } catch (e) {
    const msg = (e as Error).message || "Internal error";
    const status = msg === "Unauthorized" ? 401 : msg === "Forbidden" ? 403 : 400;
    return jsonResponse({ error: msg }, status);
  }
});