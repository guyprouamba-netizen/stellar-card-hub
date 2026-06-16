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

const YENGAPAY_CASHOUT_METHODS = ["ORANGE_MONEY", "MOOV_MONEY", "TELECEL_MONEY", "SANK_MONEY", "WAVE_MONEY"] as const;

function mapCashoutMethod(operator?: string | null) {
  const opNorm = String(operator || "").toLowerCase();
  if (opNorm.includes("orange")) return "ORANGE_MONEY";
  if (opNorm.includes("moov")) return "MOOV_MONEY";
  if (opNorm.includes("telecel")) return "TELECEL_MONEY";
  if (opNorm.includes("sank")) return "SANK_MONEY";
  if (opNorm.includes("wave")) return "WAVE_MONEY";
  return null;
}

function normalizeBfPhone(phone?: string | null) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("226")) return `+${digits}`;
  return `+226${digits}`;
}

function uniqueCashoutMethods(preferred?: string | null) {
  return Array.from(new Set([preferred, ...YENGAPAY_CASHOUT_METHODS].filter(Boolean))) as string[];
}

// ============= Business helpers =============
function slugify(input: string) {
  return String(input || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "biz";
}
function randomHex(bytes = 16) {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function sha256Hex(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function ensureUniqueSlug(admin: any, table: "businesses" | "payment_links", base: string) {
  let slug = base;
  for (let i = 0; i < 6; i++) {
    const { data } = await admin.from(table).select("id").eq("slug", slug).maybeSingle();
    if (!data) return slug;
    slug = `${base}-${randomHex(2)}`;
  }
  return `${base}-${randomHex(3)}`;
}
async function assertBusinessOwner(admin: any, userId: string, businessId: string) {
  const { data } = await admin.from("businesses").select("id,owner_id").eq("id", businessId).maybeSingle();
  if (!data) throw new Error("Business introuvable");
  if (data.owner_id !== userId && !(await isAdmin(admin, userId))) throw new Error("Forbidden");
  return data;
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
      // La nouvelle API NFC ne demande aucune validation : la carte doit être livrée active.
      // Certaines cartes reviennent en "frozen" / "pending" par défaut : on force l'activation.
      let finalLast4 = last4; let finalBrand = brand; let finalBalance = amountUsd; let finalMeta: any = res;
      if (card_id) {
        try { await SW.unfreezeNfcCard(card_id); } catch { /* tolérant */ }
        try {
          const det = await SW.getNfcCardDetails(card_id);
          const d = SW.extractCardDetails(det);
          if (d.last4) finalLast4 = d.last4;
          if (d.brand) finalBrand = d.brand;
          if (d.balance !== null) finalBalance = d.balance;
          finalMeta = { create: res, details: det };
        } catch { /* tolérant */ }
      }
      const finalStatus: "active" = "active";
      await admin.from("cards").insert({
        user_id: userId, provider: "strowallet",
        provider_card_id: card_id,
        brand: (finalBrand || "visa").toLowerCase(), last4: finalLast4, currency: "USD",
        balance: finalBalance, status: finalStatus, metadata: finalMeta,
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
    let res = await SW.getNfcCardDetails(data.card_id);
    let details = SW.extractCardDetails(res);
    if (String(details.status || "").toLowerCase() === "frozen") {
      const { data: local } = await admin.from("cards").select("status,auto_frozen_at").eq("provider_card_id", data.card_id).maybeSingle();
      const frozenBySecurity = !!local?.auto_frozen_at || String(local?.status || "") === "frozen_auto";
      if (!frozenBySecurity) {
        try {
          const ensured = await SW.ensureNfcCardActive(data.card_id);
          res = ensured.details;
          details = SW.extractCardDetails(res);
          await admin.from("cards").update({
            status: "active",
            failed_attempts: 0,
            auto_frozen_at: null,
            metadata: { provider_sync: ensured.attempts, details: res },
          }).eq("provider_card_id", data.card_id);
        } catch (e) {
          await admin.from("cards").update({
            status: "frozen",
            metadata: { provider_unfreeze_error: (e as Error).message, checked_at: new Date().toISOString() },
          }).eq("provider_card_id", data.card_id);
          return { ok: false, error: (e as Error).message, provider_status: details.status, data: res };
        }
      }
    }
    return res;
  },

  // Rafraîchit la carte depuis Strowallet et met à jour la BDD (utile si webhook non reçu)
  async refreshCard({ data, user, admin, userClient }) {
    const { data: card } = await userClient.from("cards").select("id,user_id").eq("provider_card_id", data.card_id).maybeSingle();
    if (!card || card.user_id !== user.id) {
      if (!(await isAdmin(admin, user.id))) return { ok: false, error: "Carte introuvable" };
    }
    try {
      const res = await SW.getNfcCardDetails(data.card_id);
      const d = SW.extractCardDetails(res);
      const upd: any = { metadata: res };
      if (d.last4) upd.last4 = String(d.last4);
      if (d.brand) upd.brand = String(d.brand).toLowerCase();
      // Ne pas écraser le statut depuis l'API : seul l'utilisateur via cardAction peut le changer.
      if (d.balance !== null && Number.isFinite(Number(d.balance))) upd.balance = Number(d.balance);
      // Si Strowallet a remis la carte en "frozen" sans action user, on tente une réactivation silencieuse.
      const st = String(d.status || "").toLowerCase();
      if (st === "frozen") {
        const { data: local } = await admin.from("cards").select("status,auto_frozen_at").eq("provider_card_id", data.card_id).maybeSingle();
        const frozenBySecurity = !!local?.auto_frozen_at || String(local?.status || "") === "frozen_auto";
        if (!frozenBySecurity) {
          try {
            const ensured = await SW.ensureNfcCardActive(data.card_id);
            const parsed = SW.extractCardDetails(ensured.details);
            upd.status = "active";
            upd.metadata = { provider_sync: ensured.attempts, details: ensured.details };
            if (parsed.last4) upd.last4 = String(parsed.last4);
            if (parsed.brand) upd.brand = String(parsed.brand).toLowerCase();
            if (parsed.balance !== null && Number.isFinite(Number(parsed.balance))) upd.balance = Number(parsed.balance);
          } catch (e) {
            upd.status = "frozen";
            upd.metadata = { provider_unfreeze_error: (e as Error).message, details: res };
          }
        }
      }
      await admin.from("cards").update(upd).eq("provider_card_id", data.card_id);
      return { ok: true, data: res };
    } catch (e) { return { ok: false, error: (e as Error).message }; }
  },

  async cardAction({ data, user, admin, userClient }) {
    const { data: card } = await userClient.from("cards").select("id,user_id").eq("provider_card_id", data.card_id).maybeSingle();
    if (!card || card.user_id !== user.id) {
      if (!(await isAdmin(admin, user.id))) return { ok: false, error: "Carte introuvable" };
    }
    // L'API NFC ne propose que active/frozen. Une "résiliation" est mappée sur "frozen" + flag.
    // Blocage : après 2 tentatives de résiliation échouées, on refuse les suivantes.
    if (data.action === "terminate") {
      const { data: row } = await admin.from("cards").select("metadata,status").eq("provider_card_id", data.card_id).maybeSingle();
      const attempts = Number((row?.metadata as any)?.terminate_attempts || 0);
      if (attempts >= 2) {
        return { ok: false, error: "Résiliation bloquée après 2 tentatives échouées. Contactez le support." };
      }
    }
    const target: "active" | "frozen" =
      data.action === "freeze" ? "frozen" :
      data.action === "unfreeze" ? "active" :
      data.action === "terminate" ? "frozen" : "active";
    try {
      const res = data.action === "freeze"
        ? await SW.freezeNfcCard(data.card_id)
        : data.action === "unfreeze"
          ? await SW.ensureNfcCardActive(data.card_id)
          : await SW.freezeNfcCard(data.card_id);
      const patch: any = { status: data.action === "terminate" ? "terminated" : target };
      if (target === "active") { patch.failed_attempts = 0; patch.auto_frozen_at = null; }
      if (data.action === "unfreeze") patch.metadata = { provider_sync: (res as any)?.attempts, details: (res as any)?.details };
      await admin.from("cards").update(patch).eq("provider_card_id", data.card_id);
      return { ok: true, data: res };
    } catch (e) {
      if (data.action === "terminate") {
        const { data: row } = await admin.from("cards").select("metadata").eq("provider_card_id", data.card_id).maybeSingle();
        const meta = (row?.metadata as any) || {};
        meta.terminate_attempts = Number(meta.terminate_attempts || 0) + 1;
        meta.last_terminate_error = (e as Error).message;
        await admin.from("cards").update({ metadata: meta }).eq("provider_card_id", data.card_id);
      }
      return { ok: false, error: (e as Error).message };
    }
  },

  async listCardTransactions({ data, user, admin, userClient }) {
    const { data: card } = await userClient.from("cards").select("user_id").eq("provider_card_id", data.card_id).maybeSingle();
    if (!card || card.user_id !== user.id) {
      if (!(await isAdmin(admin, user.id))) return { ok: false, error: "Carte introuvable" };
    }
    try {
      const res = await SW.getNfcCardHistory(data.card_id);
      // Journalisation : enregistre chaque transaction carte dans `transactions` (dédup par provider_ref).
      const raw: any = (res as any)?.response ?? (res as any)?.data ?? res;
      const items: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.response) ? raw.response : Array.isArray(raw?.data) ? raw.data : [];
      const ownerId = card?.user_id || user.id;
      for (const t of items) {
        const sig = `cardtx:${data.card_id}:${t.id || t.transaction_id || t.reference || `${t.date || t.created_at || ""}-${t.amount || ""}`}`;
        const { data: existing } = await admin.from("transactions").select("id").eq("provider_ref", sig).maybeSingle();
        if (existing) continue;
        await admin.from("transactions").insert({
          user_id: ownerId, type: "card_tx",
          status: String(t.status || t.transaction_status || "success").toLowerCase().includes("fail") ? "failed" : "success",
          amount: Number(t.amount || 0), currency: String(t.currency || "USD"),
          provider: "strowallet", provider_ref: sig,
          description: t.description || t.narration || t.type || "Transaction carte",
          metadata: { card_id: data.card_id, raw: t },
        });
      }
      return { ok: true, data: res };
    } catch (e) { return { ok: false, error: (e as Error).message }; }
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

  async withdrawCard({ data, user, admin, userClient }) {
    const userId = user.id;
    const { data: card } = await userClient.from("cards").select("id,user_id,balance,provider_card_id,status").eq("provider_card_id", data.card_id).maybeSingle();
    if (!card || card.user_id !== userId) return { ok: false, error: "Carte introuvable" };
    if (card.status === "terminated") return { ok: false, error: "Carte résiliée" };
    const amountUsd = Number(data.amountUsd);
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) return { ok: false, error: "Montant USD invalide" };
    if (Number(card.balance) < amountUsd) return { ok: false, error: "Solde carte insuffisant", available: Number(card.balance) };
    const cfg = await loadPricingConfig(admin);
    // Strowallet n'expose pas de frais de retrait carte explicite → 0,5 USD par défaut.
    const feeUsd = 0.5;
    const netUsd = +(amountUsd - feeUsd).toFixed(4);
    if (netUsd <= 0) return { ok: false, error: `Montant trop faible — frais ${feeUsd} USD appliqués` };
    const netXof = Math.floor(netUsd * cfg.usd_rate_xof);
    try {
      const res = await SW.fundWithdrawNfcCard({ card_id: data.card_id, amount: amountUsd, type: "withdraw" });
      await admin.from("cards").update({ balance: Number(card.balance) - amountUsd }).eq("id", card.id);
      const { data: w } = await admin.from("wallets").select("id,balance").eq("user_id", userId).eq("currency", "XOF").maybeSingle();
      if (w) await admin.from("wallets").update({ balance: Number(w.balance) + netXof }).eq("id", w.id);
      await admin.from("transactions").insert({
        user_id: userId, type: "card_withdraw", status: "success",
        amount: netXof, currency: "XOF", provider: "strowallet", provider_ref: data.card_id,
        description: `Retrait carte ${amountUsd} USD → ${netXof} XOF (frais ${feeUsd} USD)`,
        metadata: { amountUsd, feeUsd, netUsd, netXof, rate: cfg.usd_rate_xof, response: res },
      });
      return { ok: true, data: res, netXof, feeUsd, netUsd };
    } catch (e) {
      await admin.from("transactions").insert({
        user_id: userId, type: "card_withdraw", status: "failed",
        amount: amountUsd, currency: "USD", provider: "strowallet", provider_ref: data.card_id,
        description: "Retrait carte échoué", metadata: { error: (e as Error).message },
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
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount < 500) return { ok: false, error: "Montant minimum 500 XOF" };
    const { data: w } = await userClient.from("wallets").select("id,balance").eq("user_id", userId).eq("currency", "XOF").maybeSingle();
    if (!w || Number(w.balance) < amount) return { ok: false, error: "Solde XOF insuffisant" };
    // Débit immédiat
    await admin.from("wallets").update({ balance: Number(w.balance) - amount }).eq("id", w.id);
    const { data: row, error } = await admin.from("withdrawals").insert({
      user_id: userId, amount, currency: "XOF", method: data.method,
      destination: { operator: data.operator, phone: data.phone, account: data.account, holder: data.holder },
      status: "pending",
    }).select("id").single();
    if (error) throw new Error(error.message);

    // Auto-payout via YengaPay cash-out pour Mobile Money
    if (data.method === "mobile_money") {
      const apiKey = Deno.env.get("YENGAPAY_API_KEY");
      const groupId = Deno.env.get("YENGAPAY_GROUP_ID");
      const projectId = Deno.env.get("YENGAPAY_PROJECT_ID");
      const destNumber = normalizeBfPhone(data.phone);
      const preferredMethod = mapCashoutMethod(data.operator);
      const cashoutMethods = uniqueCashoutMethods(preferredMethod);
      const holder = String(data.holder || user.user_metadata?.full_name || user.email || "").slice(0, 120);
      const baseDestination = { operator: data.operator, phone: destNumber, account: data.account, holder };
      if (!destNumber) {
        await admin.from("wallets").update({ balance: Number(w.balance) }).eq("id", w.id);
        await admin.from("withdrawals").update({ status: "failed", admin_note: "Numéro Mobile Money invalide" }).eq("id", row.id);
        return { ok: false, error: "Numéro Mobile Money invalide" };
      }
      if (!apiKey || !groupId || !projectId) {
        await admin.from("withdrawals").update({ destination: baseDestination }).eq("id", row.id);
        await admin.from("transactions").insert({
          user_id: userId, type: "withdrawal", status: "pending",
          amount, currency: "XOF", provider: "yengapay",
          description: `Demande de retrait ${data.method} ${data.operator} — validation manuelle`,
          provider_ref: row.id, metadata: { reason: "missing_yengapay_config" },
        });
        return { ok: true, id: row.id, status: "submitted", note: "Config YengaPay manquante — validation manuelle" };
      }
      try {
        const url = `https://api.yengapay.com/api/v1/groups/${groupId}/cash-out`;
        const attempts: Array<{ method: string; httpStatus: number; body: unknown }> = [];
        let acceptedBody: any = null;
        let acceptedMethod: string | null = null;
        for (const cashoutMethod of cashoutMethods) {
          const payRes = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": apiKey },
            body: JSON.stringify({
              cashoutMethod,
              description: `Retrait FASO-INVEST PAY ${holder}`.trim(),
              amount, destNumber, groupId, projectId,
            }),
          });
          const text = await payRes.text(); let body: any = text;
          try { body = JSON.parse(text); } catch { /**/ }
          attempts.push({ method: cashoutMethod, httpStatus: payRes.status, body });
          if (!payRes.ok) continue;
          acceptedBody = body;
          acceptedMethod = cashoutMethod;
          break;
        }

        if (!acceptedBody || !acceptedMethod) {
          const note = JSON.stringify(attempts).slice(0, 500);
          // Aucun opérateur n'a accepté → refund immédiat et marquage failed
          await admin.from("wallets").update({ balance: Number(w.balance) }).eq("id", w.id);
          await admin.from("withdrawals").update({
            status: "failed",
            destination: { ...baseDestination, yengapay_attempts: attempts },
            admin_note: note,
          }).eq("id", row.id);
          await admin.from("transactions").insert({
            user_id: userId, type: "withdrawal", status: "failed",
            amount, currency: "XOF", provider: "yengapay",
            provider_ref: row.id,
            description: "Retrait refusé — aucun opérateur n'a accepté",
            metadata: { attempts, destNumber },
          });
          await admin.from("transactions").insert({
            user_id: userId, type: "withdrawal_refund", status: "success",
            amount, currency: "XOF",
            description: "Remboursement automatique — retrait refusé",
          });
          return { ok: false, id: row.id, status: "failed", error: "Aucun opérateur n'a accepté ce retrait. Montant remboursé." };
        }

        const provStatus = String(acceptedBody?.status || "PENDING").toUpperCase();
        const mapped = ["SUCCESS", "COMPLETED", "PAID", "SUCCESSFUL", "DONE"].includes(provStatus)
          ? "paid"
          : ["PENDING", "PROCESSING", "IN_PROGRESS", "ACCEPTED"].includes(provStatus)
            ? "processing"
            : "processing";
        const newDest = { ...baseDestination, operator: acceptedMethod, yengapay: acceptedBody, yengapay_attempts: attempts };
        await admin.from("withdrawals").update({ status: mapped, destination: newDest }).eq("id", row.id);
        await admin.from("transactions").insert({
          user_id: userId, type: "withdrawal",
          status: mapped === "paid" ? "success" : "pending",
          amount, currency: "XOF", provider: "yengapay",
          provider_ref: acceptedBody?.id || row.id,
          description: `Retrait auto ${acceptedMethod} ${destNumber}`,
          metadata: { response: acceptedBody, attempts },
        });
        return { ok: true, id: row.id, status: mapped, provider: acceptedBody };
      } catch (e) {
        // Erreur réseau / exception → refund et marquage failed
        await admin.from("wallets").update({ balance: Number(w.balance) }).eq("id", w.id);
        await admin.from("withdrawals").update({
          status: "failed",
          admin_note: (e as Error).message.slice(0, 500),
        }).eq("id", row.id);
        await admin.from("transactions").insert({
          user_id: userId, type: "withdrawal", status: "failed",
          amount, currency: "XOF", provider: "yengapay", provider_ref: row.id,
          description: `Retrait échoué — ${(e as Error).message.slice(0, 100)}`,
          metadata: { error: (e as Error).message },
        });
        await admin.from("transactions").insert({
          user_id: userId, type: "withdrawal_refund", status: "success",
          amount, currency: "XOF",
          description: "Remboursement automatique — erreur passerelle",
        });
        return { ok: false, id: row.id, status: "failed", error: (e as Error).message };
      }
    }

    // Méthode bancaire ou opérateur non supporté → validation manuelle admin
    await admin.from("transactions").insert({
      user_id: userId, type: "withdrawal", status: "pending",
      amount, currency: "XOF",
      description: `Demande de retrait ${data.method} ${data.operator}`,
      provider_ref: row.id,
    });
    return { ok: true, id: row.id, status: "pending" };
  },

  async initRecharge({ data, user, admin }) {
    const userId = user.id;
    const reference = `FIP-${Date.now()}-${userId.slice(0, 8)}`;
    const baseReturn = String(data.returnUrl || "");
    const returnUrl = baseReturn
      ? (baseReturn + (baseReturn.includes("?") ? "&" : "?") + `recharge=${encodeURIComponent(reference)}`)
      : "";
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
        ...(returnUrl ? { returnUrl, successUrl: returnUrl, cancelUrl: returnUrl } : {}),
      }),
    });
    const text = await res.text(); let body: any = text;
    try { body = JSON.parse(text); } catch { /**/ }
    if (!res.ok) throw new Error(`YengaPay ${res.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
    const paymentIntentId = body?.id || body?.paymentIntentId || body?.paymentIntent?.id || body?.data?.id || null;
    const { error: txErr } = await admin.from("transactions").insert({
      user_id: userId, type: "deposit", status: "pending",
      amount: Number(data.amount), currency: "XOF",
      provider: "yengapay", provider_ref: reference,
      description: "Recharge YengaPay",
      metadata: { paymentIntentId, init: body },
    });
    if (txErr) throw new Error(txErr.message);
    return { ok: true, checkout_url: body?.checkoutPageUrlWithPaymentToken || body?.checkout_url || body?.paymentUrl, reference, paymentIntentId, raw: body };
  },

  // Vérifie manuellement le statut d'une recharge auprès de YengaPay et crédite le wallet si payé.
  // Idempotent : ne crédite qu'une fois (transaction.status passe de "pending" à "success").
  async verifyRecharge({ data, user, admin }) {
    const userId = user.id;
    const reference = String(data?.reference || "");
    if (!reference) return { ok: false, error: "reference manquante" };
    const { data: tx } = await admin
      .from("transactions").select("id,user_id,amount,status,metadata,provider_ref")
      .eq("provider_ref", reference).maybeSingle();
    if (!tx) return { ok: false, error: "Transaction introuvable" };
    if (tx.user_id !== userId && !(await isAdmin(admin, userId))) return { ok: false, error: "Forbidden" };
    if (tx.status === "success") return { ok: true, status: "success", credited: false };
    if (tx.status === "failed") return { ok: true, status: "failed", credited: false };

    const apiKey = Deno.env.get("YENGAPAY_API_KEY");
    const groupId = Deno.env.get("YENGAPAY_GROUP_ID");
    if (!apiKey || !groupId) return { ok: false, error: "YengaPay env missing" };
    const piid = (tx.metadata as any)?.paymentIntentId;
    const candidates: string[] = [];
    if (piid) candidates.push(`https://api.yengapay.com/api/v1/groups/${groupId}/payment-intent/${piid}`);
    candidates.push(`https://api.yengapay.com/api/v1/groups/${groupId}/payment-intent/reference/${reference}`);
    let body: any = null; let ok = false;
    for (const u of candidates) {
      try {
        const r = await fetch(u, { headers: { "x-api-key": apiKey } });
        const t = await r.text(); try { body = JSON.parse(t); } catch { body = t; }
        if (r.ok) { ok = true; break; }
      } catch { /* try next */ }
    }
    if (!ok) return { ok: false, error: "YengaPay lookup failed", raw: body };
    const st = String(body?.status || body?.paymentStatus || body?.data?.status || "").toUpperCase();
    const paid = ["DONE", "SUCCESS", "SUCCEEDED", "COMPLETED", "PAID"].includes(st);
    const failed = ["FAILED", "CANCELLED", "CANCELED", "EXPIRED", "REJECTED"].includes(st);
    if (paid) {
      // Crédit atomique idempotent
      const { data: updated } = await admin
        .from("transactions").update({ status: "success", metadata: { ...(tx.metadata as any), verify: body } })
        .eq("id", tx.id).eq("status", "pending").select("id").maybeSingle();
      if (updated) {
        const { data: w } = await admin.from("wallets").select("id,balance").eq("user_id", tx.user_id).eq("currency", "XOF").maybeSingle();
        if (w) await admin.from("wallets").update({ balance: Number(w.balance) + Number(tx.amount) }).eq("id", w.id);
        return { ok: true, status: "success", credited: true };
      }
      return { ok: true, status: "success", credited: false };
    }
    if (failed) {
      await admin.from("transactions").update({ status: "failed", metadata: { ...(tx.metadata as any), verify: body } }).eq("id", tx.id).eq("status", "pending");
      return { ok: true, status: "failed", credited: false };
    }
    return { ok: true, status: "pending", credited: false, providerStatus: st };
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

  // ---------- Paramètres plateforme (taux + frais) ----------
  async adminGetConfig({ user, admin }) {
    if (!(await isAdmin(admin, user.id))) throw new Error("Forbidden");
    const cfg = await loadPricingConfig(admin);
    return { ok: true, config: cfg };
  },

  async adminUpdateConfig({ data, user, admin }) {
    if (!(await isAdmin(admin, user.id))) throw new Error("Forbidden");
    const allowed = ["card_issue_fee_xof", "usd_rate_xof", "strowallet_fixed_fee_usd", "strowallet_pct_fee"];
    const updates: Array<{ key: string; value: string }> = [];
    for (const k of allowed) {
      if (data?.[k] !== undefined && data[k] !== null && data[k] !== "") {
        const n = Number(data[k]);
        if (!Number.isFinite(n) || n < 0) return { ok: false, error: `Valeur invalide pour ${k}` };
        updates.push({ key: k, value: String(n) });
      }
    }
    for (const u of updates) {
      await admin.from("platform_config").upsert({ key: u.key, value: u.value }, { onConflict: "key" });
    }
    const cfg = await loadPricingConfig(admin);
    return { ok: true, config: cfg };
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