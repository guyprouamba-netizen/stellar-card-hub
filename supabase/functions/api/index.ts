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

// Rembourse le solde USD restant d'une carte vers le portefeuille XOF de son propriétaire.
// Convertit avec le taux courant. Idempotent par provider_ref unique.
async function refundCardBalanceToWallet(admin: any, userId: string, providerCardId: string, balanceUsd: number) {
  if (!userId || !Number.isFinite(balanceUsd) || balanceUsd <= 0) return;
  const cfg = await loadPricingConfig(admin);
  const xof = Math.floor(Number(balanceUsd) * Number(cfg.usd_rate_xof || 0));
  if (xof <= 0) return;
  const ref = `cardrefund:${providerCardId}`;
  const { data: existing } = await admin.from("transactions").select("id").eq("provider_ref", ref).maybeSingle();
  if (existing) return;
  const { data: w } = await admin.from("wallets").select("id,balance").eq("user_id", userId).eq("currency", "XOF").maybeSingle();
  if (w) await admin.from("wallets").update({ balance: Number(w.balance) + xof }).eq("id", w.id);
  await admin.from("transactions").insert({
    user_id: userId, type: "refund", status: "success",
    amount: xof, currency: "XOF", provider: "internal", provider_ref: ref,
    description: `Remboursement carte résiliée : ${balanceUsd.toFixed(2)} USD → ${xof} XOF`,
    metadata: { card_id: providerCardId, balance_usd: balanceUsd, rate: cfg.usd_rate_xof },
  });
}

// Rembourse intégralement le coût d'émission d'une carte quand l'émetteur n'a pas pu
// la provisionner (status "failed" sans PAN). Idempotent.
async function refundFailedCardIssuance(admin: any, userId: string, providerCardId: string) {
  const ref = `cardissuerefund:${providerCardId}`;
  const { data: existing } = await admin.from("transactions").select("id").eq("provider_ref", ref).maybeSingle();
  if (existing) return { refunded: 0, alreadyRefunded: true };
  // Retrouve la transaction d'émission originale.
  const { data: issueTx } = await admin
    .from("transactions")
    .select("id,amount,currency,user_id")
    .eq("provider_ref", providerCardId)
    .eq("type", "card_issue")
    .eq("status", "success")
    .maybeSingle();
  if (!issueTx || !issueTx.amount || Number(issueTx.amount) <= 0) return { refunded: 0, alreadyRefunded: false };
  const xof = Number(issueTx.amount);
  const uid = userId || (issueTx.user_id as string);
  const { data: w } = await admin.from("wallets").select("id,balance").eq("user_id", uid).eq("currency", "XOF").maybeSingle();
  if (w) await admin.from("wallets").update({ balance: Number(w.balance) + xof }).eq("id", w.id);
  await admin.from("transactions").insert({
    user_id: uid, type: "refund", status: "success",
    amount: xof, currency: "XOF", provider: "internal", provider_ref: ref,
    description: `Remboursement émission carte échouée chez l'émetteur (${xof} XOF)`,
    metadata: { card_id: providerCardId, reason: "issuer_failed_provisioning", original_tx: issueTx.id },
  });
  return { refunded: xof, alreadyRefunded: false };
}

// Détecte si la réponse Strowallet indique un échec définitif de provisionnement
// (status "failed" et aucun PAN). On ne traite PAS "pending"/"processing" comme un échec.
function isIssuerFailed(details: { status: string | null; number: string | null }) {
  const st = String(details.status || "").toLowerCase();
  const noPan = !details.number || /^0+$/.test(String(details.number || ""));
  return st === "failed" && noPan;
}

// Seuil (USD) de dépôt cumulé requis pour révéler PAN complet + CVV.
const CARD_DETAILS_UNLOCK_USD = 5;

// Masque UNIQUEMENT le CVV tant que le dépôt cumulé < 5 USD.
// Le PAN complet, la date d'expiration et le titulaire restent visibles pour
// que le client voit qu'il possède bien une vraie carte — seul le code de
// sécurité est verrouillé, l'incitant à recharger 5 USD.
function maskCardDetailsResponse(res: any, _last4: string | null) {
  const clone = JSON.parse(JSON.stringify(res ?? {}));
  const nodes: any[] = [clone?.response?.card_detail, clone?.data?.card_detail, clone?.card_detail].filter(Boolean);
  for (const n of nodes) {
    n.cvv = null; n.cvv2 = null; n.card_cvv = null;
  }
  return clone;
}

