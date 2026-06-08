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
    const [w, t, c, p] = await Promise.all([
      userClient.from("wallets").select("id,currency,balance").eq("user_id", userId),
      userClient.from("transactions").select("id,type,status,amount,currency,description,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
      userClient.from("cards").select("id,brand,last4,currency,balance,status,failed_attempts,auto_frozen_at,created_at").eq("user_id", userId).order("created_at", { ascending: false }),
      userClient.from("profiles").select("full_name,email,phone,is_active,country").eq("id", userId).maybeSingle(),
    ]);
    const pricing = await loadPricingConfig(admin);
    // KYC supprimé : l'API NFC ne nécessite plus de profil client. Les infos perso sont saisies à l'émission.
    return {
      wallets: w.data ?? [],
      transactions: t.data ?? [],
      cards: c.data ?? [],
      profile: p.data,
      kyc: null,
      pricing,
      kycSubmitted: true,
      kycApproved: true,
      kycReady: true,
    };
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

  // Stub conservé pour compat : l'API NFC ne fait plus de KYC séparé.
  async syncKycStatus() {
    return { ok: true, verdict: "approved" as const, raw: null, reason: null };
  },

  async fetchStrowalletBalance({ user, admin }) {
    if (!(await isAdmin(admin, user.id))) throw new Error("Forbidden");
    try { return { ok: true, data: await SW.getStrowalletBalance() }; }
    catch (e) { return { ok: false, error: (e as Error).message }; }
  },

  // Conservé pour compat front : ne fait rien, retourne ok.
  async submitKyc() { return { ok: true }; },

  async issueCard({ data, user, admin, userClient }) {
    const userId = user.id; const email = user.email;
    const cfg = await loadPricingConfig(admin);
    const amountUsd = Number(data.amountUsd);
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) return { ok: false, error: "Montant USD invalide" };
    const cost = computeCardCost(amountUsd, cfg);
    const requiredXof = cost.totalXof;
    // Validation des infos perso requises par l'API NFC
    const required = ["firstName","lastName","dob","idType","idNumber","line1","city","state","postalCode","country","phone"] as const;
    for (const k of required) {
      if (!data?.[k] || String(data[k]).trim() === "") return { ok: false, error: `Champ requis manquant : ${k}` };
    }
    const { data: wallet, error: wErr } = await userClient.from("wallets").select("balance,id").eq("user_id", userId).eq("currency", "XOF").maybeSingle();
    if (wErr) throw new Error(wErr.message);
    if (!wallet || Number(wallet.balance) < requiredXof) return { ok: false, error: "Solde XOF insuffisant", required: requiredXof, available: Number(wallet?.balance ?? 0) };
    const { error: debErr } = await admin.from("wallets").update({ balance: Number(wallet.balance) - requiredXof }).eq("id", wallet.id);
    if (debErr) throw new Error(debErr.message);
    try {
      const res = await SW.createNfcCard({
        firstName: data.firstName, lastName: data.lastName, dob: data.dob,
        idType: data.idType, idNumber: data.idNumber, email,
        line1: data.line1, city: data.city, state: data.state,
        postalCode: data.postalCode, country: data.country,
        amountUsd, phone: data.phone,
        nameOnCard: data.nameOnCard,
      });
      const { card_id, last4, brand } = SW.extractNfcCard(res);
      await admin.from("cards").insert({
        user_id: userId, provider: "strowallet",
        provider_card_id: card_id,
        brand: (brand || "visa").toLowerCase(), last4, currency: "USD",
        balance: amountUsd, status: "active", metadata: res,
      });
      await admin.from("transactions").insert({
        user_id: userId, type: "card_issue", status: "success",
        amount: requiredXof, currency: "XOF", provider: "strowallet",
        provider_ref: card_id,
        description: `Émission carte NFC ${amountUsd} USD (frais ${cfg.card_issue_fee_xof} XOF)`,
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
    return SW.getNfcCardDetails(data.card_id);
  },

  async cardAction({ data, user, admin, userClient }) {
    const { data: card } = await userClient.from("cards").select("id,user_id").eq("provider_card_id", data.card_id).maybeSingle();
    if (!card || card.user_id !== user.id) {
      if (!(await isAdmin(admin, user.id))) return { ok: false, error: "Carte introuvable" };
    }
    // L'API NFC ne propose plus que active/frozen (pas de terminate).
    const target: "active" | "frozen" =
      data.action === "freeze" ? "frozen" :
      data.action === "unfreeze" ? "active" :
      data.action === "terminate" ? "frozen" : "active";
    try {
      const res = await SW.nfcCardStatus(data.card_id, target);
      await admin.from("cards").update({
        status: target,
        ...(target === "active" ? { failed_attempts: 0, auto_frozen_at: null } : {}),
      }).eq("provider_card_id", data.card_id);
      return { ok: true, data: res };
    } catch (e) { return { ok: false, error: (e as Error).message }; }
  },

  async listCardTransactions({ data, user, admin, userClient }) {
    const { data: card } = await userClient.from("cards").select("user_id").eq("provider_card_id", data.card_id).maybeSingle();
    if (!card || card.user_id !== user.id) {
      if (!(await isAdmin(admin, user.id))) return { ok: false, error: "Carte introuvable" };
    }
    try { return { ok: true, data: await SW.getNfcCardHistory(data.card_id) }; }
    catch (e) { return { ok: false, error: (e as Error).message }; }
  },

  async fundCard({ data, user, admin, userClient }) {
    const userId = user.id;
    const { data: card } = await userClient.from("cards").select("id,user_id,balance,provider_card_id,status").eq("provider_card_id", data.card_id).maybeSingle();
    if (!card || card.user_id !== userId) return { ok: false, error: "Carte introuvable" };
    const cfg = await loadPricingConfig(admin);
    const cost = computeFundCost(Number(data.amountUsd), cfg);
    const requiredXof = cost.totalXof;
    const { data: wallet, error: wErr } = await userClient.from("wallets").select("id,balance").eq("user_id", userId).eq("currency", "XOF").maybeSingle();
    if (wErr) throw new Error(wErr.message);
    if (!wallet || Number(wallet.balance) < requiredXof) return { ok: false, error: "Solde XOF insuffisant", required: requiredXof, available: Number(wallet?.balance ?? 0) };
    const { error: debErr } = await admin.from("wallets").update({ balance: Number(wallet.balance) - requiredXof }).eq("id", wallet.id);
    if (debErr) throw new Error(debErr.message);
    try {
      const res = await SW.fundWithdrawNfcCard({ card_id: data.card_id, amount: Number(data.amountUsd), type: "fund" });
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

  // ---------- KYC (no-op stubs : page KYC supprimée du flow) ----------
  async submitFullKyc() { return { ok: true }; },
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

  // Supprime complètement un utilisateur (profil, wallets, cartes, transactions, kyc, retraits, rôles, auth.users)
  async adminDeleteUser({ data, user, admin }) {
    if (!(await isAdmin(admin, user.id))) throw new Error("Forbidden");
    const uid = String(data.user_id);
    if (!uid) throw new Error("user_id manquant");
    if (uid === user.id) throw new Error("Vous ne pouvez pas supprimer votre propre compte admin.");
    await admin.from("withdrawals").delete().eq("user_id", uid);
    await admin.from("transactions").delete().eq("user_id", uid);
    await admin.from("cards").delete().eq("user_id", uid);
    await admin.from("kyc_submissions").delete().eq("user_id", uid);
    await admin.from("wallets").delete().eq("user_id", uid);
    await admin.from("user_roles").delete().eq("user_id", uid);
    await admin.from("profiles").delete().eq("id", uid);
    const { error } = await admin.auth.admin.deleteUser(uid);
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  // Ajuste manuellement le solde d'un portefeuille utilisateur (crédit ou débit)
  async adminAdjustWallet({ data, user, admin }) {
    if (!(await isAdmin(admin, user.id))) throw new Error("Forbidden");
    const uid = String(data.user_id);
    const currency = String(data.currency || "XOF").toUpperCase();
    const delta = Number(data.amount); // positif = crédit, négatif = débit
    const note = String(data.note || "").slice(0, 500);
    if (!uid) throw new Error("user_id manquant");
    if (!Number.isFinite(delta) || delta === 0) throw new Error("Montant invalide");
    const { data: wallet } = await admin.from("wallets").select("id,balance").eq("user_id", uid).eq("currency", currency).maybeSingle();
    if (!wallet) throw new Error(`Portefeuille ${currency} introuvable pour cet utilisateur`);
    const newBalance = Number(wallet.balance) + delta;
    if (newBalance < 0) throw new Error(`Solde insuffisant — solde actuel ${wallet.balance} ${currency}`);
    const { error: uErr } = await admin.from("wallets").update({ balance: newBalance }).eq("id", wallet.id);
    if (uErr) throw new Error(uErr.message);
    await admin.from("transactions").insert({
      user_id: uid,
      type: delta > 0 ? "admin_credit" : "admin_debit",
      status: "success",
      amount: Math.abs(delta),
      currency,
      description: (delta > 0 ? "Crédit manuel admin" : "Débit manuel admin") + (note ? ` — ${note}` : ""),
      metadata: { admin_id: user.id, note },
    });
    return { ok: true, new_balance: newBalance };
  },

  async adminReviewKyc({ data, user, admin }) {
    if (!(await isAdmin(admin, user.id))) throw new Error("Forbidden");
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