// Crédite le parrain du nouvel utilisateur d'une récompense fixe (par défaut
// 1000 XOF) à chaque carte achetée. Idempotent par (referred_id, card_id).
async function payReferralCardReward(admin: any, referredUserId: string, providerCardId: string) {
  const ref = `refreward:${referredUserId}:${providerCardId}`;
  const { data: existing } = await admin.from("transactions").select("id").eq("provider_ref", ref).maybeSingle();
  if (existing) return { paid: 0, alreadyPaid: true };
  const { data: link } = await admin.from("referrals")
    .select("id,referrer_id,cards_rewarded,total_reward_xof")
    .eq("referred_id", referredUserId).maybeSingle();
  if (!link) return { paid: 0, alreadyPaid: false };
  // Montant configurable via platform_config.referral_reward_xof (JSONB number)
  const { data: cfgRow } = await admin.from("platform_config").select("value").eq("key", "referral_reward_xof").maybeSingle();
  const rewardXof = Math.max(0, Math.floor(Number((cfgRow as any)?.value ?? 1000)));
  if (rewardXof <= 0) return { paid: 0, alreadyPaid: false };
  const { data: w } = await admin.from("wallets").select("id,balance").eq("user_id", link.referrer_id).eq("currency", "XOF").maybeSingle();
  if (!w) return { paid: 0, alreadyPaid: false };
  await admin.from("wallets").update({ balance: Number(w.balance) + rewardXof }).eq("id", w.id);
  await admin.from("transactions").insert({
    user_id: link.referrer_id, type: "referral_reward", status: "success",
    amount: rewardXof, currency: "XOF", provider: "internal", provider_ref: ref,
    description: `Récompense parrainage — carte achetée par un filleul (+${rewardXof} XOF)`,
    metadata: { referred_id: referredUserId, card_id: providerCardId },
  });
  await admin.from("referrals").update({
    cards_rewarded: Number(link.cards_rewarded || 0) + 1,
    total_reward_xof: Number(link.total_reward_xof || 0) + rewardXof,
  }).eq("id", link.id);
  return { paid: rewardXof, alreadyPaid: false };
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
      userClient.from("cards").select("id,brand,last4,currency,balance,status,failed_attempts,auto_frozen_at,created_at,total_funded_usd").eq("user_id", userId).order("created_at", { ascending: false }),
      userClient.from("profiles").select("full_name,email,phone,is_active,country,avatar_url").eq("id", userId).maybeSingle(),
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
    const amt = Number(data?.amountUsd ?? 0);
    const cost = amt > 0
      ? computeCardCost(amt, cfg)
      : { amountUsd: 0, feeXof: cfg.card_issue_fee_xof, strowalletFixedUsd: 0, strowalletPctUsd: 0, rateXof: cfg.usd_rate_xof, loadedToStrowalletUsd: 0, loadedToStrowalletXof: 0, totalXof: cfg.card_issue_fee_xof };
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
    // Financement initial 100 % optionnel : 0 par défaut. La carte est créée à 0 $.
    const amountUsdRaw = Number(data?.amountUsd ?? 0);
    const amountUsd = Number.isFinite(amountUsdRaw) && amountUsdRaw > 0 ? amountUsdRaw : 0;
    // Prix = frais d'émission fixe (4500 XOF par défaut) + éventuel financement.
    const cost = amountUsd > 0
      ? computeCardCost(amountUsd, cfg)
      : { amountUsd: 0, feeXof: cfg.card_issue_fee_xof, strowalletFixedUsd: 0, strowalletPctUsd: 0, rateXof: cfg.usd_rate_xof, loadedToStrowalletUsd: 0, loadedToStrowalletXof: 0, totalXof: cfg.card_issue_fee_xof };
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
      let finalLast4 = last4; let finalBrand = brand; let finalBalance = amountUsd; let finalMeta: any = { create: res };
      let providerStatus = "";
      if (card_id) {
        // Force-activation : on tente status=active ET action=unfreeze, sans planter si l'émetteur
        // n'a pas encore fini le provisionnement (status pending/processing/failed transitoire).
        try { await SW.nfcCardStatus(card_id, "active"); } catch { /* tolérant */ }
        try { await SW.nfcCardAction(card_id, "unfreeze"); } catch { /* tolérant */ }
        try {
          const det = await SW.getNfcCardDetails(card_id);
          const d = SW.extractCardDetails(det);
          if (d.last4) finalLast4 = d.last4;
          if (d.brand) finalBrand = d.brand;
          if (d.balance !== null) finalBalance = d.balance;
          providerStatus = String(d.status || "").toLowerCase();
          finalMeta = { create: res, details: det };
        } catch { /* tolérant */ }
      }
      // On marque "active" par défaut. Si l'émetteur n'a pas encore livré le PAN
      // (statut transitoire pending/processing/failed), on garde "pending" et le polling
      // côté cardDetails/refreshCard finira la synchro sans jamais geler la carte.
      const finalStatus: "active" | "pending" =
        providerStatus === "active" || providerStatus === "" ? "active" : "pending";
      await admin.from("cards").insert({
        user_id: userId, provider: "strowallet",
        provider_card_id: card_id,
        brand: (finalBrand || "visa").toLowerCase(), last4: finalLast4, currency: "USD",
        balance: finalBalance, status: finalStatus, metadata: finalMeta,
        total_funded_usd: amountUsd,
      });
      await admin.from("transactions").insert({
        user_id: userId, type: "card_issue", status: "success",
        amount: requiredXof, currency: "XOF", provider: "strowallet",
        provider_ref: card_id,
        description: amountUsd > 0
          ? `Émission carte NFC ${amountUsd} USD (frais ${cfg.card_issue_fee_xof} XOF)`
          : `Émission carte NFC (frais ${cfg.card_issue_fee_xof} XOF, solde 0 USD)`,
        metadata: { pricing: cost },
      });
      // Récompense parrainage (best-effort, silencieuse en cas d'erreur)
      try { if (card_id) await payReferralCardReward(admin, userId, card_id); } catch { /* silencieux */ }
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
    const { data: card } = await userClient.from("cards").select("user_id,total_funded_usd,last4").eq("provider_card_id", data.card_id).maybeSingle();
    if (!card || card.user_id !== user.id) {
      if (!(await isAdmin(admin, user.id))) throw new Error("Carte introuvable");
    }
    let res = await SW.getNfcCardDetails(data.card_id);
    let details = SW.extractCardDetails(res);
    const status = String(details.status || "").toLowerCase();
    const missingPan = !details.number || /^0+$/.test(String(details.number || ""));
    // Échec définitif côté émetteur : on rembourse l'émission et on marque la carte
    // comme résiliée pour que l'utilisateur puisse en créer une nouvelle.
    if (isIssuerFailed(details)) {
      const ownerId = (card?.user_id as string) || user.id;
      const refund = await refundFailedCardIssuance(admin, ownerId, data.card_id);
      await admin.from("cards").update({
        status: "terminated",
        last4: null,
        balance: 0,
        metadata: { provider_status: "failed", terminated_reason: "issuer_failed_provisioning", refunded_xof: refund.refunded, details: res },
      }).eq("provider_card_id", data.card_id);
      return { ok: false, error: "L'émetteur n'a pas pu provisionner cette carte. Vos fonds ont été remboursés sur votre portefeuille XOF. Vous pouvez créer une nouvelle carte.", provider_status: "failed", data: res };
    }
    // Si la carte n'est pas active OU si l'émetteur n'a pas encore renvoyé le PAN/CVV,
    // on force un dégel + re-fetch pour récupérer les infos complètes.
    if (status === "frozen" || (status && status !== "active") || missingPan) {
      const { data: local } = await admin.from("cards").select("status,auto_frozen_at").eq("provider_card_id", data.card_id).maybeSingle();
      const frozenBySecurity = !!local?.auto_frozen_at || String(local?.status || "") === "frozen_auto";
      if (!frozenBySecurity) {
        try {
          const ensured = await SW.ensureNfcCardActive(data.card_id);
          res = ensured.details;
          details = SW.extractCardDetails(res);
          const finalStatus = String(details.status || "").toLowerCase() === "active" || (details.number && details.cvv) ? "active" : "pending";
          await admin.from("cards").update({
            status: finalStatus,
            failed_attempts: 0,
            auto_frozen_at: null,
            ...(details.last4 ? { last4: String(details.last4) } : {}),
            ...(details.brand ? { brand: String(details.brand).toLowerCase() } : {}),
            ...(details.balance !== null && Number.isFinite(Number(details.balance)) ? { balance: Number(details.balance) } : {}),
            metadata: { provider_sync: ensured.attempts, details: res },
          }).eq("provider_card_id", data.card_id);
        } catch (e) {
          // On NE marque PAS la carte comme gelée côté plateforme : on garde "pending"
          // pour que le prochain polling/refresh tente à nouveau l'activation.
          await admin.from("cards").update({
            status: "pending",
            metadata: { provider_unfreeze_error: (e as Error).message, checked_at: new Date().toISOString(), details: res },
          }).eq("provider_card_id", data.card_id);
          return { ok: false, error: (e as Error).message, provider_status: details.status, data: res };
        }
      }
    }
    // Verrou : PAN + CVV masqués tant que le dépôt cumulé sur la carte < 5 USD.
    const funded = Number(card?.total_funded_usd ?? 0);
    const isOwnerAdmin = await isAdmin(admin, user.id);
    if (!isOwnerAdmin && funded < CARD_DETAILS_UNLOCK_USD) {
      return { ...maskCardDetailsResponse(res, (card?.last4 ?? null) as string | null), _locked: true, funded_usd: funded, unlock_usd: CARD_DETAILS_UNLOCK_USD };
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
      // Échec définitif d'émission côté Strowallet → remboursement + résiliation locale.
      if (isIssuerFailed(d)) {
        const ownerId = (card?.user_id as string) || user.id;
        const refund = await refundFailedCardIssuance(admin, ownerId, data.card_id);
        await admin.from("cards").update({
          status: "terminated", last4: null, balance: 0,
          metadata: { provider_status: "failed", terminated_reason: "issuer_failed_provisioning", refunded_xof: refund.refunded, details: res },
        }).eq("provider_card_id", data.card_id);
        return { ok: false, error: "L'émetteur n'a pas pu provisionner cette carte. Vos fonds ont été remboursés sur votre portefeuille XOF.", data: res };
      }
      const upd: any = { metadata: res };
      if (d.last4) upd.last4 = String(d.last4);
      if (d.brand) upd.brand = String(d.brand).toLowerCase();
      if (d.balance !== null && Number.isFinite(Number(d.balance))) upd.balance = Number(d.balance);
      const st = String(d.status || "").toLowerCase();
      if (st === "terminated" || st === "deleted" || st === "cancelled" || st === "canceled") {
        // La carte a été résiliée par l'émetteur (souvent après plusieurs tentatives échouées).
        // On marque comme résiliée ET on rembourse automatiquement le solde restant
        // vers le portefeuille XOF du client.
        const { data: local } = await admin.from("cards").select("status,balance,auto_frozen_at,metadata,user_id").eq("provider_card_id", data.card_id).maybeSingle();
        upd.status = "terminated";
        upd.metadata = { ...(local?.metadata as any || {}), provider_status: st, terminated_reason: "issuer_terminated_after_failed_attempts", details: res };
        if (local && String(local.status) !== "terminated") {
          await refundCardBalanceToWallet(admin, local.user_id as string, data.card_id, Number(local.balance || 0));
          upd.balance = 0;
        }
      } else if (st === "active") {
        upd.status = "active";
        upd.failed_attempts = 0;
        upd.auto_frozen_at = null;
      }
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
            upd.status = "pending";
            upd.metadata = { provider_unfreeze_error: (e as Error).message, details: res };
          }
        }
      }
      await admin.from("cards").update(upd).eq("provider_card_id", data.card_id);
      return { ok: true, data: res };
    } catch (e) { return { ok: false, error: (e as Error).message }; }
  },

  async cardAction({ data, user, admin, userClient }) {
    const { data: card } = await userClient.from("cards").select("id,user_id,balance,status").eq("provider_card_id", data.card_id).maybeSingle();
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
      if (data.action === "terminate" && card && String(card.status) !== "terminated") {
        await refundCardBalanceToWallet(admin, card.user_id as string, data.card_id, Number(card.balance || 0));
        await admin.from("cards").update({ balance: 0 }).eq("provider_card_id", data.card_id);
      }
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
    const { data: card } = await userClient.from("cards").select("user_id,status").eq("provider_card_id", data.card_id).maybeSingle();
    if (!card || card.user_id !== user.id) {
      if (!(await isAdmin(admin, user.id))) return { ok: false, error: "Carte introuvable" };
    }
    const ownerId = card?.user_id || user.id;
    // Toujours servir l'historique conservé en BDD (disponible même si la carte est résiliée).
    const fallbackFromDb = async () => {
      const { data: rows } = await admin.from("transactions")
        .select("amount,currency,status,description,created_at,metadata,provider_ref")
        .eq("user_id", ownerId).eq("type", "card_tx")
        .order("created_at", { ascending: false }).limit(200);
      const items = (rows || [])
        .filter((r: any) => (r.metadata as any)?.card_id === data.card_id)
        .map((r: any) => ({
          date: r.created_at, amount: r.amount, currency: r.currency, status: r.status,
          description: r.description, ...(r.metadata as any)?.raw,
        }));
      return { ok: true, data: { response: items }, source: "cache" as const };
    };
    // Carte résiliée : l'API émetteur ne renvoie plus rien — on sert le cache.
    if (String(card?.status || "") === "terminated") return await fallbackFromDb();
    try {
      const res = await SW.getNfcCardHistory(data.card_id);
      // Journalisation : enregistre chaque transaction carte dans `transactions` (dédup par provider_ref).
      const raw: any = (res as any)?.response ?? (res as any)?.data ?? res;
      const items: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.response) ? raw.response : Array.isArray(raw?.data) ? raw.data : [];
      for (const t of items) {
        const sig = `cardtx:${data.card_id}:${t.id || t.transaction_id || t.reference || `${t.date || t.created_at || ""}-${t.amount || ""}`}`;
        const { data: existing } = await admin.from("transactions").select("id").eq("provider_ref", sig).maybeSingle();
        if (existing) continue;
        await admin.from("transactions").insert({
          user_id: ownerId, type: "card_tx",
          status: String(t.status || t.transaction_status || "success").toLowerCase().includes("fail") ? "failed" : "success",
          amount: Number(t.amount || 0), currency: String(t.currency || "USD"),
          provider: "issuer", provider_ref: sig,
          description: t.description || t.narration || t.type || "Transaction carte",
          metadata: { card_id: data.card_id, raw: t },
        });
      }
      return { ok: true, data: res };
    } catch (_e) {
      // En cas d'échec côté émetteur, on sert le cache local.
      return await fallbackFromDb();
    }
  },

  async fundCard({ data, user, admin, userClient }) {
    const userId = user.id;
    const { data: card } = await userClient.from("cards").select("id,user_id,balance,provider_card_id,status").eq("provider_card_id", data.card_id).maybeSingle();
    if (!card || card.user_id !== userId) return { ok: false, error: "Carte introuvable" };
    if (card.status === "terminated") return { ok: false, error: "Carte résiliée — impossible de la recharger. Émettez une nouvelle carte." };
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
      // Incrémente le solde ET le cumul historique (pour déblocage des infos > 5 USD).
      const { data: fresh } = await admin.from("cards").select("total_funded_usd").eq("id", card.id).maybeSingle();
      await admin.from("cards").update({
        balance: Number(card.balance) + Number(data.amountUsd),
        total_funded_usd: Number(fresh?.total_funded_usd ?? 0) + Number(data.amountUsd),
      }).eq("id", card.id);
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
      .select("id,brand,last4,currency,balance,status,provider_card_id,failed_attempts,auto_frozen_at,created_at,metadata,total_funded_usd")
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
      // Clé dédiée cash-out (scope payout) avec fallback sur la clé générale.
      const apiKey = Deno.env.get("YENGAPAY_CASHOUT_API_KEY") || Deno.env.get("YENGAPAY_API_KEY");
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

  // Sweep all pending deposit transactions for the current user (or all users for admin)
  // and verify each one against YengaPay; credits wallet for any that are confirmed paid.
  // Designed to run on Dashboard load to make recharges self-healing without webhook.
  async reconcileMyDeposits({ user, admin }) {
    const apiKey = Deno.env.get("YENGAPAY_API_KEY");
    const groupId = Deno.env.get("YENGAPAY_GROUP_ID");
    if (!apiKey || !groupId) return { ok: false, error: "YengaPay env missing" };
    const userId = user.id;
    const isAdm = await isAdmin(admin, userId);
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    let q = admin.from("transactions")
      .select("id,user_id,amount,status,metadata,provider_ref,currency,type")
      .eq("type", "deposit").eq("status", "pending").eq("provider", "yengapay")
      .gte("created_at", cutoff).order("created_at", { ascending: false }).limit(50);
    if (!isAdm) q = q.eq("user_id", userId);
    const { data: pendings } = await q;
    let credited = 0, failed = 0, stillPending = 0;
    for (const tx of pendings ?? []) {
      const piid = (tx.metadata as any)?.paymentIntentId;
      const candidates: string[] = [];
      if (piid) candidates.push(`https://api.yengapay.com/api/v1/groups/${groupId}/payment-intent/${piid}`);
      candidates.push(`https://api.yengapay.com/api/v1/groups/${groupId}/payment-intent/reference/${tx.provider_ref}`);
      let body: any = null; let ok = false;
      for (const u of candidates) {
        try {
          const r = await fetch(u, { headers: { "x-api-key": apiKey } });
          const t = await r.text(); try { body = JSON.parse(t); } catch { body = t; }
          if (r.ok) { ok = true; break; }
        } catch { /* try next */ }
      }
      if (!ok) { stillPending++; continue; }
      const st = String(body?.status || body?.paymentStatus || body?.data?.status || "").toUpperCase();
      const paid = ["DONE", "SUCCESS", "SUCCEEDED", "COMPLETED", "PAID"].includes(st);
      const isFailed = ["FAILED", "CANCELLED", "CANCELED", "EXPIRED", "REJECTED"].includes(st);
      if (paid) {
        const { data: updated } = await admin.from("transactions")
          .update({ status: "success", metadata: { ...(tx.metadata as any), reconcile: body } })
          .eq("id", tx.id).eq("status", "pending").select("id").maybeSingle();
        if (updated) {
          const { data: w } = await admin.from("wallets").select("id,balance").eq("user_id", tx.user_id).eq("currency", "XOF").maybeSingle();
          if (w) await admin.from("wallets").update({ balance: Number(w.balance) + Number(tx.amount) }).eq("id", w.id);
          credited++;
        }
      } else if (isFailed) {
        await admin.from("transactions").update({ status: "failed", metadata: { ...(tx.metadata as any), reconcile: body } }).eq("id", tx.id).eq("status", "pending");
        failed++;
      } else {
        stillPending++;
      }
    }
    return { ok: true, scanned: pendings?.length ?? 0, credited, failed, pending: stillPending };
  },

  // ---------- Admin ----------
  async adminOverview({ user, admin }) {
    if (!(await isAdmin(admin, user.id))) throw new Error("Forbidden");
    const [users, cards, txs, kyc, withdrawals] = await Promise.all([
      admin.from("profiles").select("id,full_name,email,phone,country,is_active,strowallet_customer_id,created_at").order("created_at", { ascending: false }).limit(100),
      admin.from("cards").select("id,user_id,brand,last4,status,balance,currency,failed_attempts,auto_frozen_at,created_at,total_funded_usd,provider_card_id").order("created_at", { ascending: false }).limit(100),
      admin.from("transactions").select("id,user_id,type,status,amount,currency,description,created_at").order("created_at", { ascending: false }).limit(50),
      admin.from("kyc_submissions").select("*").order("submitted_at", { ascending: false, nullsFirst: false }).limit(50),
      admin.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    // Enrichit chaque carte avec le propriétaire (nom + email) pour le tableau admin.
    const cardOwnerIds = Array.from(new Set((cards.data ?? []).map((c: any) => c.user_id).filter(Boolean)));
    let ownerMap: Record<string, any> = {};
    if (cardOwnerIds.length > 0) {
      const { data: owners } = await admin.from("profiles").select("id,full_name,email,phone").in("id", cardOwnerIds);
      ownerMap = Object.fromEntries((owners ?? []).map((o: any) => [o.id, o]));
    }
    const enrichedCards = (cards.data ?? []).map((c: any) => ({ ...c, owner: ownerMap[c.user_id] || null }));
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
    return { users: users.data ?? [], cards: enrichedCards, transactions: txs.data ?? [], kyc: kyc.data ?? [], withdrawals: withdrawals.data ?? [], flows };
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

  // Admin modifie nom, email et/ou mot de passe d'un utilisateur.
  async adminUpdateUser({ data, user, admin }) {
    if (!(await isAdmin(admin, user.id))) throw new Error("Forbidden");
    const uid = String(data.user_id || "");
    if (!uid) throw new Error("user_id manquant");
    const authPatch: Record<string, any> = {};
    if (typeof data.email === "string" && data.email.trim()) authPatch.email = data.email.trim();
    if (typeof data.password === "string" && data.password.length >= 6) authPatch.password = data.password;
    if (Object.keys(authPatch).length > 0) {
      const { error } = await admin.auth.admin.updateUserById(uid, authPatch);
      if (error) throw new Error(error.message);
    }
    const profPatch: Record<string, any> = {};
    if (typeof data.full_name === "string") profPatch.full_name = data.full_name.trim();
    if (typeof data.email === "string" && data.email.trim()) profPatch.email = data.email.trim();
    if (Object.keys(profPatch).length > 0) {
      const { error } = await admin.from("profiles").update(profPatch).eq("id", uid);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  },

  // L'utilisateur met à jour son propre profil (nom + téléphone + avatar).
  async updateMyProfile({ data, user, admin }) {
    const patch: Record<string, any> = {};
    if (typeof data.full_name === "string") patch.full_name = data.full_name.trim().slice(0, 120);
    if (typeof data.avatar_url === "string") patch.avatar_url = data.avatar_url.slice(0, 1024);
    if (typeof data.phone === "string") patch.phone = data.phone.trim().slice(0, 40);
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await admin.from("profiles").update(patch).eq("id", user.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  // L'utilisateur change son mot de passe (vérifie l'ancien).
  async updateMyPassword({ data, user, admin }) {
    const current = String(data.current_password || "");
    const next = String(data.new_password || "");
    if (next.length < 6) return { ok: false, error: "Le nouveau mot de passe doit contenir au moins 6 caractères" };
    if (!current) return { ok: false, error: "Mot de passe actuel requis" };
    const check = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const { error: signErr } = await check.auth.signInWithPassword({ email: user.email!, password: current });
    if (signErr) return { ok: false, error: "Mot de passe actuel incorrect" };
    const { error } = await admin.auth.admin.updateUserById(user.id, { password: next });
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  // Génère une URL signée pour uploader une photo de profil dans le bucket `avatars`.
  async createAvatarUploadUrl({ data, user, admin }) {
    const ext = String(data?.ext || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { data: signed, error } = await admin.storage.from("avatars").createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message ?? "Upload URL error");
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  },

  // Renvoie une URL signée de lecture pour un avatar (bucket privé).
  async getAvatarSignedUrl({ data, admin }) {
    const path = String(data?.path || "");
    if (!path) return { ok: false, error: "path requis" };
    const { data: signed, error } = await admin.storage.from("avatars").createSignedUrl(path, 60 * 60);
    if (error || !signed) return { ok: false, error: error?.message || "URL signée impossible" };
    return { ok: true, url: signed.signedUrl };
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
    const allowedNumbers = ["card_issue_fee_xof", "usd_rate_xof", "strowallet_fixed_fee_usd", "strowallet_pct_fee", "referral_reward_xof"];
    const allowedStrings = ["whatsapp_group_url"];
    const updates: Array<{ key: string; value: string }> = [];
    for (const k of allowedNumbers) {
      if (data?.[k] !== undefined && data[k] !== null && data[k] !== "") {
        const n = Number(data[k]);
        if (!Number.isFinite(n) || n < 0) return { ok: false, error: `Valeur invalide pour ${k}` };
        updates.push({ key: k, value: String(n) });
      }
    }
    for (const k of allowedStrings) {
      if (typeof data?.[k] === "string" && data[k].trim() !== "") {
        // JSONB string : stocker en JSON valide entre guillemets
        updates.push({ key: k, value: JSON.stringify(data[k].trim().slice(0, 500)) });
      }
    }
    for (const u of updates) {
      await admin.from("platform_config").upsert({ key: u.key, value: u.value }, { onConflict: "key" });
    }
    const cfg = await loadPricingConfig(admin);
    const { data: extras } = await admin.from("platform_config").select("key,value").in("key", ["whatsapp_group_url", "referral_reward_xof"]);
    const extrasMap: Record<string, any> = {};
    for (const r of extras ?? []) extrasMap[r.key] = r.value;
    return { ok: true, config: { ...cfg, ...extrasMap } };
  },

  // Récupère la config publique (URL WhatsApp) — accessible à tout utilisateur connecté.
  async getPublicConfig({ admin }) {
    const { data } = await admin.from("platform_config").select("key,value")
      .in("key", ["whatsapp_group_url", "referral_reward_xof"]);
    const out: Record<string, any> = {};
    for (const r of data ?? []) out[r.key] = r.value;
    return { ok: true, ...out };
  },

  // Retourne les infos de parrainage du user courant : code, lien, filleuls, gains.
  async getMyReferralStats({ user, admin }) {
    const { data: profile } = await admin.from("profiles").select("referral_code").eq("id", user.id).maybeSingle();
    const code = (profile as any)?.referral_code || null;
    const { data: rows } = await admin.from("referrals")
      .select("id,referred_id,cards_rewarded,total_reward_xof,created_at,status")
      .eq("referrer_id", user.id).order("created_at", { ascending: false });
    const list = rows ?? [];
    let referredMap: Record<string, any> = {};
    if (list.length > 0) {
      const ids = list.map((r: any) => r.referred_id);
      const { data: profs } = await admin.from("profiles").select("id,full_name,email,created_at").in("id", ids);
      referredMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p]));
    }
    const totalXof = list.reduce((s: number, r: any) => s + Number(r.total_reward_xof || 0), 0);
    const totalCards = list.reduce((s: number, r: any) => s + Number(r.cards_rewarded || 0), 0);
    return {
      ok: true,
      code,
      total_referred: list.length,
      total_cards_rewarded: totalCards,
      total_earned_xof: totalXof,
      referrals: list.map((r: any) => ({
        id: r.id,
        created_at: r.created_at,
        status: r.status,
        cards_rewarded: r.cards_rewarded,
        total_reward_xof: r.total_reward_xof,
        referred: referredMap[r.referred_id] || null,
      })),
    };
  },

  // Vue admin : tous les parrains + leurs filleuls et gains cumulés.
  async adminReferralsOverview({ user, admin }) {
    if (!(await isAdmin(admin, user.id))) throw new Error("Forbidden");
    const { data: rows } = await admin.from("referrals")
      .select("id,referrer_id,referred_id,cards_rewarded,total_reward_xof,status,created_at")
      .order("created_at", { ascending: false }).limit(500);
    const list = rows ?? [];
    const ids = Array.from(new Set(list.flatMap((r: any) => [r.referrer_id, r.referred_id])));
    let map: Record<string, any> = {};
    if (ids.length) {
      const { data: profs } = await admin.from("profiles").select("id,full_name,email").in("id", ids);
      map = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p]));
    }
    // Regroupe par parrain
    const byRef: Record<string, any> = {};
    for (const r of list) {
      const k = r.referrer_id;
      if (!byRef[k]) byRef[k] = { referrer: map[k] || { id: k }, referrer_id: k, total_referred: 0, total_earned_xof: 0, total_cards_rewarded: 0, filleuls: [] };
      byRef[k].total_referred++;
      byRef[k].total_earned_xof += Number(r.total_reward_xof || 0);
      byRef[k].total_cards_rewarded += Number(r.cards_rewarded || 0);
      byRef[k].filleuls.push({
        referral_id: r.id, referred_id: r.referred_id, created_at: r.created_at,
        cards_rewarded: r.cards_rewarded, total_reward_xof: r.total_reward_xof,
        status: r.status, referred: map[r.referred_id] || null,
      });
    }
    return { ok: true, groups: Object.values(byRef) };
  },

  // ============================================================
  // BUSINESS MODULE (merchant accounts, payment links, API keys)
  // ============================================================

  async listMyBusinesses({ user, admin }) {
    const { data, error } = await admin.from("businesses")
      .select("id,name,slug,description,logo_url,contact_email,contact_phone,country,status,fee_bps,balance,created_at")
      .eq("owner_id", user.id).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async createBusiness({ data, user, admin }) {
    const name = String(data?.name || "").trim();
    if (name.length < 2) throw new Error("Nom du business requis");
    const slug = await ensureUniqueSlug(admin, "businesses", slugify(name));
    const { data: row, error } = await admin.from("businesses").insert({
      owner_id: user.id, name, slug,
      description: data?.description || null,
      contact_email: data?.contact_email || user.email,
      contact_phone: data?.contact_phone || null,
      logo_url: data?.logo_url || null,
      country: data?.country || "BF",
      status: "active",
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  },

  async updateBusiness({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.id);
    const patch: Record<string, any> = {};
    for (const k of ["name", "description", "contact_email", "contact_phone", "logo_url"]) {
      if (data?.[k] !== undefined) patch[k] = data[k];
    }
    const { data: row, error } = await admin.from("businesses").update(patch).eq("id", data.id).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  },

  async listPaymentLinks({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    const { data: rows, error } = await admin.from("payment_links")
      .select("*").eq("business_id", data.business_id).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  },

  async createPaymentLink({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    const title = String(data?.title || "").trim();
    if (title.length < 2) throw new Error("Titre requis");
    const slug = await ensureUniqueSlug(admin, "payment_links", slugify(title) + "-" + randomHex(2));
    const { data: row, error } = await admin.from("payment_links").insert({
      business_id: data.business_id, slug, title,
      description: data?.description || null,
      amount: data?.amount ?? null,
      min_amount: data?.min_amount ?? null,
      max_amount: data?.max_amount ?? null,
      currency: data?.currency || "XOF",
      redirect_url: data?.redirect_url || null,
      callback_url: data?.callback_url || null,
      project_id: data?.project_id || null,
      product_id: data?.product_id || null,
      channel: data?.channel || "online",
      status: "active",
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  },

  async updatePaymentLink({ data, user, admin }) {
    const { data: link } = await admin.from("payment_links").select("business_id").eq("id", data.id).maybeSingle();
    if (!link) throw new Error("Lien introuvable");
    await assertBusinessOwner(admin, user.id, link.business_id);
    const patch: Record<string, any> = {};
    for (const k of ["title", "description", "amount", "min_amount", "max_amount", "status", "redirect_url", "callback_url"]) {
      if (data?.[k] !== undefined) patch[k] = data[k];
    }
    const { data: row, error } = await admin.from("payment_links").update(patch).eq("id", data.id).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  },

  async listLinkPayments({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    const q = admin.from("payment_link_payments").select("*").eq("business_id", data.business_id).order("created_at", { ascending: false }).limit(100);
    const { data: rows, error } = data?.link_id ? await q.eq("link_id", data.link_id) : await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  },

  async listApiKeys({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    const { data: rows, error } = await admin.from("business_api_keys")
      .select("id,label,key_prefix,mode,last_used_at,revoked_at,created_at")
      .eq("business_id", data.business_id).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  },

  async createApiKey({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    const mode = data?.mode === "test" ? "test" : "live";
    const raw = `fip_${mode === "test" ? "test" : "live"}_${randomHex(24)}`;
    const key_hash = await sha256Hex(raw);
    const key_prefix = raw.slice(0, 16);
    const { data: row, error } = await admin.from("business_api_keys").insert({
      business_id: data.business_id, label: data?.label || "default",
      mode, key_prefix, key_hash,
    }).select("id,label,key_prefix,mode,created_at").single();
    if (error) throw new Error(error.message);
    // raw retourné une seule fois — afficher au marchand puis oublier
    return { ...row, api_key: raw };
  },

  async revokeApiKey({ data, user, admin }) {
    const { data: key } = await admin.from("business_api_keys").select("id,business_id").eq("id", data.id).maybeSingle();
    if (!key) throw new Error("Clé introuvable");
    await assertBusinessOwner(admin, user.id, key.business_id);
    await admin.from("business_api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", data.id);
    return { ok: true };
  },

  // Permet au marchand de retirer son solde vers son wallet utilisateur (XOF)
  async cashoutBusinessBalance({ data, user, admin }) {
    const biz = await assertBusinessOwner(admin, user.id, data.business_id);
    const { data: b } = await admin.from("businesses").select("balance,owner_id").eq("id", biz.id).single();
    const amount = Number(b?.balance || 0);
    if (amount <= 0) return { ok: false, error: "Solde nul" };
    const { data: w } = await admin.from("wallets").select("id,balance").eq("user_id", b.owner_id).eq("currency", "XOF").maybeSingle();
    if (!w) return { ok: false, error: "Wallet XOF introuvable" };
    await admin.from("wallets").update({ balance: Number(w.balance) + amount }).eq("id", w.id);
    await admin.from("businesses").update({ balance: 0 }).eq("id", biz.id);
    await admin.from("transactions").insert({
      user_id: b.owner_id, type: "deposit", status: "success",
      amount, currency: "XOF",
      description: `Transfert solde business → wallet`,
      metadata: { business_id: biz.id },
    });
    return { ok: true, transferred: amount };
  },

  // ===========================================================
  // PROJECTS
  // ===========================================================
  async listProjects({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    const { data: rows, error } = await admin.from("projects")
      .select("*").eq("business_id", data.business_id).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  },
  async createProject({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    const name = String(data?.name || "").trim();
    if (name.length < 2) throw new Error("Nom requis");
    let baseSlug = slugify(name);
    let slug = baseSlug;
    for (let i = 0; i < 6; i++) {
      const { data: ex } = await admin.from("projects").select("id").eq("slug", slug).maybeSingle();
      if (!ex) break;
      slug = `${baseSlug}-${randomHex(2)}`;
    }
    const { data: row, error } = await admin.from("projects").insert({
      business_id: data.business_id, name, slug,
      description: data?.description || null,
      logo_url: data?.logo_url || null,
      cover_url: data?.cover_url || null,
      currency: data?.currency || "XOF",
      financial_goal: data?.financial_goal || 0,
      goal_deadline: data?.goal_deadline || null,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  },
  async updateProject({ data, user, admin }) {
    const { data: p } = await admin.from("projects").select("business_id").eq("id", data.id).maybeSingle();
    if (!p) throw new Error("Projet introuvable");
    await assertBusinessOwner(admin, user.id, p.business_id);
    const patch: Record<string, any> = {};
    for (const k of ["name", "description", "logo_url", "cover_url", "currency", "financial_goal", "goal_deadline", "status"]) {
      if (data?.[k] !== undefined) patch[k] = data[k];
    }
    const { data: row, error } = await admin.from("projects").update(patch).eq("id", data.id).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  },
  async deleteProject({ data, user, admin }) {
    const { data: p } = await admin.from("projects").select("business_id").eq("id", data.id).maybeSingle();
    if (!p) throw new Error("Projet introuvable");
    await assertBusinessOwner(admin, user.id, p.business_id);
    await admin.from("projects").delete().eq("id", data.id);
    return { ok: true };
  },

  // ===========================================================
  // PRODUCTS
  // ===========================================================
  async listProducts({ data, user, admin }) {
    const { data: p } = await admin.from("projects").select("business_id").eq("id", data.project_id).maybeSingle();
    if (!p) throw new Error("Projet introuvable");
    await assertBusinessOwner(admin, user.id, p.business_id);
    const { data: rows, error } = await admin.from("products")
      .select("*, product_media(id,type,url,position)").eq("project_id", data.project_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  },
  async createProduct({ data, user, admin }) {
    const { data: p } = await admin.from("projects").select("business_id").eq("id", data.project_id).maybeSingle();
    if (!p) throw new Error("Projet introuvable");
    await assertBusinessOwner(admin, user.id, p.business_id);
    const name = String(data?.name || "").trim();
    if (name.length < 2) throw new Error("Nom requis");
    const slug = slugify(name) + "-" + randomHex(2);
    const { data: row, error } = await admin.from("products").insert({
      project_id: data.project_id, business_id: p.business_id,
      name, slug,
      description: data?.description || null,
      price: Number(data?.price || 0),
      currency: data?.currency || "XOF",
      sku: data?.sku || null,
      stock: data?.stock ?? null,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  },
  async updateProduct({ data, user, admin }) {
    const { data: prod } = await admin.from("products").select("business_id").eq("id", data.id).maybeSingle();
    if (!prod) throw new Error("Produit introuvable");
    await assertBusinessOwner(admin, user.id, prod.business_id);
    const patch: Record<string, any> = {};
    for (const k of ["name", "description", "price", "currency", "sku", "stock", "status"]) {
      if (data?.[k] !== undefined) patch[k] = data[k];
    }
    const { data: row, error } = await admin.from("products").update(patch).eq("id", data.id).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  },
  async deleteProduct({ data, user, admin }) {
    const { data: prod } = await admin.from("products").select("business_id").eq("id", data.id).maybeSingle();
    if (!prod) throw new Error("Produit introuvable");
    await assertBusinessOwner(admin, user.id, prod.business_id);
    await admin.from("products").delete().eq("id", data.id);
    return { ok: true };
  },
  async addProductMedia({ data, user, admin }) {
    const { data: prod } = await admin.from("products").select("business_id").eq("id", data.product_id).maybeSingle();
    if (!prod) throw new Error("Produit introuvable");
    await assertBusinessOwner(admin, user.id, prod.business_id);
    const { data: row, error } = await admin.from("product_media").insert({
      product_id: data.product_id, type: data.type || "image", url: data.url, position: data.position || 0,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  },
  async deleteProductMedia({ data, user, admin }) {
    const { data: m } = await admin.from("product_media").select("product_id, products!inner(business_id)").eq("id", data.id).maybeSingle();
    if (!m) throw new Error("Média introuvable");
    await assertBusinessOwner(admin, user.id, (m as any).products.business_id);
    await admin.from("product_media").delete().eq("id", data.id);
    return { ok: true };
  },

  // ===========================================================
  // INVOICES / RECEIPTS
  // ===========================================================
  async listInvoices({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    const q = admin.from("invoices").select("*").eq("business_id", data.business_id).order("created_at", { ascending: false }).limit(100);
    const { data: rows, error } = data?.project_id ? await q.eq("project_id", data.project_id) : await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  },
  async createInvoice({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    // Auto-number: BIZSLUG-YYYYMM-XXXX
    const { data: biz } = await admin.from("businesses").select("slug").eq("id", data.business_id).single();
    const ym = new Date().toISOString().slice(0, 7).replace("-", "");
    const { count } = await admin.from("invoices").select("id", { count: "exact", head: true }).eq("business_id", data.business_id);
    const number = `${(biz?.slug || "INV").toUpperCase().slice(0, 6)}-${ym}-${String((count || 0) + 1).padStart(4, "0")}`;
    const items = Array.isArray(data.items) ? data.items : [];
    const subtotal = items.reduce((s: number, it: any) => s + Number(it.qty || 1) * Number(it.price || 0), 0);
    const tax = Number(data.tax || 0);
    const total = subtotal + tax;
    const { data: row, error } = await admin.from("invoices").insert({
      business_id: data.business_id, project_id: data.project_id || null,
      payment_id: data.payment_id || null,
      kind: data.kind || "receipt", number,
      customer_name: data.customer_name || null,
      customer_email: data.customer_email || null,
      customer_phone: data.customer_phone || null,
      items, subtotal, tax, total,
      currency: data.currency || "XOF",
      status: data.status || "issued",
      pdf_url: data.pdf_url || null,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  },
  async updateInvoice({ data, user, admin }) {
    const { data: inv } = await admin.from("invoices").select("business_id").eq("id", data.id).maybeSingle();
    if (!inv) throw new Error("Facture introuvable");
    await assertBusinessOwner(admin, user.id, inv.business_id);
    const patch: Record<string, any> = {};
    for (const k of ["status", "pdf_url", "customer_name", "customer_email", "customer_phone"]) {
      if (data?.[k] !== undefined) patch[k] = data[k];
    }
    const { data: row, error } = await admin.from("invoices").update(patch).eq("id", data.id).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  },

  // ===========================================================
  // ACTION PLANS
  // ===========================================================
  async listActionPlans({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    const q = admin.from("action_plans").select("*").eq("business_id", data.business_id).order("created_at", { ascending: false });
    const { data: rows, error } = data?.project_id ? await q.eq("project_id", data.project_id) : await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  },
  async createActionPlan({ data, user, admin }) {
    const { data: p } = await admin.from("projects").select("business_id").eq("id", data.project_id).maybeSingle();
    if (!p) throw new Error("Projet introuvable");
    await assertBusinessOwner(admin, user.id, p.business_id);
    const { data: row, error } = await admin.from("action_plans").insert({
      project_id: data.project_id, business_id: p.business_id,
      title: data.title, description: data.description || null,
      steps: data.steps || [], due_date: data.due_date || null,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  },
  async updateActionPlan({ data, user, admin }) {
    const { data: pl } = await admin.from("action_plans").select("business_id").eq("id", data.id).maybeSingle();
    if (!pl) throw new Error("Plan introuvable");
    await assertBusinessOwner(admin, user.id, pl.business_id);
    const patch: Record<string, any> = {};
    for (const k of ["title", "description", "steps", "status", "due_date"]) {
      if (data?.[k] !== undefined) patch[k] = data[k];
    }
    const { data: row, error } = await admin.from("action_plans").update(patch).eq("id", data.id).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  },
  async deleteActionPlan({ data, user, admin }) {
    const { data: pl } = await admin.from("action_plans").select("business_id").eq("id", data.id).maybeSingle();
    if (!pl) throw new Error("Plan introuvable");
    await assertBusinessOwner(admin, user.id, pl.business_id);
    await admin.from("action_plans").delete().eq("id", data.id);
    return { ok: true };
  },

  // ===========================================================
  // BUSINESS DASHBOARD (financial summary + traffic light)
  // ===========================================================
  async getBusinessDashboard({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();
    const prev = new Date(Date.now() - 60 * 86400_000).toISOString();
    const [{ data: biz }, { data: projects }, { data: pays30 }, { data: paysPrev }] = await Promise.all([
      admin.from("businesses").select("id,name,balance,fee_bps,currency").eq("id", data.business_id).single(),
      admin.from("projects").select("id,name,balance,financial_goal,goal_deadline,currency,status").eq("business_id", data.business_id),
      admin.from("payment_link_payments").select("amount,net_amount,fee_amount,status,created_at,project_id").eq("business_id", data.business_id).gte("created_at", since),
      admin.from("payment_link_payments").select("net_amount,status").eq("business_id", data.business_id).gte("created_at", prev).lt("created_at", since),
    ]);
    const ok30 = (pays30 || []).filter((p: any) => p.status === "success");
    const okPrev = (paysPrev || []).filter((p: any) => p.status === "success");
    const total30 = ok30.reduce((s: number, p: any) => s + Number(p.net_amount || 0), 0);
    const totalPrev = okPrev.reduce((s: number, p: any) => s + Number(p.net_amount || 0), 0);
    const trend = totalPrev > 0 ? (total30 - totalPrev) / totalPrev : (total30 > 0 ? 1 : 0);
    // Traffic light: vert si tendance >+10% ET total30>0 ; rouge si tendance <-20% ou total30=0 ; jaune sinon
    const light = total30 === 0 || trend < -0.2 ? "red" : trend > 0.1 ? "green" : "yellow";
    // Daily series last 30 days
    const byDay: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
      byDay[d] = 0;
    }
    for (const p of ok30) {
      const d = String(p.created_at).slice(0, 10);
      if (d in byDay) byDay[d] += Number(p.net_amount || 0);
    }
    return {
      business: biz, projects: projects || [],
      kpis: { total30, totalPrev, trend, count30: ok30.length, light },
      series: Object.entries(byDay).map(([date, value]) => ({ date, value })),
    };
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