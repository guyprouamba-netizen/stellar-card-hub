// Universal authenticated API dispatcher.
// Body shape: { fn: string, data?: any }
// Auth: requires a valid Supabase JWT in Authorization header.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import * as SW from "../_shared/strowallet.ts";
import { computeCardCost, computeFundCost, loadPricingConfig } from "../_shared/pricing.ts";
import { sendEmail } from "../_shared/email.ts";
import { notifyEvent as notifySms, sendSmsRaw } from "../_shared/sms.ts";
import * as YP from "../_shared/yengapay.ts";
import { handle2FA, handleRegistrationOTP } from "./2fa.ts";
import { normalizeBfPhone } from "../_shared/sms.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

// ---- Notifications e-mail (best-effort, non bloquant) ----
function txEmailHtml(opts: { title: string; intro: string; amount: number; currency: string; reference?: string }) {
  const fmt = new Intl.NumberFormat("fr-FR").format(opts.amount);
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#f4f6fb;font-family:Arial,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
    <table role="presentation" width="560" style="background:#fff;border-radius:16px;padding:32px;max-width:560px"><tr><td>
      <h1 style="margin:0 0 8px;font-size:20px">${opts.title}</h1>
      <p style="margin:0 0 24px;color:#64748b;font-size:14px">${opts.intro}</p>
      <table width="100%" style="font-size:14px;border-collapse:collapse">
        <tr><td style="padding:8px 0;color:#64748b">Montant</td><td style="padding:8px 0;text-align:right"><b>${fmt} ${opts.currency}</b></td></tr>
        ${opts.reference ? `<tr><td style="padding:8px 0;color:#64748b">Référence</td><td style="padding:8px 0;text-align:right;font-family:monospace;font-size:12px">${opts.reference}</td></tr>` : ""}
        <tr><td style="padding:8px 0;color:#64748b">Date</td><td style="padding:8px 0;text-align:right">${new Date().toLocaleString("fr-FR")}</td></tr>
      </table>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
      <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center">FASO INVEST PAY — Notification automatique</p>
    </td></tr></table>
  </td></tr></table></body></html>`;
}
async function notifyUser(admin: any, userId: string, subject: string, html: string, text: string) {
  try {
    const { data: p } = await admin.from("profiles").select("email,full_name").eq("id", userId).maybeSingle();
    if (!p?.email) return;
    await sendEmail({ to: p.email, subject, html, text });
  } catch (e) { console.error("notifyUser failed", e); }
}

// ---- Rate limit par utilisateur (best-effort, non bloquant si table absente) ----
async function assertUserRateLimit(admin: any, userId: string, bucket: string, perMin: number) {
  const sinceIso = new Date(Date.now() - 60_000).toISOString();
  const b = `user:${userId}:${bucket}`;
  const { count } = await admin.from("rate_limit_hits")
    .select("id", { count: "exact", head: true })
    .eq("bucket", b).gte("hit_at", sinceIso);
  if ((count || 0) >= perMin) {
    throw new Error("Trop de requêtes, patientez une minute.");
  }
  await admin.from("rate_limit_hits").insert({ bucket: b, ip: "0.0.0.0" });
}

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
  // Use .from('user_roles') with the admin client to bypass any RLS on the RPC itself
  const { data, error } = await admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (error) {
    console.error("isAdmin check failed:", error);
    return false;
  }
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
function isIssuerFailed(details: { status: string | null; number: string | null; cardNumberUrl?: string | null }) {
  const st = String(details.status || "").toLowerCase();
  // Le nouveau fournisseur peut ne renvoyer que `card_number_url` (affichage sécurisé) :
  // la présence de cette URL signifie que la carte est bien provisionnée.
  const hasSecureUrl = !!details.cardNumberUrl;
  const noPan = !hasSecureUrl && (!details.number || /^0+$/.test(String(details.number || "")));
  return st === "failed" && noPan;
}

// Seuil (USD) de dépôt cumulé requis pour révéler PAN complet + CVV.
const CARD_DETAILS_UNLOCK_USD = 3;
const REQUIRED_INITIAL_CARD_FUND_USD = 3;

// Traduit les erreurs techniques de l'émetteur en messages clairs pour l'utilisateur.
function friendlyCardError(raw: string): string {
  const m = (raw || "").toLowerCase();
  if (m.includes("not enabled for this account")) {
    return "Le service d'émission de cartes est momentanément indisponible chez notre partenaire bancaire. Votre solde a été intégralement remboursé. Réessayez plus tard.";
  }
  if (m.includes("insufficient") || m.includes("balance")) {
    return "Notre réserve d'émission est momentanément épuisée. Votre solde a été remboursé, réessayez dans quelques heures.";
  }
  if (m.includes("kyc") || m.includes("customer")) {
    return "Vos informations d'identité n'ont pas été acceptées par l'émetteur. Vérifiez le nom, la date de naissance et le numéro de pièce, puis réessayez.";
  }
  if (m.includes("timeout") || m.includes("network") || m.includes("html")) {
    return "Le service d'émission ne répond pas actuellement. Votre solde a été remboursé, réessayez dans quelques minutes.";
  }
  return `Émission impossible pour le moment (remboursement effectué). Détail : ${raw}`;
}

// Utilitaire historique de masquage conservé pour les réponses fournisseur incomplètes.
// Le PAN complet, la date d'expiration et le titulaire restent visibles pour
// que le client voit qu'il possède bien une vraie carte — seul le code de
// sécurité peut être masqué par le fournisseur.
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
  // Notification e-mail parrain
  await notifyUser(admin, link.referrer_id,
    "🎉 Nouvelle récompense parrainage",
    txEmailHtml({ title: "Récompense parrainage créditée", intro: "Un de vos filleuls vient d'acheter une carte. Votre bonus est disponible immédiatement.", amount: rewardXof, currency: "XOF" }),
    `Récompense parrainage: +${rewardXof} XOF crédités.`);
  return { paid: rewardXof, alreadyPaid: false };
}

// YengaPay payout supported methods (Wave dispo sur certains projets payout — on tente et on rembourse si refusé).
const YENGAPAY_CASHOUT_METHODS = ["ORANGE_MONEY", "MOOV_MONEY", "TELECEL_MONEY", "SANK_MONEY", "CORIS_MONEY", "WAVE_MONEY"] as const;

function mapCashoutMethod(operator?: string | null) {
  const opNorm = String(operator || "").toLowerCase();
  if (opNorm.includes("orange")) return "ORANGE_MONEY";
  if (opNorm.includes("moov")) return "MOOV_MONEY";
  if (opNorm.includes("telecel")) return "TELECEL_MONEY";
  if (opNorm.includes("sank")) return "SANK_MONEY";
  if (opNorm.includes("coris")) return "CORIS_MONEY";
  if (opNorm.includes("wave")) return "WAVE_MONEY";
  return null;
}

function normalizeBfPhone(phone?: string | null) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("226")) return `+${digits}`;
  return `+226${digits}`;
}

function phoneKey(phone?: string | null) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.slice(-8);
}

function deepFind(obj: any, keys: string[]): any {
  const wanted = new Set(keys.map((k) => k.toLowerCase()));
  const seen = new Set<any>();
  const walk = (v: any): any => {
    if (!v || typeof v !== "object" || seen.has(v)) return null;
    seen.add(v);
    if (Array.isArray(v)) {
      for (const item of v) {
        const r = walk(item);
        if (r !== null && r !== undefined && r !== "") return r;
      }
      return null;
    }
    for (const [k, val] of Object.entries(v)) {
      if (wanted.has(k.toLowerCase()) && val !== null && val !== undefined && String(val) !== "") return val;
    }
    for (const val of Object.values(v)) {
      const r = walk(val);
      if (r !== null && r !== undefined && r !== "") return r;
    }
    return null;
  };
  return walk(obj);
}

function yengaStatus(body: any) {
  return String(body?.status || body?.paymentStatus || body?.data?.status || deepFind(body, ["status", "paymentStatus"]) || "").toUpperCase();
}

function yengaStateFromStatus(rawStatus: string): "success" | "failed" | "pending" | "unknown" {
  if (["DONE", "SUCCESS", "SUCCEEDED", "COMPLETED", "PAID", "SUCCESSFUL"].includes(rawStatus)) return "success";
  if (["FAILED", "CANCELLED", "CANCELED", "EXPIRED", "REJECTED"].includes(rawStatus)) return "failed";
  return rawStatus ? "pending" : "unknown";
}

function yengaAmount(body: any) {
  const v = body?.paymentAmount ?? body?.amount ?? body?.data?.paymentAmount ?? body?.data?.amount ?? deepFind(body, ["paymentAmount", "amount", "netAmount"]);
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function yengaReference(body: any) {
  return body?.reference || body?.data?.reference || deepFind(body, ["reference", "externalId"]) || null;
}

function yengaPayerPhone(body: any) {
  return body?.phoneNumber || body?.customerNumber || body?.customer?.phoneNumber || body?.data?.phoneNumber || body?.data?.customerNumber || deepFind(body, ["phoneNumber", "customerNumber", "sourceNumber", "senderNumber", "payerPhone", "msisdn"]) || null;
}

async function lookupYengaPayment(id: string) {
  const apiKey = Deno.env.get("YENGAPAY_API_KEY");
  const groupId = Deno.env.get("YENGAPAY_GROUP_ID");
  const projectId = Deno.env.get("YENGAPAY_PROJECT_ID");
  if (!apiKey || !groupId || !projectId) throw new Error("YengaPay env missing");
  const base = "https://api.yengapay.com/api/v1";
  const paths = [
    `${base}/groups/${groupId}/projects/${projectId}/direct-payment/status/${id}`,
    `${base}/groups/${groupId}/projects/${projectId}/transactions/${id}`,
    `${base}/groups/${groupId}/projects/${projectId}/deposits/${id}`,
    `${base}/groups/${groupId}/transactions/${id}`,
    `${base}/groups/${groupId}/deposits/${id}`,
    `${base}/transactions/${id}`,
  ];
  let firstBody: any = null;
  for (const url of paths) {
    try {
      const r = await fetch(url, { headers: { "x-api-key": apiKey, "Accept": "application/json" } });
      const t = await r.text(); let body: any = t; try { body = JSON.parse(t); } catch { /**/ }
      if (!firstBody && body && typeof body === "object") firstBody = body;
      if (r.ok && body && typeof body === "object") return body;
    } catch { /**/ }
  }
  return firstBody;
}

async function findProfileByPhone(admin: any, payer?: string | null) {
  const key = phoneKey(payer);
  if (!key) return null;
  const { data: profiles } = await admin.from("profiles").select("id,full_name,email,phone").limit(1000);
  return (profiles ?? []).find((p: any) => phoneKey(p.phone) === key) || null;
}

function uniqueCashoutMethods(preferred?: string | null) {
  return Array.from(new Set([preferred, ...YENGAPAY_CASHOUT_METHODS].filter(Boolean))) as string[];
}

// ============ MoMo inter-network transfer helpers ============
async function loadMomoTransferConfig(admin: any) {
  const keys = ["momo_transfer_fee_bps", "momo_transfer_fee_flat_xof", "momo_transfer_min_xof", "momo_transfer_max_xof", "momo_transfer_enabled"];
  const { data } = await admin.from("platform_config").select("key,value").in("key", keys);
  const m = new Map((data ?? []).map((r: any) => [r.key, r.value]));
  const num = (k: string, d: number) => { const v = m.get(k); const n = Number(v); return Number.isFinite(n) ? n : d; };
  return {
    fee_bps: num("momo_transfer_fee_bps", 150),
    fee_flat_xof: num("momo_transfer_fee_flat_xof", 100),
    min: num("momo_transfer_min_xof", 500),
    max: num("momo_transfer_max_xof", 500000),
    enabled: m.get("momo_transfer_enabled") !== false,
  };
}
function computeMomoTransferFees(amount: number, cfg: { fee_bps: number; fee_flat_xof: number }) {
  const pct = Math.ceil((amount * cfg.fee_bps) / 10000);
  return Math.max(0, pct + Math.max(0, Math.floor(cfg.fee_flat_xof)));
}

  async createPaydunyaPayment({ data, user, admin }) {
    const amount = Math.floor(Number(data?.amount || 0));
    const businessId = data?.business_id;
    if (!amount || amount < 100) throw new Error("Montant invalide (min 100 XOF)");
    if (!businessId) throw new Error("business_id requis");

    await assertBusinessOwner(admin, user.id, businessId);
    const { data: biz } = await admin.from("businesses").select("name").eq("id", businessId).maybeSingle();

    const invoice = await PD.createInvoice({
      amount,
      description: `Paiement Boutique ${biz?.name || ""}`,
      callback_url: `${Deno.env.get("PUBLIC_URL")}/api/webhooks/paydunya`,
      return_url: `${data.origin || ""}/dashboard`,
      cancel_url: `${data.origin || ""}/dashboard`,
      customer: {
        name: user.user_metadata?.full_name || "Client",
        phone: user.phone || ""
      }
    });

    return invoice;
  },

  async verifyPaydunyaPayment({ data, admin }) {
    const token = data?.token;
    if (!token) throw new Error("Token Paydunya manquant");
    const result = await PD.verifyInvoice(token);
    return result;
  },

  async cashoutPaydunya({ data, user, admin }) {
    const businessId = data?.business_id;
    const amount = Math.floor(Number(data?.amount || 0));
    const channel = data?.channel; // e.g. 'orange-money-bf'
    const phone = data?.phone;
    
    if (!amount || amount < 100) throw new Error("Montant invalide");
    if (!phone) throw new Error("Numéro de téléphone requis");
    
    await assertBusinessOwner(admin, user.id, businessId);
    const { data: b } = await admin.from("businesses").select("balance, name").eq("id", businessId).single();
    if (Number(b.balance) < amount) throw new Error("Solde boutique insuffisant");

    const result = await PD.createDisbursement({
      amount,
      recipient_phone: phone,
      recipient_name: user.user_metadata?.full_name || "Marchand",
      account_alias: phone,
      disburse_channel: channel || "orange-money-bf"
    });

    if (result.response_code === "00") {
      await admin.from("businesses").update({ balance: Number(b.balance) - amount }).eq("id", businessId);
      await admin.from("transactions").insert({
        user_id: user.id, type: "withdrawal", status: "success",
        amount, currency: "XOF", provider: "paydunya",
        description: `Retrait Paydunya (${channel})`,
        metadata: { business_id: businessId, paydunya_res: result }
      });
    }

    return result;
  },


async function loadPaypalWithdrawConfig(admin: any) {
  const keys = ["paypal_wd_fee_bps", "paypal_wd_fee_flat_xof", "paypal_wd_min_xof", "paypal_wd_max_xof", "paypal_wd_enabled"];
  const { data } = await admin.from("platform_config").select("key,value").in("key", keys);
  const m = new Map((data ?? []).map((r: any) => [r.key, r.value]));
  const num = (k: string, d: number) => { const v = m.get(k); const n = Number(v); return Number.isFinite(n) ? n : d; };
  return {
    fee_bps: num("paypal_wd_fee_bps", 500),
    fee_flat_xof: num("paypal_wd_fee_flat_xof", 250),
    min: num("paypal_wd_min_xof", 1000),
    max: num("paypal_wd_max_xof", 500000),
    enabled: m.get("paypal_wd_enabled") !== false,
  };
}
function computePaypalWithdrawFees(amount: number, cfg: { fee_bps: number; fee_flat_xof: number }) {
  const pct = Math.ceil((amount * cfg.fee_bps) / 10000);
  return Math.max(0, pct + Math.max(0, Math.floor(cfg.fee_flat_xof)));
}
async function triggerMomoTransferCashout(admin: any, t: any) {
  // UNIQUEMENT le projet YengaPay PAYOUT dédié — jamais de fallback vers le projet marchand
  // pour éviter que la requête soit rejetée (403 "opération réservée aux projets PAYOUT")
  // ou pire, débitée du mauvais projet.
  const apiKey = Deno.env.get("YENGAPAY_TRANSFER_CASHOUT_API_KEY")
    || Deno.env.get("YENGAPAY_TRANSFER_API_KEY");
  const groupId = Deno.env.get("YENGAPAY_TRANSFER_GROUP_ID");
  const projectId = Deno.env.get("YENGAPAY_TRANSFER_PROJECT_ID");
  if (!apiKey || !groupId || !projectId) {
    await admin.from("momo_transfers").update({ status: "failed", admin_note: "Projet YengaPay PAYOUT non configuré (YENGAPAY_TRANSFER_*)" }).eq("id", t.id);
    await refundMomoTransferToWallet(admin, t, "Projet PAYOUT non configuré");
    return;
  }
  console.log("[momo-cashout] using PAYOUT project", { projectId, groupId, transferId: t.id });
  const destNumber = normalizeBfPhone(t.dest_phone);
  const preferred = mapCashoutMethod(t.dest_operator);
  if (!preferred) {
    await admin.from("momo_transfers").update({
      status: "failed",
      admin_note: `Opérateur destinataire non supporté par le payout (${t.dest_operator}). Remboursement automatique déclenché.`,
    }).eq("id", t.id);
    await refundMomoTransferToWallet(admin, t, "Opérateur destinataire non supporté");
    return;
  }
  const methods = [preferred];
  const holder = String(t.dest_holder || "Bénéficiaire").slice(0, 120);
  // Endpoint payout officiel: /groups/{groupId}/project/{projectId}/payout
  const url = `https://api.yengapay.com/api/v1/groups/${groupId}/project/${projectId}/payout`;
  const attempts: any[] = [];
  let accepted: any = null, acceptedMethod: string | null = null;
  await admin.from("momo_transfers").update({ status: "disbursing" }).eq("id", t.id);
  for (const paymentMethod of methods) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({
          amount: Number(t.amount_send),
          destNumber,
          destName: holder,
          paymentMethod,
          description: `Transfert vers ${holder}`.slice(0, 140),
        }),
      });
      const txt = await r.text(); let body: any = txt; try { body = JSON.parse(txt); } catch { /**/ }
      attempts.push({ method: paymentMethod, status: r.status, body });
      if (r.ok) { accepted = body; acceptedMethod = paymentMethod; break; }
    } catch (e) { attempts.push({ method: paymentMethod, error: (e as Error).message }); }
  }
  if (!accepted) {
    await admin.from("momo_transfers").update({
      status: "failed", admin_note: "Cashout refusé — remboursement automatique déclenché",
      cashout_response: { attempts },
    }).eq("id", t.id);
    await refundMomoTransferToWallet(admin, t, "Cashout refusé par l'opérateur");
    return;
  }
  const provStatus = String(accepted?.status || "PENDING").toUpperCase();
  const delivered = ["SUCCESS", "COMPLETED", "PAID", "SUCCESSFUL", "DONE"].includes(provStatus);
  await admin.from("momo_transfers").update({
    status: delivered ? "delivered" : "disbursing",
    delivered_at: delivered ? new Date().toISOString() : null,
    cashout_ref: accepted?.id || accepted?.transactionId || accepted?.reference || acceptedMethod,
    cashout_response: { accepted, method: acceptedMethod, attempts },
  }).eq("id", t.id);
}

// Rembourse un transfert MoMo en créditant le portefeuille XOF de l'utilisateur.
async function refundMomoTransferToWallet(admin: any, t: any, reason: string) {
  try {
    const { data: existing } = await admin
      .from("transactions").select("id")
      .eq("user_id", t.user_id).eq("type", "refund")
      .eq("provider_ref", t.payment_reference).maybeSingle();
    if (existing) return;
    const refundAmount = Number(t.total_charged_xof ?? (Number(t.amount_send) + Number(t.fees_xof || 0)));
    const { data: w } = await admin.from("wallets")
      .select("id,balance").eq("user_id", t.user_id).eq("currency", "XOF").maybeSingle();
    let newBalance: number | undefined;
    if (w) {
      newBalance = Number(w.balance) + refundAmount;
      await admin.from("wallets").update({ balance: newBalance }).eq("id", w.id);
    }
    await admin.from("transactions").insert({
      user_id: t.user_id, type: "refund", status: "success",
      amount: refundAmount, currency: "XOF",
      provider: "yengapay", provider_ref: t.payment_reference,
      description: `Remboursement transfert ${t.source_operator}→${t.dest_operator} (${reason})`,
    });
    await admin.from("momo_transfers").update({
      status: "refunded",
      admin_note: `${reason} — ${refundAmount} XOF recrédité au portefeuille`,
    }).eq("id", t.id);
    notifySms(admin, "wallet_recharge", {
      userId: t.user_id, amount: refundAmount, currency: "XOF", balance: newBalance,
    }).catch(() => {});
  } catch (e) {
    await admin.from("momo_transfers").update({
      admin_note: `Remboursement automatique échoué: ${(e as Error).message}`,
    }).eq("id", t.id);
  }
}
async function pollAndProcessMomoTransfer(admin: any, t: any, opts: { forceDisburse?: boolean } = {}) {
  if (["delivered", "refunded"].includes(t.status)) return t;
  const piid = t.payment_intent_id;
  const apiKey = Deno.env.get("YENGAPAY_API_KEY");
  const groupId = Deno.env.get("YENGAPAY_GROUP_ID");
  const projectId = Deno.env.get("YENGAPAY_PROJECT_ID");
  let paid = ["paid", "disbursing"].includes(t.status) || !!t.paid_at;
  if (!paid && piid && apiKey && groupId && projectId) {
    try {
      const r = await fetch(`https://api.yengapay.com/api/v1/groups/${groupId}/projects/${projectId}/direct-payment/status/${piid}`,
        { headers: { "x-api-key": apiKey, "Accept": "application/json" } });
      const txt = await r.text(); let body: any = txt; try { body = JSON.parse(txt); } catch { /**/ }
      const st = String(body?.status || body?.paymentStatus || body?.data?.status || "").toUpperCase();
      if (["DONE", "SUCCESS", "SUCCEEDED", "COMPLETED", "PAID"].includes(st)) {
        paid = true;
        await admin.from("momo_transfers").update({ status: "paid", paid_at: new Date().toISOString(), metadata: { ...(t.metadata || {}), verify: body } }).eq("id", t.id).eq("status", "awaiting_payment");
      } else if (["FAILED", "CANCELLED", "CANCELED", "EXPIRED", "REJECTED"].includes(st)) {
        await admin.from("momo_transfers").update({ status: "failed", admin_note: `Paiement ${st}`, metadata: { ...(t.metadata || {}), verify: body } }).eq("id", t.id);
        const { data: rr } = await admin.from("momo_transfers").select("*").eq("id", t.id).maybeSingle();
        return rr;
      }
    } catch { /**/ }
  }
  if (paid || opts.forceDisburse) {
    const { data: fresh } = await admin.from("momo_transfers").select("*").eq("id", t.id).maybeSingle();
    if (fresh && !fresh.cashout_ref && (fresh.status === "paid" || opts.forceDisburse)) {
      await triggerMomoTransferCashout(admin, fresh);
    }
  }
  const { data: out } = await admin.from("momo_transfers").select("*").eq("id", t.id).maybeSingle();
  return out;
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

// ===== Passerelle de paiement projet : frais + webhooks signés =====
async function loadGatewayFeeConfig(admin: any) {
  const keys = [
    "gateway_fee_bps", "gateway_fee_flat_xof", "gateway_min_xof", "gateway_enabled",
    "business_cashout_fee_bps", "business_cashout_fee_flat_xof", "business_cashout_min_xof"
  ];
  const { data } = await admin.from("platform_config").select("key,value").in("key", keys);
  const map = new Map((data ?? []).map((r: any) => [r.key, r.value]));
  const num = (k: string, d: number) => {
    const v = map.get(k);
    const n = Number(typeof v === "object" && v !== null ? (v as any).value : v);
    return Number.isFinite(n) ? n : d;
  };
  const enabledRaw = map.get("gateway_enabled");
  return {
    fee_bps: num("gateway_fee_bps", 200),
    fee_flat_xof: num("gateway_fee_flat_xof", 0),
    min_xof: num("gateway_min_xof", 100),
    enabled: enabledRaw === undefined || enabledRaw === null ? true : Boolean(enabledRaw),
    business_cashout_fee_bps: num("business_cashout_fee_bps", 100), // Default 1%
    business_cashout_fee_flat_xof: num("business_cashout_fee_flat_xof", 100), // Default 100 XOF
    business_cashout_min_xof: num("business_cashout_min_xof", 500),
  };
}

async function hmacSha256Hex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((x) => x.toString(16).padStart(2, "0")).join("");
}

async function dispatchProjectWebhook(admin: any, opts: {
  project: any; key: any; payload: any; event: string; simulated?: boolean;
}) {
  const { project, key, payload, event } = opts;
  const url = key.webhook_url as string | null;
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = await hmacSha256Hex(key.webhook_secret, `${timestamp}.${body}`);
  let status_code: number | null = null;
  let response_body = "";
  let success = false;
  let error: string | null = null;

  if (!url) {
    error = "Aucune URL de webhook configurée";
  } else {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10_000);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-FIP-Event": event,
          "X-FIP-Timestamp": timestamp,
          "X-FIP-Signature": `t=${timestamp},v1=${signature}`,
          "X-FIP-Public-Key": key.public_key,
        },
        body,
        signal: ctrl.signal,
      });
      clearTimeout(t);
      status_code = res.status;
      response_body = (await res.text().catch(() => "")).slice(0, 800);
      success = res.ok;
      if (!success) error = `HTTP ${res.status}`;
    } catch (e) {
      error = (e as Error).message || "Échec de la connexion au webhook";
    }
  }

  await admin.from("project_webhook_deliveries").insert({
    project_id: project.id, business_id: project.business_id,
    event, url, payload, status_code, response_body,
    success, simulated: Boolean(opts.simulated), error,
  });

  return { ok: success, status_code, response_body, error, signature: `t=${timestamp},v1=${signature}`, payload };
}

// ============= Handlers =============
// v: internal-transfer-6 (force category registration)
const HANDLERS: Record<string, (args: { data: any; user: any; admin: any; userClient: any }) => Promise<any>> = {
  async listProductCategories(args: any) {
    await assertBusinessOwner(args.admin, args.user.id, args.data.business_id);
    const { data: rows, error } = await args.admin.from("product_categories")
      .select("*")
      .eq("business_id", args.data.business_id)
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  },
  async createProductCategory(args: any) {
    await assertBusinessOwner(args.admin, args.user.id, args.data.business_id);
    const name = String(args.data?.name || "").trim();
    if (name.length < 2) throw new Error("Nom de catégorie requis");
    const slug = slugify(name) + "-" + randomHex(2);
    const { data: row, error } = await args.admin.from("product_categories").insert({
      business_id: args.data.business_id, name, slug, 
      description: args.data.description || null,
      position: args.data.position || 0
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  },
  async deleteProductCategory(args: any) {
    const { data: cat } = await args.admin.from("product_categories").select("business_id").eq("id", args.data.id).maybeSingle();
    if (!cat) throw new Error("Catégorie introuvable");
    await assertBusinessOwner(args.admin, args.user.id, cat.business_id);
    await args.admin.from("product_categories").delete().eq("id", args.data.id);
    return { ok: true };
  },



  async adminListShopTemplates({ user, admin }) {
    if (!(await isAdmin(admin, user.id))) throw new Error("Forbidden");
    const { data, error } = await admin.from("shop_templates").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { ok: true, templates: data || [] };
  },

  async adminUpsertShopTemplate({ data, user, admin }) {
    if (!(await isAdmin(admin, user.id))) throw new Error("Forbidden");
    const id = data.id || null;
    const row: any = {
      name: String(data.name || ""),
      slug: String(data.slug || ""),
      description: String(data.description || ""),
      price: Number(data.price || 0),
      is_free: !!data.is_free,
      thumbnail_url: data.thumbnail_url || null,
      preview_url: data.preview_url || null,
      category: data.category || 'ecommerce',
      config: data.config || {},
      updated_at: new Date().toISOString()
    };
    if (id) {
      const { data: res, error } = await admin.from("shop_templates").update(row).eq("id", id).select("*").single();
      if (error) throw new Error(error.message);
      return { ok: true, template: res };
    } else {
      const { data: res, error } = await admin.from("shop_templates").insert({ ...row, created_at: new Date().toISOString() }).select("*").single();
      if (error) throw new Error(error.message);
      return { ok: true, template: res };
    }
  },

  async adminDeleteShopTemplate({ data, user, admin }) {
    if (!(await isAdmin(admin, user.id))) throw new Error("Forbidden");
    const { error } = await admin.from("shop_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  // ---------- Dashboard ----------
  async getDashboardData({ user, admin, userClient }) {
    const userId = user.id;
    const [w, t, c, p] = await Promise.all([
      userClient.from("wallets").select("id,currency,balance").eq("user_id", userId),
      admin.from("transactions").select("id,type,status,amount,currency,description,provider,provider_ref,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(100),
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
    const amountUsd = Number(data?.amountUsd);
    if (!Number.isFinite(amountUsd) || amountUsd < REQUIRED_INITIAL_CARD_FUND_USD) {
      return { ok: false, error: "La recharge initiale minimum est de 3 USD" };
    }
    const cost = computeCardCost(amountUsd, cfg);
    const requiredXof = cost.totalXof;
    // Validation des infos perso requises par l'API NFC
    const required = ["firstName","lastName","dob","idType","idNumber","line1","city","state","postalCode","country","phone","idImage"] as const;
    for (const k of required) {
      if (!data?.[k] || String(data[k]).trim() === "") return { ok: false, error: `Champ requis manquant : ${k}` };
    }
    const isAcceptedImageInput = (value: unknown) => {
      const image = String(value || "");
      return /^https?:\/\//i.test(image) || /^data:image\/(jpeg|png);base64,/i.test(image);
    };
    if (!isAcceptedImageInput(data.idImage)) {
      return { ok: false, error: "La photo doit être une image JPG ou PNG valide." };
    }
    if (String(data.brand || "visa").toLowerCase() === "mastercard" && !isAcceptedImageInput(data.idImageBack)) {
      return { ok: false, error: "La photo verso de la pièce d'identité est requise pour une Mastercard." };
    }
    // StroWallet exige une URL téléchargeable pour id_image : on héberge l'image
    // reçue en base64 dans le bucket privé `kyc` et on transmet une URL signée.
    const hostIdImage = async (value: string, side: string): Promise<string> => {
      const image = String(value || "");
      if (/^https?:\/\//i.test(image)) return image;
      const match = image.match(/^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/i);
      if (!match) throw new Error("Image d'identité invalide (JPG ou PNG attendu)");
      const ext = match[1].toLowerCase() === "png" ? "png" : "jpg";
      const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
      if (bytes.byteLength > 2 * 1024 * 1024) throw new Error("La photo de la pièce doit faire moins de 2 Mo");
      const path = `${userId}/issuer-${side}-${Date.now()}.${ext}`;
      const { error: upErr } = await admin.storage.from("kyc").upload(path, bytes, {
        contentType: ext === "png" ? "image/png" : "image/jpeg", upsert: true,
      });
      if (upErr) throw new Error(`Téléversement de la pièce impossible : ${upErr.message}`);
      const { data: signed, error: sErr } = await admin.storage.from("kyc").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (sErr || !signed?.signedUrl) throw new Error("Lien de la pièce d'identité indisponible");
      return signed.signedUrl;
    };
    const { data: wallet, error: wErr } = await userClient.from("wallets").select("balance,id").eq("user_id", userId).eq("currency", "XOF").maybeSingle();
    if (wErr) throw new Error(wErr.message);
    if (!wallet || Number(wallet.balance) < requiredXof) return { ok: false, error: "Solde XOF insuffisant", required: requiredXof, available: Number(wallet?.balance ?? 0) };
    const { error: debErr } = await admin.from("wallets").update({ balance: Number(wallet.balance) - requiredXof }).eq("id", wallet.id);
    if (debErr) throw new Error(debErr.message);
    try {
      const idImageUrl = await hostIdImage(data.idImage, "front");
      const idImageBackUrl = data.idImageBack ? await hostIdImage(data.idImageBack, "back") : undefined;
      const res = await SW.createNfcCard({
        firstName: data.firstName, lastName: data.lastName, otherNames: data.otherNames, dob: data.dob,
        idType: data.idType, idNumber: data.idNumber, email: data.email || email,
        line1: data.line1, city: data.city, state: data.state,
        postalCode: data.postalCode, country: data.country,
        amountUsd, phone: data.phone,
        nameOnCard: data.nameOnCard,
        brand: String(data.brand || "visa").toLowerCase(),
        idImage: idImageUrl,
        idImageBack: idImageBackUrl,
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
      return { ok: false, error: friendlyCardError((e as Error).message) };
    }
  },

  async cardDetails({ data, user, admin, userClient }) {
    const { data: card } = await userClient.from("cards").select("user_id,total_funded_usd,last4").eq("provider_card_id", data.card_id).maybeSingle();
    if (!card || card.user_id !== user.id) {
      if (!(await isAdmin(admin, user.id))) throw new Error("Carte introuvable");
    }
    let res = await SW.getNfcCardDetails(data.card_id);
    let details = SW.extractCardDetails(res);
    // Sur le domaine public, les pages sécurisées de l'émetteur peuvent refuser
    // l'iframe. Résolution serveur éphémère : aucune donnée sensible n'est stockée.
    if ((!details.number || /^0+$/.test(details.number)) && details.cardNumberUrl) {
      details.number = await SW.readSecureCardField(details.cardNumberUrl, "number");
    }
    if (!details.cvv && details.cvvUrl) {
      details.cvv = await SW.readSecureCardField(details.cvvUrl, "cvv");
    }
    const status = String(details.status || "").toLowerCase();
    const missingPan = !details.cardNumberUrl && (!details.number || /^0+$/.test(String(details.number || "")));
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
          if ((!details.number || /^0+$/.test(details.number)) && details.cardNumberUrl) {
            details.number = await SW.readSecureCardField(details.cardNumberUrl, "number");
          }
          if (!details.cvv && details.cvvUrl) {
            details.cvv = await SW.readSecureCardField(details.cvvUrl, "cvv");
          }
          const finalStatus = String(details.status || "").toLowerCase() === "active" || (details.number && details.cvv) || (details.cardNumberUrl && details.cvvUrl) ? "active" : "pending";
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
    // Persiste les infos non sensibles renvoyées par l'émetteur (last4, marque, solde)
    // pour que la liste des cartes reste correcte même hors ligne.
    try {
      const patch: any = {};
      if (details.last4) patch.last4 = String(details.last4);
      if (details.brand) patch.brand = String(details.brand).toLowerCase();
      if (details.balance !== null && Number.isFinite(Number(details.balance))) patch.balance = Number(details.balance);
      if (Object.keys(patch).length) await admin.from("cards").update(patch).eq("provider_card_id", data.card_id);
    } catch { /* silencieux */ }
    // Forme normalisée prioritaire pour le client. Les URL restent disponibles
    // comme repli, mais PAN/CVV résolus sont renvoyés seulement à cet utilisateur.
    return {
      card_detail: {
        card_number: details.number,
        cvv: details.cvv,
        expiry: details.expiry,
        card_holder_name: details.holder,
        card_status: details.status,
        balance: details.balance,
        last4: details.last4,
        brand: details.brand,
        card_number_url: details.cardNumberUrl,
        cvv_url: details.cvvUrl,
        billing_address: details.billingAddress,
      },
    };
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
      // Normalisation robuste (l'émetteur renvoie des formes variables selon l'endpoint atteint).
      const items = SW.extractCardTransactions(res);
      // Journalisation : enregistre chaque transaction carte dans `transactions` (dédup par provider_ref).
      for (const t of items) {
        const sig = `cardtx:${data.card_id}:${t.id || `${t.date || ""}-${t.amount || ""}`}`;
        const { data: existing } = await admin.from("transactions").select("id").eq("provider_ref", sig).maybeSingle();
        if (existing) continue;
        await admin.from("transactions").insert({
          user_id: ownerId, type: "card_tx",
          status: t.status === "failed" ? "failed" : "success",
          amount: t.amount, currency: t.currency,
          provider: "issuer", provider_ref: sig,
          description: t.description,
          metadata: { card_id: data.card_id, raw: t },
        });
      }
      // Réponse compatible avec le frontend actuel : { response: [...] } normalisé.
      return { ok: true, data: { response: items.map((t) => ({ ...t })) } };
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
      // Incrémente le solde et le cumul historique des approvisionnements.
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
      notifySms(admin, "card_recharge", {
        userId, amount: Number(data.amountUsd), currency: "USD",
      }).catch(() => {});
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
    await assertUserRateLimit(admin, userId, "withdrawCard", 6);
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
    await assertUserRateLimit(admin, userId, "requestWithdrawal", 6);
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
    // Notif SMS demande de retrait (non bloquant)
    notifySms(admin, "withdrawal_request", {
      userId, amount, currency: "XOF",
    }).catch(() => {});

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
    await assertUserRateLimit(admin, userId, "initRecharge", 10);
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
    const checkoutUrl =
      body?.checkoutPageUrlWithPaymentToken
      || body?.checkout_url
      || body?.paymentUrl
      || body?.data?.checkoutPageUrlWithPaymentToken
      || body?.data?.checkout_url
      || body?.data?.paymentUrl
      || body?.paymentIntent?.checkoutPageUrlWithPaymentToken
      || body?.paymentIntent?.checkout_url
      || null;
    console.log("[initRecharge] yengapay response keys:", Object.keys(body || {}), "checkoutUrl?", !!checkoutUrl);
    const { error: txErr } = await admin.from("transactions").insert({
      user_id: userId, type: "deposit", status: "pending",
      amount: Number(data.amount), currency: "XOF",
      provider: "yengapay", provider_ref: reference,
      description: "Recharge YengaPay",
      metadata: { paymentIntentId, init: body },
    });
    if (txErr) throw new Error(txErr.message);
    if (!checkoutUrl) {
      throw new Error("YengaPay n'a pas retourné de lien de paiement. Réponse : " + JSON.stringify(body).slice(0, 300));
    }
    return { ok: true, checkout_url: checkoutUrl, reference, paymentIntentId, raw: body };
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
    const projectId = Deno.env.get("YENGAPAY_PROJECT_ID");
    if (!apiKey || !groupId || !projectId) return { ok: false, error: "YengaPay env missing" };
    const piid = (tx.metadata as any)?.paymentIntentId;
    if (!piid) return { ok: true, status: "pending", credited: false, providerStatus: "NO_INTENT" };
    let body: any = null; let ok = false;
    try {
      const r = await fetch(`https://api.yengapay.com/api/v1/groups/${groupId}/projects/${projectId}/direct-payment/status/${piid}`,
        { headers: { "x-api-key": apiKey, "Accept": "application/json" } });
      const t = await r.text(); try { body = JSON.parse(t); } catch { body = t; }
      ok = r.ok;
    } catch { /* network */ }
    if (!ok) return { ok: false, error: "YengaPay lookup failed", raw: body };
    const st = String(body?.status || body?.paymentStatus || body?.data?.status || "").toUpperCase();
    const paid = ["DONE", "SUCCESS", "SUCCEEDED", "COMPLETED", "PAID"].includes(st);
    const failed = ["FAILED", "CANCELLED", "CANCELED", "EXPIRED", "REJECTED"].includes(st);
    if (paid) {
      // Crédit atomique idempotent (partagé avec le webhook et le flux dépôt direct)
      const { credited } = await YP.creditDeposit(admin, tx.user_id, tx.provider_ref, Number(tx.amount), { verify: body });
      if (credited) {
        await notifyUser(admin, tx.user_id,
          "✅ Recharge créditée",
          txEmailHtml({ title: "Recharge créditée sur votre portefeuille", intro: "Votre paiement a été confirmé et votre solde a été mis à jour immédiatement.", amount: Number(tx.amount), currency: "XOF", reference: tx.provider_ref }),
          `Recharge de ${tx.amount} XOF créditée. Référence ${tx.provider_ref}.`);
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

  // ================= Dépôt in-app via YengaPay Direct Payment (sans redirection) =================

  async listDepositOperators() {
    return { ok: true, operators: YP.OPERATORS.map((o) => ({
      code: o.code, label: o.label, flow: o.flow,
      ussdPrefix: o.ussdPrefix || null, otpBySms: o.otpBySms !== false, hint: o.hint || null,
    })) };
  },

  async initDeposit({ data, user, admin }) {
    const userId = user.id;
    await assertUserRateLimit(admin, userId, "initRecharge", 10);
    const amount = Number(data?.amount);
    const operatorCode = String(data?.operator || "").toUpperCase();
    const phone = String(data?.phone || "").trim();
    if (!Number.isFinite(amount) || amount < 100) return { ok: false, error: "Montant minimum : 100 XOF" };
    const operator = YP.findOperator(operatorCode);
    if (!operator) return { ok: false, error: "Opérateur non pris en charge" };
    if (!phone) return { ok: false, error: "Numéro de téléphone requis" };

    const reference = `FIP-${Date.now()}-${userId.slice(0, 8)}`;
    const callbackUrl = `${SUPABASE_URL}/functions/v1/yengapay-webhook`;

    let initRes: any;
    try {
      initRes = await YP.initDirectPayment({ amount, reference, callbackUrl, description: "Recharge portefeuille" });
    } catch (e) {
      return { ok: false, error: "Impossible de contacter la passerelle de paiement. " + (e as Error).message };
    }
    if (!initRes.ok) {
      return { ok: false, error: "La passerelle de paiement a refusé l'opération.", message: typeof initRes.body === "string" ? initRes.body.slice(0, 200) : JSON.stringify(initRes.body).slice(0, 200) };
    }
    const body = initRes.body;
    const paymentIntentId = YP.extractIntentId(body);
    if (!paymentIntentId) return { ok: false, error: "La passerelle de paiement n'a pas pu initier l'opération." };

    const { error: txErr } = await admin.from("transactions").insert({
      user_id: userId, type: "deposit", status: "pending",
      amount, currency: "XOF",
      provider: "yengapay", provider_ref: reference,
      description: `Recharge portefeuille — ${operator.label}`,
      metadata: { operator: operator.code, phone, intent: paymentIntentId, init: body },
    });
    if (txErr) return { ok: false, error: "Erreur lors de l'enregistrement de l'opération." };

    if (operator.flow === "otp") {
      // Orange / Telecel : le client génère lui-même son code via USSD, aucun SMS à envoyer.
      if (operator.otpBySms === false) {
        return {
          ok: true, reference, requiresOtp: true, status: "pending",
          ussd: YP.ussdCodeFor(operator, amount),
          message: operator.hint || "Composez le code USSD pour générer votre code de paiement.",
        };
      }
      let otpRes: any;
      try {
        otpRes = await YP.sendDirectPaymentOtp({ reference, phone, operator: operator.code, paymentIntentId });
      } catch (e) {
        return { ok: false, error: "Impossible d'envoyer le code de confirmation. " + (e as Error).message };
      }
      if (!otpRes.ok) {
        console.error("[deposit otp]", reference, otpRes.status, JSON.stringify(otpRes.body).slice(0, 800));
        return { ok: false, error: "L'envoi du code de confirmation a échoué." };
      }
      return { ok: true, reference, requiresOtp: true, status: "pending", message: "Un code de confirmation vous a été envoyé par SMS." };
    }

    // Flux push USSD : on déclenche directement le paiement, l'utilisateur confirme sur son téléphone.
    let payRes: any;
    try {
      payRes = await YP.payDirectPayment({ reference, phone, operator: operator.code, paymentIntentId });
    } catch (e) {
      return { ok: false, error: "Impossible d'initier le paiement. " + (e as Error).message };
    }
    if (!payRes.ok) {
      console.error("[deposit pay]", reference, payRes.status, JSON.stringify(payRes.body).slice(0, 800));
      return { ok: false, error: "La passerelle de paiement a refusé l'opération." };
    }
    const providerStatus = YP.extractProviderStatus(payRes.body);
    if (providerStatus === "success") {
      const { credited } = await YP.creditDeposit(admin, userId, reference, amount, { pay: payRes.body });
      return { ok: true, reference, requiresOtp: false, status: "success", message: credited ? "Dépôt crédité avec succès." : "Dépôt déjà traité." };
    }
    if (providerStatus === "failed") {
      await admin.from("transactions").update({ status: "failed", metadata: { operator: operator.code, phone, pay: payRes.body } }).eq("provider_ref", reference).eq("status", "pending");
      return { ok: true, reference, requiresOtp: false, status: "failed", message: "Le paiement a été refusé ou annulé." };
    }
    return { ok: true, reference, requiresOtp: false, status: "pending", message: "Validez le paiement depuis votre téléphone." };
  },

  async sendDepositOtp({ data, user, admin }) {
    const reference = String(data?.reference || "");
    if (!reference) return { ok: false, error: "Référence manquante" };
    const { data: tx } = await admin.from("transactions").select("id,user_id,status,metadata").eq("provider_ref", reference).eq("type", "deposit").maybeSingle();
    if (!tx) return { ok: false, error: "Opération introuvable" };
    if (tx.user_id !== user.id) return { ok: false, error: "Forbidden" };
    if (tx.status !== "pending") return { ok: false, error: "Cette opération n'est plus en attente." };
    const meta = (tx.metadata as any) || {};
    try {
      const otpRes = await YP.sendDirectPaymentOtp({ reference, phone: meta.phone, operator: meta.operator, paymentIntentId: meta.intent });
      if (!otpRes.ok) return { ok: false, error: "L'envoi du code de confirmation a échoué." };
      return { ok: true, message: "Code de confirmation renvoyé." };
    } catch (e) {
      return { ok: false, error: "Impossible d'envoyer le code de confirmation. " + (e as Error).message };
    }
  },

  async payDeposit({ data, user, admin }) {
    const reference = String(data?.reference || "");
    if (!reference) return { ok: false, error: "Référence manquante" };
    const { data: tx } = await admin.from("transactions").select("id,user_id,amount,status,metadata").eq("provider_ref", reference).eq("type", "deposit").maybeSingle();
    if (!tx) return { ok: false, error: "Opération introuvable" };
    if (tx.user_id !== user.id) return { ok: false, error: "Forbidden" };
    if (tx.status === "success") return { ok: true, status: "success", message: "Dépôt déjà crédité." };
    if (tx.status === "failed") return { ok: true, status: "failed", message: "Ce dépôt a échoué." };
    const meta = (tx.metadata as any) || {};
    let payRes: any;
    try {
      payRes = await YP.payDirectPayment({ reference, phone: meta.phone, operator: meta.operator, otp: data?.otp, paymentIntentId: meta.intent });
    } catch (e) {
      return { ok: false, status: "failed", message: "Impossible de contacter la passerelle de paiement. " + (e as Error).message };
    }
    if (!payRes.ok) {
      console.error("[deposit confirm]", reference, payRes.status, JSON.stringify(payRes.body).slice(0, 800));
      return { ok: true, status: "failed", message: "Code incorrect ou paiement refusé." };
    }
    const providerStatus = YP.extractProviderStatus(payRes.body);
    if (providerStatus === "success") {
      const { credited } = await YP.creditDeposit(admin, tx.user_id, reference, Number(tx.amount), { pay: payRes.body });
      if (credited) {
        await notifyUser(admin, tx.user_id,
          "✅ Recharge créditée",
          txEmailHtml({ title: "Recharge créditée sur votre portefeuille", intro: "Votre paiement a été confirmé et votre solde a été mis à jour immédiatement.", amount: Number(tx.amount), currency: "XOF", reference }),
          `Recharge de ${tx.amount} XOF créditée. Référence ${reference}.`);
      }
      return { ok: true, status: "success", message: "Dépôt crédité avec succès." };
    }
    if (providerStatus === "failed") {
      await admin.from("transactions").update({ status: "failed", metadata: { ...meta, pay: payRes.body } }).eq("id", tx.id).eq("status", "pending");
      return { ok: true, status: "failed", message: "Le paiement a été refusé ou annulé." };
    }
    return { ok: true, status: "pending", message: "Paiement en cours de confirmation." };
  },

  async depositStatus({ data, user, admin }) {
    const reference = String(data?.reference || "");
    if (!reference) return { ok: false, error: "Référence manquante" };
    const { data: tx } = await admin.from("transactions").select("id,user_id,amount,status,metadata").eq("provider_ref", reference).eq("type", "deposit").maybeSingle();
    if (!tx) return { ok: false, error: "Opération introuvable" };
    if (tx.user_id !== user.id && !(await isAdmin(admin, user.id))) return { ok: false, error: "Forbidden" };
    if (tx.status === "success") return { ok: true, status: "success", credited: false };
    if (tx.status === "failed") return { ok: true, status: "failed", credited: false };
    const meta = (tx.metadata as any) || {};
    const piid = meta.intent || meta.paymentIntentId;
    if (!piid) return { ok: true, status: "pending", credited: false };
    try {
      const r = await YP.checkDirectPaymentStatus(piid);
      if (!r.ok) return { ok: true, status: "pending", credited: false };
      const providerStatus = YP.extractProviderStatus(r.body);
      if (providerStatus === "success") {
        const { credited } = await YP.creditDeposit(admin, tx.user_id, reference, Number(tx.amount), { statusCheck: r.body });
        return { ok: true, status: "success", credited };
      }
      if (providerStatus === "failed") {
        await admin.from("transactions").update({ status: "failed", metadata: { ...meta, statusCheck: r.body } }).eq("id", tx.id).eq("status", "pending");
        return { ok: true, status: "failed", credited: false };
      }
      return { ok: true, status: "pending", credited: false };
    } catch {
      return { ok: true, status: "pending", credited: false };
    }
  },

  // Sweep all pending deposit transactions for the current user (or all users for admin)
  // and verify each one against YengaPay; credits wallet for any that are confirmed paid.
  // Designed to run on Dashboard load to make recharges self-healing without webhook.
  async reconcileMyDeposits({ user, admin }) {
    const apiKey = Deno.env.get("YENGAPAY_API_KEY");
    const groupId = Deno.env.get("YENGAPAY_GROUP_ID");
    const projectId = Deno.env.get("YENGAPAY_PROJECT_ID");
    if (!apiKey || !groupId || !projectId) return { ok: false, error: "YengaPay env missing" };
    const userId = user.id;
    const isAdm = await isAdmin(admin, userId);
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    let q = admin.from("transactions")
      .select("id,user_id,amount,status,metadata,provider_ref,currency,type")
      .eq("type", "deposit").eq("status", "pending").eq("provider", "yengapay")
      .gte("created_at", cutoff).order("created_at", { ascending: false }).limit(50);
    if (!isAdm) q = q.eq("user_id", userId);
    const { data: pendings } = await q;
    let credited = 0, failed = 0, stillPending = 0;
    for (const tx of pendings ?? []) {
      const piid = (tx.metadata as any)?.paymentIntentId;
      if (!piid) { stillPending++; continue; }
      let body: any = null; let ok = false;
      try {
        const r = await fetch(`https://api.yengapay.com/api/v1/groups/${groupId}/projects/${projectId}/direct-payment/status/${piid}`,
          { headers: { "x-api-key": apiKey, "Accept": "application/json" } });
        const t = await r.text(); try { body = JSON.parse(t); } catch { body = t; }
        ok = r.ok;
      } catch { /* network */ }
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
          await notifyUser(admin, tx.user_id,
            "✅ Recharge créditée",
            txEmailHtml({ title: "Recharge créditée sur votre portefeuille", intro: "Votre paiement a été confirmé et votre solde a été mis à jour automatiquement.", amount: Number(tx.amount), currency: "XOF", reference: tx.provider_ref }),
            `Recharge de ${tx.amount} XOF créditée. Référence ${tx.provider_ref}.`);
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
    const [users, cards, txs, kyc, withdrawals, businesses, allCards] = await Promise.all([
      admin.from("profiles").select("id,full_name,email,phone,country,is_active,strowallet_customer_id,created_at").order("created_at", { ascending: false }).limit(100),
      admin.from("cards").select("id,user_id,brand,last4,status,balance,currency,failed_attempts,auto_frozen_at,created_at,total_funded_usd,provider_card_id").order("created_at", { ascending: false }).limit(100),
      admin.from("transactions").select("id,user_id,type,status,amount,currency,description,provider,provider_ref,metadata,created_at").order("created_at", { ascending: false }).limit(500),
      admin.from("kyc_submissions").select("*").order("submitted_at", { ascending: false, nullsFirst: false }).limit(50),
      admin.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(50),
      admin.from("businesses").select("id,owner_id,name,slug,contact_email,contact_phone,status,created_at").order("created_at", { ascending: false }).limit(200),
      admin.from("cards").select("id,balance,total_funded_usd,status,currency").limit(10000),
    ]);
    const firstErr = users.error || cards.error || txs.error || kyc.error || withdrawals.error || businesses.error || allCards.error;
    if (firstErr) throw new Error(firstErr.message);
    // Enrichit chaque carte avec le propriétaire (nom + email) pour le tableau admin.
    const cardOwnerIds = Array.from(new Set((cards.data ?? []).map((c: any) => c.user_id).filter(Boolean)));
    let ownerMap: Record<string, any> = {};
    if (cardOwnerIds.length > 0) {
      const { data: owners } = await admin.from("profiles").select("id,full_name,email,phone").in("id", cardOwnerIds);
      ownerMap = Object.fromEntries((owners ?? []).map((o: any) => [o.id, o]));
    }
    const enrichedCards = (cards.data ?? []).map((c: any) => ({ ...c, owner: ownerMap[c.user_id] || null }));
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    const { data: monthTx, error: monthErr } = await admin.from("transactions")
      .select("type,amount,currency,status")
      .gte("created_at", monthStart.toISOString())
      .in("status", ["success", "pending"]);
    if (monthErr) throw new Error(monthErr.message);
    const flows = {
      recharges_xof: 0, recharges_pending_xof: 0,
      withdrawals_xof: 0, withdrawals_pending_xof: 0,
      card_issue_xof: 0, card_issue_pending_xof: 0,
      recharges_all_xof: 0, withdrawals_all_xof: 0, card_issue_all_xof: 0,
      card_balance_usd: 0, card_total_funded_usd: 0, cards_count: 0, cards_active_count: 0,
    };
    for (const t of monthTx ?? []) {
      if (t.currency !== "XOF") continue;
      const a = Number(t.amount);
      const pending = t.status === "pending";
      if (t.type === "deposit") pending ? flows.recharges_pending_xof += a : flows.recharges_xof += a;
      if (t.type === "withdrawal") pending ? flows.withdrawals_pending_xof += a : flows.withdrawals_xof += a;
      if (t.type === "card_issue") pending ? flows.card_issue_pending_xof += a : flows.card_issue_xof += a;
    }
    flows.recharges_all_xof = flows.recharges_xof + flows.recharges_pending_xof;
    flows.withdrawals_all_xof = flows.withdrawals_xof + flows.withdrawals_pending_xof;
    flows.card_issue_all_xof = flows.card_issue_xof + flows.card_issue_pending_xof;
    for (const c of allCards.data ?? []) {
      flows.cards_count += 1;
      if (!["terminated", "deleted", "failed"].includes(String(c.status || "").toLowerCase())) flows.cards_active_count += 1;
      flows.card_balance_usd += Number(c.balance || 0);
      flows.card_total_funded_usd += Number(c.total_funded_usd || 0);
    }
    // Enrichit chaque transaction avec un aperçu du propriétaire pour l'admin
    const txOwnerIds = Array.from(new Set((txs.data ?? []).map((t: any) => t.user_id).filter(Boolean)));
    let txOwnerMap: Record<string, any> = {};
    if (txOwnerIds.length > 0) {
      const { data: owners } = await admin.from("profiles").select("id,full_name,email").in("id", txOwnerIds);
      txOwnerMap = Object.fromEntries((owners ?? []).map((o: any) => [o.id, o]));
    }
    const enrichedTxs = (txs.data ?? []).map((t: any) => ({ ...t, owner: txOwnerMap[t.user_id] || null }));
    return { users: users.data ?? [], cards: enrichedCards, transactions: enrichedTxs, kyc: kyc.data ?? [], withdrawals: withdrawals.data ?? [], businesses: businesses.data ?? [], flows };
  },

  async adminStrowalletBalance({ user, admin }) {
    if (!(await isAdmin(admin, user.id))) throw new Error("Forbidden");
    try { return { ok: true, data: await SW.getStrowalletBalance() }; }
    catch (e) { return { ok: false, error: (e as Error).message }; }
  },

  // Synchronise le statut réel + le solde réel des cartes depuis l'émetteur,
  // et journalise l'historique des paiements carte dans `transactions`.
  async adminSyncCards({ data, user, admin }) {
    if (!(await isAdmin(admin, user.id))) throw new Error("Forbidden");
    let q = admin.from("cards").select("id,user_id,provider_card_id,status,balance,last4,brand,metadata").not("provider_card_id", "is", null);
    if (data?.card_id) q = q.eq("provider_card_id", data.card_id);
    const { data: rows, error } = await q.order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);

    const results: any[] = [];
    for (const c of rows ?? []) {
      const pid = c.provider_card_id as string;
      const before = { status: c.status, balance: Number(c.balance || 0) };
      try {
        const res = await SW.getNfcCardDetails(pid);
        const d = SW.extractCardDetails(res);
        const upd: any = { metadata: res };
        const st = String(d.status || "").toLowerCase();
        if (d.last4) upd.last4 = String(d.last4);
        if (d.brand) upd.brand = String(d.brand).toLowerCase();
        if (d.balance !== null && Number.isFinite(Number(d.balance))) upd.balance = Number(d.balance);

        if (isIssuerFailed(d) || ["terminated", "deleted", "cancelled", "canceled", "closed"].includes(st)) {
          upd.status = "terminated";
          upd.metadata = { ...(c.metadata as any || {}), provider_status: st || "failed", details: res };
          if (String(c.status) !== "terminated") {
            await refundCardBalanceToWallet(admin, c.user_id as string, pid, Number(c.balance || 0));
          }
          upd.balance = 0;
        } else if (st === "active") {
          upd.status = "active";
        } else if (st === "frozen") {
          upd.status = String(c.status) === "frozen_auto" ? "frozen_auto" : "frozen";
        }

        await admin.from("cards").update(upd).eq("provider_card_id", pid);

        // Historique des paiements carte (dédupliqué).
        let synced = 0;
        if (upd.status !== "terminated") {
          try {
            const items = SW.extractCardTransactions(await SW.getNfcCardHistory(pid));
            for (const t of items) {
              const sig = `cardtx:${pid}:${t.id || `${t.date || ""}-${t.amount || ""}`}`;
              const { data: existing } = await admin.from("transactions").select("id").eq("provider_ref", sig).maybeSingle();
              if (existing) continue;
              await admin.from("transactions").insert({
                user_id: c.user_id, type: "card_tx",
                status: t.status === "failed" ? "failed" : "success",
                amount: t.amount, currency: t.currency,
                provider: "issuer", provider_ref: sig,
                description: t.description,
                metadata: { card_id: pid, raw: t },
              });
              synced += 1;
            }
          } catch { /* historique indisponible */ }
        }

        results.push({
          card_id: c.id, provider_card_id: pid, last4: upd.last4 ?? c.last4,
          before, after: { status: upd.status ?? c.status, balance: upd.balance ?? before.balance },
          changed: (upd.status ?? c.status) !== before.status || Number(upd.balance ?? before.balance) !== before.balance,
          transactions_synced: synced, ok: true,
        });
      } catch (e) {
        results.push({ card_id: c.id, provider_card_id: pid, last4: c.last4, before, ok: false, error: (e as Error).message });
      }
    }
    return { ok: true, count: results.length, changed: results.filter((r) => r.changed).length, results };
  },

  // Historique des paiements d'une carte, pour l'administrateur.
  async adminCardTransactions({ data, user, admin }) {
    if (!(await isAdmin(admin, user.id))) throw new Error("Forbidden");
    const { data: card } = await admin.from("cards").select("user_id,status").eq("provider_card_id", data.card_id).maybeSingle();
    if (!card) return { ok: false, error: "Carte introuvable" };
    const { data: rows } = await admin.from("transactions")
      .select("amount,currency,status,description,created_at,metadata")
      .eq("user_id", card.user_id).eq("type", "card_tx")
      .order("created_at", { ascending: false }).limit(200);
    const items = (rows || [])
      .filter((r: any) => (r.metadata as any)?.card_id === data.card_id)
      .map((r: any) => ({ date: r.created_at, amount: r.amount, currency: r.currency, status: r.status, description: r.description }));
    return { ok: true, items };
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



  async listShopTemplates({ admin }) {
    const { data, error } = await admin.from("shop_templates").select("id,name,slug,description,thumbnail_url,preview_url,price,is_free,category,config").order("name");
    if (error) throw new Error(error.message);
    return { ok: true, templates: data || [] };
  },

  async getTemplatePreview({ data, admin }) {
    const { id } = data;
    const { data: template, error } = await admin.from("shop_templates").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return { ok: true, template };
  },


  async applyShopTemplate({ data, user, admin }) {
    const { business_id, template_id } = data;
    await assertBusinessOwner(admin, user.id, business_id);
    const { error } = await admin.from("businesses").update({ template_id }).eq("id", business_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  // L'utilisateur met à jour son propre profil (nom + téléphone + avatar).
  async updateMyProfile({ data, user, admin }) {
    const patch: Record<string, any> = {};
    if (typeof data.full_name === "string") patch.full_name = data.full_name.trim().slice(0, 120);
    if (typeof data.avatar_url === "string") patch.avatar_url = data.avatar_url.slice(0, 1024);
    if (typeof data.phone === "string") patch.phone = data.phone.trim().slice(0, 40);
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error, data: updatedData } = await admin.from("profiles").update(patch).eq("id", user.id).select();
    if (error) throw new Error(error.message);
    if (!updatedData || updatedData.length === 0) {
      return { ok: false, error: "Aucun profil trouvé à mettre à jour" };
    }
    return { ok: true, profile: updatedData[0] };
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
  async adminYengapayInspect({ data, user, admin }) {
    if (!(await isAdmin(admin, user.id))) throw new Error("Forbidden");
    const id = String(data?.id || "").trim();
    if (!id) throw new Error("id manquant");
    const apiKey = Deno.env.get("YENGAPAY_API_KEY");
    const groupId = Deno.env.get("YENGAPAY_GROUP_ID");
    const projectId = Deno.env.get("YENGAPAY_PROJECT_ID");
    if (!apiKey || !groupId || !projectId) throw new Error("YengaPay env missing");
    const base = "https://api.yengapay.com/api/v1";
    const paths = [
      `${base}/groups/${groupId}/projects/${projectId}/direct-payment/status/${id}`,
      `${base}/groups/${groupId}/projects/${projectId}/transactions/${id}`,
      `${base}/groups/${groupId}/projects/${projectId}/deposits/${id}`,
      `${base}/groups/${groupId}/transactions/${id}`,
      `${base}/groups/${groupId}/deposits/${id}`,
      `${base}/groups/${groupId}/projects/${projectId}/direct-payment/${id}`,
      `${base}/groups/${groupId}/projects/${projectId}/payments/${id}`,
      `${base}/transactions/${id}`,
    ];
    const results: any[] = [];
    for (const url of paths) {
      try {
        const r = await fetch(url, { headers: { "x-api-key": apiKey, "Accept": "application/json" } });
        const t = await r.text();
        let body: any = t; try { body = JSON.parse(t); } catch { /* keep text */ }
        results.push({ url, status: r.status, body });
      } catch (e) {
        results.push({ url, error: String(e) });
      }
    }
    return { ok: true, id, results };
  },
  async adminYengapayVerifyBatch({ data, user, admin }) {
    if (!(await isAdmin(admin, user.id))) throw new Error("Forbidden");
    const rawIds: string[] = Array.isArray(data?.ids) ? data.ids : [];
    const ids = Array.from(new Set(rawIds.map((s) => String(s || "").trim()).filter(Boolean))).slice(0, 50);
    if (ids.length === 0) throw new Error("Aucun ID fourni");
    const apiKey = Deno.env.get("YENGAPAY_API_KEY");
    const groupId = Deno.env.get("YENGAPAY_GROUP_ID");
    const projectId = Deno.env.get("YENGAPAY_PROJECT_ID");
    if (!apiKey || !groupId || !projectId) throw new Error("YengaPay env missing");

    async function lookup(id: string): Promise<any> {
      const urls = [
        `https://api.yengapay.com/api/v1/groups/${groupId}/projects/${projectId}/direct-payment/status/${id}`,
        `https://api.yengapay.com/api/v1/groups/${groupId}/projects/${projectId}/transactions/${id}`,
        `https://api.yengapay.com/api/v1/groups/${groupId}/transactions/${id}`,
      ];
      for (const u of urls) {
        try {
          const r = await fetch(u, { headers: { "x-api-key": apiKey, "Accept": "application/json" } });
          const t = await r.text(); let b: any = t; try { b = JSON.parse(t); } catch { /**/ }
          if (r.ok && b && typeof b === "object") return b;
        } catch { /**/ }
      }
      return null;
    }

    const results = await Promise.all(ids.map(async (id) => {
      const body = await lookupYengaPayment(id) || await lookup(id);
      const rawStatus = yengaStatus(body);
      const yengaState = yengaStateFromStatus(rawStatus);
      const amount = yengaAmount(body);
      const reference = yengaReference(body);
      const payer = yengaPayerPhone(body);

      // Try to match a local transaction: by metadata.paymentIntentId, by provider_ref (reference), or id embedded in metadata
      let tx: any = null;
      const { data: byIntent } = await admin.from("transactions")
        .select("id,user_id,amount,status,provider_ref,created_at")
        .eq("type", "deposit")
        .contains("metadata", { paymentIntentId: id } as any).limit(1).maybeSingle();
      if (byIntent) tx = byIntent;
      if (!tx && reference) {
        const { data: byRef } = await admin.from("transactions")
          .select("id,user_id,amount,status,provider_ref,created_at")
          .eq("provider_ref", String(reference)).maybeSingle();
        if (byRef) tx = byRef;
      }
      if (!tx) {
        const { data: byProviderId } = await admin.from("transactions")
          .select("id,user_id,amount,status,provider_ref,created_at")
          .eq("provider_ref", id).maybeSingle();
        if (byProviderId) tx = byProviderId;
      }
      let owner: any = null;
      if (tx?.user_id) {
        const { data: p } = await admin.from("profiles").select("id,full_name,email,phone").eq("id", tx.user_id).maybeSingle();
        owner = p || null;
      }
      const matchedOwner = owner || await findProfileByPhone(admin, payer);
      return {
        id,
        found: !!body,
        yengaState, rawStatus,
        amount, reference, payer,
        transaction: tx ? { ...tx, credited: tx.status === "success" } : null,
        owner,
        matchedOwner,
        canCreateCredit: !tx && yengaState === "success" && !!amount && !!matchedOwner,
      };
    }));
    return { ok: true, results };
  },
  async adminCreditYengapayExternal({ data, user, admin }) {
    if (!(await isAdmin(admin, user.id))) throw new Error("Forbidden");
    const yengaId = String(data?.yengaId || "").trim();
    if (!yengaId) throw new Error("ID YengaPay manquant");
    const body = await lookupYengaPayment(yengaId);
    if (!body) throw new Error("Paiement introuvable chez YengaPay");
    const rawStatus = yengaStatus(body);
    const state = yengaStateFromStatus(rawStatus);
    if (state !== "success") throw new Error(`Paiement non confirmé par YengaPay (${rawStatus || "statut inconnu"})`);
    const amount = yengaAmount(body);
    if (!amount) throw new Error("Montant YengaPay introuvable");
    const reference = yengaReference(body);
    const payer = yengaPayerPhone(body);
    const refs = Array.from(new Set([yengaId, reference].filter(Boolean).map(String)));
    for (const ref of refs) {
      const { data: existing } = await admin.from("transactions")
        .select("id,user_id,amount,status,type,currency,provider_ref,metadata")
        .eq("provider_ref", ref).maybeSingle();
      if (existing) {
        if (existing.status === "success") return { ok: true, alreadyCredited: true, tx_id: existing.id, amount: existing.amount, user_id: existing.user_id };
        if (existing.type === "deposit") {
          const { data: updated } = await admin.from("transactions")
            .update({ status: "success", metadata: { ...((existing.metadata as any) || {}), yengapay_external_credit: { id: yengaId, by: user.id, at: new Date().toISOString(), body } } })
            .eq("id", existing.id).eq("status", "pending").select("id").maybeSingle();
          if (updated) {
            const currency = existing.currency || "XOF";
            const { data: w } = await admin.from("wallets").select("id,balance").eq("user_id", existing.user_id).eq("currency", currency).maybeSingle();
            if (!w) throw new Error(`Portefeuille ${currency} introuvable`);
            const newBalance = Number(w.balance) + Number(existing.amount);
            await admin.from("wallets").update({ balance: newBalance }).eq("id", w.id);
            await notifyUser(admin, existing.user_id,
              "✅ Recharge créditée",
              txEmailHtml({ title: "Recharge créditée sur votre portefeuille", intro: "Votre paiement a été confirmé et votre solde a été crédité.", amount: Number(existing.amount), currency, reference: existing.provider_ref }),
              `Recharge de ${existing.amount} ${currency} créditée. Référence ${existing.provider_ref}.`);
          }
          return { ok: true, credited: true, tx_id: existing.id, amount: existing.amount, user_id: existing.user_id };
        }
      }
    }
    const requestedUserId = String(data?.userId || "").trim();
    let owner: any = null;
    if (requestedUserId) {
      const { data: p } = await admin.from("profiles").select("id,full_name,email,phone").eq("id", requestedUserId).maybeSingle();
      owner = p;
    }
    if (!owner) owner = await findProfileByPhone(admin, payer);
    if (!owner?.id) throw new Error("Utilisateur introuvable pour ce paiement : renseignez/corrigez le numéro du client puis relancez la vérification.");
    const { data: wallet } = await admin.from("wallets").select("id,balance").eq("user_id", owner.id).eq("currency", "XOF").maybeSingle();
    if (!wallet) throw new Error("Portefeuille XOF introuvable pour cet utilisateur");
    const providerRef = reference || yengaId;
    const { data: inserted, error: insErr } = await admin.from("transactions").insert({
      user_id: owner.id,
      type: "deposit",
      status: "success",
      amount,
      currency: "XOF",
      provider: "yengapay",
      provider_ref: providerRef,
      description: `Dépôt YengaPay rapproché (${yengaId})`,
      metadata: { yengapayExternalId: yengaId, payer, rawStatus, body, admin_credit: { by: user.id, at: new Date().toISOString(), note: String(data?.note || "") } },
    }).select("id").single();
    if (insErr) throw new Error(insErr.message);
    const newBalance = Number(wallet.balance) + Number(amount);
    await admin.from("wallets").update({ balance: newBalance }).eq("id", wallet.id);
    await notifyUser(admin, owner.id,
      "✅ Recharge créditée",
      txEmailHtml({ title: "Recharge créditée sur votre portefeuille", intro: "Votre paiement a été rapproché et votre solde a été crédité.", amount: Number(amount), currency: "XOF", reference: providerRef }),
      `Recharge de ${amount} XOF créditée. Référence ${providerRef}.`);
    return { ok: true, credited: true, tx_id: inserted.id, amount, user_id: owner.id, new_balance: newBalance };
  },
  async adminCreditPendingDeposit({ data, user, admin }) {
    if (!(await isAdmin(admin, user.id))) throw new Error("Forbidden");
    const txId = String(data?.txId || "").trim();
    const note = String(data?.note || "Crédit manuel — dépôt confirmé côté opérateur").slice(0, 500);
    if (!txId) throw new Error("txId manquant");
    const { data: tx } = await admin.from("transactions")
      .select("id,user_id,amount,currency,status,type,provider_ref,metadata").eq("id", txId).maybeSingle();
    if (!tx) throw new Error("Transaction introuvable");
    if (tx.type !== "deposit") throw new Error("La transaction n'est pas un dépôt");
    if (tx.status === "success") return { ok: true, alreadyCredited: true };
    if (tx.status === "failed") throw new Error("Transaction marquée échouée — impossible à créditer");
    const currency = String(tx.currency || "XOF");
    const { data: updated } = await admin.from("transactions")
      .update({ status: "success", metadata: { ...((tx.metadata as any) || {}), admin_credit: { by: user.id, at: new Date().toISOString(), note } } })
      .eq("id", tx.id).eq("status", "pending").select("id").maybeSingle();
    if (!updated) return { ok: true, alreadyCredited: true };
    const { data: w } = await admin.from("wallets").select("id,balance").eq("user_id", tx.user_id).eq("currency", currency).maybeSingle();
    if (!w) throw new Error(`Portefeuille ${currency} introuvable`);
    const newBalance = Number(w.balance) + Number(tx.amount);
    await admin.from("wallets").update({ balance: newBalance }).eq("id", w.id);
    await notifyUser(admin, tx.user_id,
      "✅ Recharge créditée",
      txEmailHtml({ title: "Recharge créditée sur votre portefeuille", intro: "Votre paiement a été confirmé et votre solde a été crédité.", amount: Number(tx.amount), currency, reference: tx.provider_ref }),
      `Recharge de ${tx.amount} ${currency} créditée. Référence ${tx.provider_ref}.`);
    return { ok: true, credited: true, new_balance: newBalance, user_id: tx.user_id, amount: tx.amount };
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
    const { data: extras } = await admin.from("platform_config").select("key,value").in("key", ["whatsapp_group_url", "referral_reward_xof", "admin_notification_phone", "notify_admin_sender_request", "sender_request_admin_template", "sender_request_user_template"]);
    const extrasMap: Record<string, any> = {};
    for (const r of extras ?? []) {
      if (r.key === "notify_admin_sender_request") {
        extrasMap[r.key] = r.value === "true";
      } else {
        // Plain string or number
        extrasMap[r.key] = r.value;
      }
    }
    return { ok: true, config: { ...cfg, ...extrasMap } };
  },

  async adminUpdateConfig({ data, user, admin }) {
    if (!(await isAdmin(admin, user.id))) throw new Error("Forbidden");
    const allowedNumbers = ["card_issue_fee_xof", "usd_rate_xof", "strowallet_fixed_fee_usd", "strowallet_pct_fee", "referral_reward_xof"];
    const allowedStrings = ["whatsapp_group_url", "admin_notification_phone", "sender_request_admin_template", "sender_request_user_template"];
    const allowedBools = ["notify_admin_sender_request"];
    const updates: Array<{ key: string; value: any }> = [];
    for (const k of allowedNumbers) {
      if (data?.[k] !== undefined && data[k] !== null && data[k] !== "") {
        const n = Number(data[k]);
        if (!Number.isFinite(n) || n < 0) return { ok: false, error: `Valeur invalide pour ${k}` };
        updates.push({ key: k, value: n });
      }
    }
    for (const k of allowedStrings) {
      if (data?.[k] !== undefined && data[k] !== null) {
        updates.push({ key: k, value: String(data[k]).trim().slice(0, 1000) });
      }
    }
    for (const k of allowedBools) {
      if (data?.[k] !== undefined && data[k] !== null) {
        updates.push({ key: k, value: !!data[k] });
      }
    }
    for (const u of updates) {
      // Force JSON stringification for jsonb column
      // Note: newValue will be a string like '"value"' for jsonb storage
      const jsonValue = JSON.stringify(u.value);
      
      const { data: updated, error: upsertError } = await admin.from("platform_config")
        .upsert({ key: u.key, value: jsonValue }, { onConflict: "key" })
        .select("value")
        .maybeSingle();
        
      if (upsertError) throw new Error(`Erreur lors de la mise à jour de ${u.key}: ${upsertError.message}`);
      
      // Strict post-upsert verification
      if (!updated || JSON.stringify(updated.value) !== jsonValue) {
        throw new Error(`Échec de vérification après écriture pour ${u.key}. Attendu: ${jsonValue}, Obtenu: ${updated ? JSON.stringify(updated.value) : 'null'}`);
      }
      console.log(`[ConfigUpdate] ${u.key} updated and verified to ${jsonValue}`);
    }
    const cfg = await loadPricingConfig(admin);
    const { data: extras } = await admin.from("platform_config").select("key,value").in("key", ["whatsapp_group_url", "referral_reward_xof", "admin_notification_phone", "notify_admin_sender_request", "sender_request_admin_template", "sender_request_user_template"]);
    const extrasMap: Record<string, any> = {};
    for (const r of extras ?? []) {
      try {
        // If it's already a JS object (shouldn't be, but for safety)
        if (typeof r.value !== 'string') {
          extrasMap[r.key] = r.value;
        } else {
          extrasMap[r.key] = JSON.parse(r.value);
        }
      } catch (e) {
        // Fallback for unquoted old values
        extrasMap[r.key] = r.value;
      }
    }
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
      .select("id,name,slug,description,logo_url,cover_url,contact_email,contact_phone,country,status,fee_bps,balance,created_at")
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
    for (const k of ["name", "description", "tagline", "theme", "contact_email", "contact_phone", "logo_url", "cover_url"]) {
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
    await assertUserRateLimit(admin, user.id, "cashoutBusinessBalance", 6);
    const biz = await assertBusinessOwner(admin, user.id, data.business_id);
    const { data: b } = await admin.from("businesses").select("balance,owner_id").eq("id", biz.id).single();
    const totalBalance = Number(b?.balance || 0);
    if (totalBalance <= 0) return { ok: false, error: "Solde nul" };
    
    // Apply cashout fees
    const cfg = await loadGatewayFeeConfig(admin);
    const feePct = Math.ceil((totalBalance * cfg.business_cashout_fee_bps) / 10000);
    const fees = Math.max(cfg.business_cashout_min_xof, feePct + cfg.business_cashout_fee_flat_xof);
    const netAmount = Math.max(0, totalBalance - fees);
    
    if (netAmount <= 0 && totalBalance > 0) return { ok: false, error: `Le solde est insuffisant pour couvrir les frais de retrait (${fees} XOF)` };

    const { data: w } = await admin.from("wallets").select("id,balance").eq("user_id", b.owner_id).eq("currency", "XOF").maybeSingle();
    if (!w) return { ok: false, error: "Wallet XOF introuvable" };
    
    await admin.from("wallets").update({ balance: Number(w.balance) + netAmount }).eq("id", w.id);
    await admin.from("businesses").update({ balance: 0 }).eq("id", biz.id);
    
    await admin.from("transactions").insert({
      user_id: b.owner_id, type: "deposit", status: "success",
      amount: netAmount, currency: "XOF",
      description: `Retrait solde business → wallet (frais: ${fees} XOF)`,
      metadata: { business_id: biz.id, fees, gross_amount: totalBalance },
    });
    
    // Accounting
    await admin.from("accounting_entries").insert({
      business_id: biz.id, kind: "expense",
      label: "Retrait vers portefeuille",
      amount: totalBalance, currency: "XOF",
      entry_date: new Date().toISOString().slice(0, 10),
      auto_generated: true,
      notes: `Retrait solde boutique. Net: ${netAmount}, Frais: ${fees}`,
    });
    
    return { ok: true, transferred: netAmount, fees };
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
    for (const k of ["name", "description", "logo_url", "cover_url", "currency", "financial_goal", "goal_deadline", "status", "show_in_shop"]) {
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
    let business_id = data?.business_id;
    if (!business_id) {
      const { data: p } = await admin.from("projects").select("business_id").eq("id", data.project_id).maybeSingle();
      if (!p) throw new Error("Projet introuvable");
      business_id = p.business_id;
    }
    await assertBusinessOwner(admin, user.id, business_id);
    let q = admin.from("products")
      .select("*, product_media(id,type,url,position), product_categories(id,name,slug)").eq("business_id", business_id);
    if (data?.project_id) q = q.eq("project_id", data.project_id);
    const { data: rows, error } = await q.order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  },
  async createProduct({ data, user, admin }) {
    let business_id = data?.business_id;
    if (!business_id) {
      const { data: p } = await admin.from("projects").select("business_id").eq("id", data.project_id).maybeSingle();
      if (!p) throw new Error("Projet introuvable");
      business_id = p.business_id;
    }
    await assertBusinessOwner(admin, user.id, business_id);
    const name = String(data?.name || "").trim();
    if (name.length < 2) throw new Error("Nom requis");
    const slug = slugify(name) + "-" + randomHex(2);
    const { data: row, error } = await admin.from("products").insert({
      project_id: data?.project_id || null, business_id,
      name, slug,
      description: data?.description || null,
      price: Number(data?.price || 0),
      currency: data?.currency || "XOF",
      sku: data?.sku || null,
      stock: data?.stock ?? null,
      image_url: data?.image_url || null,
      show_in_shop: data?.show_in_shop !== undefined ? Boolean(data.show_in_shop) : true,
      type: data?.type || "physical",
      short_description: data?.short_description || null,
      sale_price: data?.sale_price ?? null,
      purchase_note: data?.purchase_note || null,
      access_instructions: data?.access_instructions || null,
      downloadable: Boolean(data?.downloadable),
      download_url: data?.download_url || null,
      download_name: data?.download_name || null,
      download_limit: data?.download_limit ?? null,
      download_expiry_days: data?.download_expiry_days ?? null,
      manage_stock: Boolean(data?.manage_stock),
      tax_rate: Number(data?.tax_rate || 0),
      weight: data?.weight ?? null,
      category_id: data?.category_id || null,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  },
  async updateProduct({ data, user, admin }) {
    const { data: prod } = await admin.from("products").select("business_id").eq("id", data.id).maybeSingle();
    if (!prod) throw new Error("Produit introuvable");
    await assertBusinessOwner(admin, user.id, prod.business_id);
    const patch: Record<string, any> = {};
    for (const k of [
      "name", "description", "price", "currency", "sku", "stock", "status", "show_in_shop", "image_url", "project_id",
      "type", "short_description", "sale_price", "purchase_note", "access_instructions", "downloadable",
      "download_url", "download_name", "download_limit", "download_expiry_days", "manage_stock", "tax_rate", "weight",
      "category_id",
    ]) {
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

  // Catégories déplacées



  // ===========================================================
  // PROJECT API KEYS / WEBHOOKS (passerelle de paiement)
  // ===========================================================
  async getProjectIntegration({ data, user, admin }) {
    const { data: p } = await admin.from("projects").select("business_id").eq("id", data.project_id).maybeSingle();
    if (!p) throw new Error("Projet introuvable");
    await assertBusinessOwner(admin, user.id, p.business_id);
    const { data: key } = await admin.from("project_api_keys")
      .select("id,mode,public_key,secret_prefix,webhook_url,webhook_secret,last_used_at,revoked_at,created_at")
      .eq("project_id", data.project_id).is("revoked_at", null)
      .order("created_at", { ascending: false }).maybeSingle();
    const { data: deliveries } = await admin.from("project_webhook_deliveries")
      .select("*").eq("project_id", data.project_id).order("created_at", { ascending: false }).limit(20);
    const fee = await loadGatewayFeeConfig(admin);
    return { key: key || null, deliveries: deliveries ?? [], fee, endpoint: `${SUPABASE_URL}/functions/v1/pay/v1` };
  },

  async createProjectApiKeys({ data, user, admin }) {
    const { data: p } = await admin.from("projects").select("id,business_id").eq("id", data.project_id).maybeSingle();
    if (!p) throw new Error("Projet introuvable");
    await assertBusinessOwner(admin, user.id, p.business_id);
    const mode = data?.mode === "test" ? "test" : "live";
    // révoque les clés existantes (rotation)
    await admin.from("project_api_keys").update({ revoked_at: new Date().toISOString() })
      .eq("project_id", p.id).is("revoked_at", null);
    const public_key = `pk_${mode}_${randomHex(16)}`;
    const secret = `sk_${mode}_${randomHex(24)}`;
    const secret_hash = await sha256Hex(secret);
    const webhook_secret = `whsec_${randomHex(24)}`;
    const { data: row, error } = await admin.from("project_api_keys").insert({
      project_id: p.id, business_id: p.business_id, mode,
      public_key, secret_prefix: secret.slice(0, 14), secret_hash,
      webhook_url: data?.webhook_url || null, webhook_secret,
    }).select("id,mode,public_key,secret_prefix,webhook_url,webhook_secret,created_at").single();
    if (error) throw new Error(error.message);
    return { ...row, secret_key: secret };
  },

  async updateProjectWebhook({ data, user, admin }) {
    const { data: key } = await admin.from("project_api_keys").select("id,business_id").eq("id", data.id).maybeSingle();
    if (!key) throw new Error("Clé introuvable");
    await assertBusinessOwner(admin, user.id, key.business_id);
    const url = data?.webhook_url ? String(data.webhook_url).trim() : null;
    if (url && !/^https?:\/\//i.test(url)) throw new Error("URL de webhook invalide");
    const { data: row, error } = await admin.from("project_api_keys")
      .update({ webhook_url: url }).eq("id", data.id)
      .select("id,mode,public_key,secret_prefix,webhook_url,webhook_secret,created_at").single();
    if (error) throw new Error(error.message);
    return row;
  },

  async revokeProjectApiKeys({ data, user, admin }) {
    const { data: key } = await admin.from("project_api_keys").select("id,business_id").eq("id", data.id).maybeSingle();
    if (!key) throw new Error("Clé introuvable");
    await assertBusinessOwner(admin, user.id, key.business_id);
    await admin.from("project_api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", data.id);
    return { ok: true };
  },

  // Simulation interne : envoie un webhook signé de test et journalise le résultat
  async simulateProjectWebhook({ data, user, admin }) {
    const { data: p } = await admin.from("projects").select("id,business_id,name,currency").eq("id", data.project_id).maybeSingle();
    if (!p) throw new Error("Projet introuvable");
    await assertBusinessOwner(admin, user.id, p.business_id);
    const { data: key } = await admin.from("project_api_keys")
      .select("*").eq("project_id", p.id).is("revoked_at", null)
      .order("created_at", { ascending: false }).maybeSingle();
    if (!key) throw new Error("Générez d'abord les clés API du projet");
    const event = String(data?.event || "payment.succeeded");
    const amount = Math.max(1, Math.floor(Number(data?.amount || 1000)));
    const cfg = await loadGatewayFeeConfig(admin);
    const feePct = Math.ceil((amount * cfg.fee_bps) / 10000);
    const feeAmount = Math.max(cfg.min_xof, feePct + cfg.fee_flat_xof);
    const payload = {
      event,
      test: true,
      data: {
        reference: `SIMU-${Date.now().toString(36).toUpperCase()}`,
        project_id: p.id,
        amount,
        fee_amount: feeAmount,
        net_amount: Math.max(0, amount - feeAmount),
        currency: p.currency || "XOF",
        status: event === "payment.failed" ? "failed" : "success",
        customer: { name: "Client Test", phone: "22670000000", email: "test@example.com" },
        paid_at: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    };
    return await dispatchProjectWebhook(admin, { project: p, key, payload, event, simulated: true });
  },

  async listProjectWebhookDeliveries({ data, user, admin }) {
    const { data: p } = await admin.from("projects").select("business_id").eq("id", data.project_id).maybeSingle();
    if (!p) throw new Error("Projet introuvable");
    await assertBusinessOwner(admin, user.id, p.business_id);
    const { data: rows } = await admin.from("project_webhook_deliveries")
      .select("*").eq("project_id", data.project_id).order("created_at", { ascending: false }).limit(30);
    return rows ?? [];
  },

  // Suivi des transactions d'un projet (soldes, encaissements, retraits, statuts)
  async getProjectTransactions({ data, user, admin }) {
    const { data: p } = await admin.from("projects")
      .select("id,business_id,name,balance,currency").eq("id", data.project_id).maybeSingle();
    if (!p) throw new Error("Projet introuvable");
    await assertBusinessOwner(admin, user.id, p.business_id);
    const { data: rows } = await admin.from("payment_link_payments")
      .select("id,reference,amount,fee_amount,net_amount,currency,status,customer_name,customer_email,customer_phone,paid_at,created_at,metadata")
      .eq("project_id", p.id).order("created_at", { ascending: false }).limit(200);
    const list = rows ?? [];
    const sum = (s: string) => list.filter((r: any) => r.status === s).reduce((a: number, r: any) => a + Number(r.amount || 0), 0);
    const stats = {
      balance: Number(p.balance || 0),
      currency: p.currency || "XOF",
      collected: list.filter((r: any) => r.status === "success").reduce((a: number, r: any) => a + Number(r.net_amount || r.amount || 0), 0),
      fees: list.filter((r: any) => r.status === "success").reduce((a: number, r: any) => a + Number(r.fee_amount || 0), 0),
      success_amount: sum("success"), pending_amount: sum("pending"), failed_amount: sum("failed"),
      success_count: list.filter((r: any) => r.status === "success").length,
      pending_count: list.filter((r: any) => r.status === "pending").length,
      failed_count: list.filter((r: any) => r.status === "failed").length,
    };
    // Retraits (sorties comptables liées au projet)
    const { data: outs } = await admin.from("accounting_entries")
      .select("amount").eq("business_id", p.business_id).eq("kind", "expense");
    const withdrawn = (outs ?? []).reduce((a: number, r: any) => a + Number(r.amount || 0), 0);
    return { project: p, stats: { ...stats, withdrawn }, transactions: list };
  },

  // Accès numériques délivrés aux clients
  async listProductDownloads({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    const { data: rows } = await admin.from("product_downloads")
      .select("*").eq("business_id", data.business_id).order("created_at", { ascending: false }).limit(100);
    return rows ?? [];
  },

  async getGatewayFeeConfig({ admin }) {
    return await loadGatewayFeeConfig(admin);
  },
  async adminUpdateGatewayFeeConfig({ data, user, admin }) {
    if (!(await isAdmin(admin, user.id))) throw new Error("Forbidden");
    const map: Record<string, any> = {
      gateway_fee_bps: data?.fee_bps,
      gateway_fee_flat_xof: data?.fee_flat_xof,
      gateway_min_xof: data?.min_xof,
      gateway_enabled: data?.enabled,
      admin_notification_phone: data?.admin_notification_phone,
      gateway_sms_price: data?.sms_price,
      business_cashout_fee_bps: data?.business_cashout_fee_bps,
      business_cashout_fee_flat_xof: data?.business_cashout_fee_flat_xof,
      business_cashout_min_xof: data?.business_cashout_min_xof,
    };
    for (const [k, v] of Object.entries(map)) {
      if (v === undefined || v === null) continue;
      await admin.from("platform_config").upsert({ key: k, value: v }, { onConflict: "key" });
    }
    return await loadGatewayFeeConfig(admin);
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
      template_slug: data.template_slug || "stripe-modern",
      notes: data.notes || null,
      discount_amount: data.discount_amount || 0,
      metadata: data.metadata || {}
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  },
  async updateInvoice({ data, user, admin }) {
    const { data: inv } = await admin.from("invoices").select("business_id").eq("id", data.id).maybeSingle();
    if (!inv) throw new Error("Facture introuvable");
    await assertBusinessOwner(admin, user.id, inv.business_id);
    const patch: Record<string, any> = {};
    const allowed = ["status", "pdf_url", "customer_name", "customer_email", "customer_phone", "template_slug", "notes", "items", "subtotal", "tax", "total", "discount_amount", "metadata"];
    for (const k of allowed) {
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

  // ===========================================================
  // ORDERS (merchant order management)
  // ===========================================================
  async listOrders({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    let q: any = admin.from("orders")
      .select("id,order_number,public_token,status,customer_name,customer_email,customer_phone,total_amount,currency,paid_at,created_at,updated_at,shipping_address,merchant_note")
      .eq("business_id", data.business_id).order("created_at", { ascending: false }).limit(200);
    if (data?.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const ids = (rows || []).map((r: any) => r.id);
    let items: any[] = [];
    if (ids.length) {
      const { data: it } = await admin.from("order_items").select("order_id,name,unit_price,quantity").in("order_id", ids);
      items = it || [];
    }
    return (rows || []).map((r: any) => ({ ...r, items: items.filter((i) => i.order_id === r.id) }));
  },

  async updateOrderStatus({ data, user, admin }) {
    const { data: o } = await admin.from("orders").select("id,business_id,customer_email,order_number,status").eq("id", data.id).maybeSingle();
    if (!o) throw new Error("Commande introuvable");
    await assertBusinessOwner(admin, user.id, o.business_id);
    const allowed = ["pending_payment","paid","preparing","shipped","delivered","cancelled","refunded"];
    const next = String(data?.status || "");
    if (!allowed.includes(next)) throw new Error("Statut invalide");
    const patch: any = { status: next };
    if (data?.merchant_note !== undefined) patch.merchant_note = data.merchant_note;
    const { data: row, error } = await admin.from("orders").update(patch).eq("id", data.id).select("*").single();
    if (error) throw new Error(error.message);
    // Notification client
    if (o.customer_email && next !== o.status) {
      const labels: Record<string,string> = {
        paid: "Paiement confirmé", preparing: "En préparation",
        shipped: "Expédiée", delivered: "Livrée",
        cancelled: "Annulée", refunded: "Remboursée",
      };
      const label = labels[next] || next;
      try {
        await sendEmail({
          to: o.customer_email,
          subject: `Commande ${o.order_number} — ${label}`,
          html: `<div style="font-family:Arial,sans-serif;padding:24px;color:#0f172a"><h2>Commande ${o.order_number}</h2><p>Statut : <b>${label}</b></p><p style="color:#64748b;font-size:12px">FASO-INVEST PAY</p></div>`,
          text: `Votre commande ${o.order_number} : ${label}`,
        });
      } catch (e) { console.error("order status email", e); }
    }
    return row;
  },

  // ===========================================================
  // BUSINESS POSTS (feed / publications)
  // ===========================================================
  async listBusinessPosts({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    const { data: rows, error } = await admin.from("business_posts")
      .select("*").eq("business_id", data.business_id).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  },

  async createBusinessPost({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    const title = String(data?.title || "").trim();
    if (title.length < 2) throw new Error("Titre requis");
    const published = !!data?.published;
    const { data: row, error } = await admin.from("business_posts").insert({
      business_id: data.business_id, title,
      body: data?.body || null, image_url: data?.image_url || null,
      product_id: data?.product_id || null,
      published, published_at: published ? new Date().toISOString() : null,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  },

  async updateBusinessPost({ data, user, admin }) {
    const { data: p } = await admin.from("business_posts").select("business_id,published").eq("id", data.id).maybeSingle();
    if (!p) throw new Error("Publication introuvable");
    await assertBusinessOwner(admin, user.id, p.business_id);
    const patch: Record<string, any> = {};
    for (const k of ["title","body","image_url","product_id","published"]) {
      if (data?.[k] !== undefined) patch[k] = data[k];
    }
    if (data?.published === true && !p.published) patch.published_at = new Date().toISOString();
    const { data: row, error } = await admin.from("business_posts").update(patch).eq("id", data.id).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  },

  async deleteBusinessPost({ data, user, admin }) {
    const { data: p } = await admin.from("business_posts").select("business_id").eq("id", data.id).maybeSingle();
    if (!p) throw new Error("Publication introuvable");
    await assertBusinessOwner(admin, user.id, p.business_id);
    await admin.from("business_posts").delete().eq("id", data.id);
    return { ok: true };
  },

  // ============================================================
  // CHAT PAY (WhatsApp via worker externe Baileys)
  // ============================================================

  async getWhatsappSession({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    const { data: s } = await admin.from("whatsapp_sessions")
      .select("id,status,qr_data_url,phone_number,worker_version,last_seen_at,created_at,connection_secret")
      .eq("business_id", data.business_id).maybeSingle();
    if (!s) return null;
    const online = s.last_seen_at && (Date.now() - new Date(s.last_seen_at).getTime()) < 90_000;
    return { ...s, worker_online: !!online };
  },

  async createWhatsappSession({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    const secret = "wa_" + crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const { data: existing } = await admin.from("whatsapp_sessions").select("id").eq("business_id", data.business_id).maybeSingle();
    if (existing) {
      await admin.from("whatsapp_sessions").update({ connection_secret: secret, status: "disconnected", qr_data_url: null, phone_number: null, last_seen_at: null }).eq("id", existing.id);
    } else {
      await admin.from("whatsapp_sessions").insert({ business_id: data.business_id, connection_secret: secret, status: "disconnected" });
    }
    const { data: s } = await admin.from("whatsapp_sessions").select("*").eq("business_id", data.business_id).single();
    return s;
  },

  async resetWhatsappSession({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    await admin.from("whatsapp_sessions").update({ status: "disconnected", qr_data_url: null, phone_number: null }).eq("business_id", data.business_id);
    return { ok: true };
  },

  async sendWhatsappMessage({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    const to = String(data?.to || "").trim();
    const body = String(data?.body || "").trim();
    if (!to || !body) throw new Error("Destinataire et message requis");
    const { data: s } = await admin.from("whatsapp_sessions").select("id,status").eq("business_id", data.business_id).maybeSingle();
    if (!s) throw new Error("Aucune session WhatsApp — génère un worker d'abord.");
    if (s.status !== "connected") throw new Error("Worker non connecté. Scanne le QR d'abord.");
    const { data: row, error } = await admin.from("whatsapp_outbound").insert({ session_id: s.id, to_jid: to, body }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  },

  async listWhatsappEvents({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    const { data: s } = await admin.from("whatsapp_sessions").select("id").eq("business_id", data.business_id).maybeSingle();
    if (!s) return [];
    const { data: rows } = await admin.from("whatsapp_events")
      .select("id,kind,payload,created_at").eq("session_id", s.id)
      .order("created_at", { ascending: false }).limit(50);
    return rows ?? [];
  },

  // ============================================================
  // BOT — modération, config, IA, conversations, logs
  // ============================================================
  async _botSessionFor(admin: any, userId: string, business_id: string) {
    await assertBusinessOwner(admin, userId, business_id);
    const { data: s } = await admin.from("whatsapp_sessions").select("id").eq("business_id", business_id).maybeSingle();
    if (!s) throw new Error("Aucune session WhatsApp — génère un worker d'abord.");
    return s.id as string;
  },

  async getBotConfig({ data, user, admin }) {
    const sid = await (HANDLERS as any)._botSessionFor(admin, user.id, data.business_id);
    let { data: cfg } = await admin.from("bot_config").select("*").eq("session_id", sid).maybeSingle();
    if (!cfg) {
      const { data: created } = await admin.from("bot_config").insert({ session_id: sid, business_id: data.business_id }).select("*").single();
      cfg = created;
    }
    return cfg;
  },

  async updateBotConfig({ data, user, admin }) {
    const sid = await (HANDLERS as any)._botSessionFor(admin, user.id, data.business_id);
    const patch: any = { ...data };
    delete patch.business_id;
    if (typeof patch.link_whitelist === "string") {
      patch.link_whitelist = String(patch.link_whitelist).split(/[,\s]+/).map((s: string) => s.trim()).filter(Boolean);
    }
    const { data: row, error } = await admin.from("bot_config").update(patch).eq("session_id", sid).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  },

  async listBotGroups({ data, user, admin }) {
    const sid = await (HANDLERS as any)._botSessionFor(admin, user.id, data.business_id);
    const { data: rows } = await admin.from("bot_groups").select("*").eq("session_id", sid).order("created_at", { ascending: false });
    return rows ?? [];
  },

  async updateBotGroup({ data, user, admin }) {
    await (HANDLERS as any)._botSessionFor(admin, user.id, data.business_id);
    const { data: row, error } = await admin.from("bot_groups").update(data.patch || {}).eq("id", data.id).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  },

  async listBotWarnings({ data, user, admin }) {
    const sid = await (HANDLERS as any)._botSessionFor(admin, user.id, data.business_id);
    const { data: rows } = await admin.from("bot_warnings").select("*").eq("session_id", sid).order("last_at", { ascending: false }).limit(100);
    return rows ?? [];
  },

  async listBotLogs({ data, user, admin }) {
    const sid = await (HANDLERS as any)._botSessionFor(admin, user.id, data.business_id);
    const { data: rows } = await admin.from("bot_logs").select("*").eq("session_id", sid).order("created_at", { ascending: false }).limit(100);
    return rows ?? [];
  },

  async listBotFaq({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    const { data: rows } = await admin.from("bot_ai_faq").select("*").eq("business_id", data.business_id).order("created_at", { ascending: false });
    return rows ?? [];
  },

  async upsertBotFaq({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    if (data.id) {
      const { data: row, error } = await admin.from("bot_ai_faq").update({
        question: data.question, answer: data.answer, active: data.active ?? true,
      }).eq("id", data.id).select("*").single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await admin.from("bot_ai_faq").insert({
      business_id: data.business_id, question: data.question, answer: data.answer, active: data.active ?? true,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  },

  async deleteBotFaq({ data, user, admin }) {
    const { data: f } = await admin.from("bot_ai_faq").select("business_id").eq("id", data.id).maybeSingle();
    if (!f) return { ok: true };
    await assertBusinessOwner(admin, user.id, f.business_id);
    await admin.from("bot_ai_faq").delete().eq("id", data.id);
    return { ok: true };
  },

  async listBotConversations({ data, user, admin }) {
    const sid = await (HANDLERS as any)._botSessionFor(admin, user.id, data.business_id);
    const { data: rows } = await admin.from("bot_ai_conversations").select("*").eq("session_id", sid).order("last_message_at", { ascending: false }).limit(50);
    return rows ?? [];
  },

  async getBotConversation({ data, user, admin }) {
    const { data: c } = await admin.from("bot_ai_conversations").select("*").eq("id", data.id).maybeSingle();
    if (!c) throw new Error("Conversation introuvable");
    const sid = await (HANDLERS as any)._botSessionFor(admin, user.id, data.business_id);
    if (c.session_id !== sid) throw new Error("Forbidden");
    const { data: msgs } = await admin.from("bot_ai_messages").select("*").eq("conversation_id", data.id).order("created_at", { ascending: true }).limit(200);
    return { conversation: c, messages: msgs ?? [] };
  },

  async toggleBotHandoff({ data, user, admin }) {
    const { data: c } = await admin.from("bot_ai_conversations").select("session_id,handoff").eq("id", data.id).maybeSingle();
    if (!c) throw new Error("Conversation introuvable");
    const sid = await (HANDLERS as any)._botSessionFor(admin, user.id, data.business_id);
    if (c.session_id !== sid) throw new Error("Forbidden");
    const { data: row, error } = await admin.from("bot_ai_conversations").update({ handoff: !c.handoff }).eq("id", data.id).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  },

  async sendBotHumanReply({ data, user, admin }) {
    const { data: c } = await admin.from("bot_ai_conversations").select("session_id,contact_jid").eq("id", data.id).maybeSingle();
    if (!c) throw new Error("Conversation introuvable");
    const sid = await (HANDLERS as any)._botSessionFor(admin, user.id, data.business_id);
    if (c.session_id !== sid) throw new Error("Forbidden");
    const body = String(data.body || "").trim();
    if (!body) throw new Error("Message vide");
    await admin.from("whatsapp_outbound").insert({ session_id: sid, to_jid: c.contact_jid, body });
    await admin.from("bot_ai_messages").insert({ conversation_id: data.id, role: "human", content: body });
    await admin.from("bot_ai_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", data.id);
    return { ok: true };
  },

  // ============================================================
  // COMPTABILITÉ
  // ============================================================
  async listAccountingCategories({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    const { data: rows } = await admin.from("accounting_categories")
      .select("*").eq("business_id", data.business_id).order("name");
    return rows ?? [];
  },
  async upsertAccountingCategory({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    if (data.id) {
      const { data: row, error } = await admin.from("accounting_categories")
        .update({ name: data.name, color: data.color, kind: data.kind })
        .eq("id", data.id).select("*").single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await admin.from("accounting_categories")
      .insert({ business_id: data.business_id, name: data.name, color: data.color || null, kind: data.kind })
      .select("*").single();
    if (error) throw new Error(error.message);
    return row;
  },
  async deleteAccountingCategory({ data, user, admin }) {
    const { data: c } = await admin.from("accounting_categories").select("business_id").eq("id", data.id).maybeSingle();
    if (!c) return { ok: true };
    await assertBusinessOwner(admin, user.id, c.business_id);
    await admin.from("accounting_categories").delete().eq("id", data.id);
    return { ok: true };
  },

  async listAccountingEntries({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    let q = admin.from("accounting_entries")
      .select("*, category:accounting_categories(name,color)")
      .eq("business_id", data.business_id)
      .order("entry_date", { ascending: false }).limit(500);
    if (data.from) q = q.gte("entry_date", data.from);
    if (data.to) q = q.lte("entry_date", data.to);
    if (data.kind) q = q.eq("kind", data.kind);
    const { data: rows } = await q;
    return rows ?? [];
  },
  async upsertAccountingEntry({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    const patch: any = {
      business_id: data.business_id,
      kind: data.kind, category_id: data.category_id || null,
      label: data.label, amount: Number(data.amount || 0),
      currency: data.currency || "XOF",
      entry_date: data.entry_date || new Date().toISOString().slice(0, 10),
      notes: data.notes || null, attachment_url: data.attachment_url || null,
      related_order_id: data.related_order_id || null,
      related_invoice_id: data.related_invoice_id || null,
      account_id: data.account_id || null,
      tva_rate: Number(data.tva_rate || 0),
      tva_amount: Number(data.tva_amount || 0),
      syscohada_code: data.syscohada_code || null,
      counterparty: data.counterparty || null,
    };
    if (data.id) {
      const { data: row, error } = await admin.from("accounting_entries")
        .update(patch).eq("id", data.id).select("*").single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await admin.from("accounting_entries")
      .insert(patch).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  },
  async deleteAccountingEntry({ data, user, admin }) {
    const { data: e } = await admin.from("accounting_entries").select("business_id").eq("id", data.id).maybeSingle();
    if (!e) return { ok: true };
    await assertBusinessOwner(admin, user.id, e.business_id);
    await admin.from("accounting_entries").delete().eq("id", data.id);
    return { ok: true };
  },
  async getAccountingSummary({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    const from = data.from || new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1).toISOString().slice(0, 10);
    const to = data.to || new Date().toISOString().slice(0, 10);
    const { data: rows } = await admin.from("accounting_entries")
      .select("kind,amount,currency,entry_date,category_id")
      .eq("business_id", data.business_id).gte("entry_date", from).lte("entry_date", to);
    const monthly: Record<string, { income: number; expense: number }> = {};
    let income = 0, expense = 0;
    for (const r of rows || []) {
      const m = String(r.entry_date).slice(0, 7);
      if (!monthly[m]) monthly[m] = { income: 0, expense: 0 };
      const amt = Number(r.amount || 0);
      monthly[m][r.kind as "income" | "expense"] += amt;
      if (r.kind === "income") income += amt; else expense += amt;
    }
    return {
      totals: { income, expense, net: income - expense },
      monthly: Object.entries(monthly).sort(([a], [b]) => a.localeCompare(b))
        .map(([month, v]) => ({ month, ...v, net: v.income - v.expense })),
    };
  },

  // ============================================================
  // CONTRATS & FACTURES (documents)
  // ============================================================
  async listContractTemplates({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    const { data: rows } = await admin.from("contract_templates")
      .select("*").eq("business_id", data.business_id).order("created_at", { ascending: false });
    return rows ?? [];
  },
  async upsertContractTemplate({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    const vars = Array.from(new Set(String(data.content || "").match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)?.map((m) => m.replace(/[{}\s]/g, "")) || []));
    const patch = { name: data.name, kind: data.kind || "contract", content: data.content, variables: vars };
    if (data.id) {
      const { data: row, error } = await admin.from("contract_templates").update(patch).eq("id", data.id).select("*").single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await admin.from("contract_templates")
      .insert({ business_id: data.business_id, ...patch }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  },
  async deleteContractTemplate({ data, user, admin }) {
    const { data: t } = await admin.from("contract_templates").select("business_id").eq("id", data.id).maybeSingle();
    if (!t) return { ok: true };
    await assertBusinessOwner(admin, user.id, t.business_id);
    await admin.from("contract_templates").delete().eq("id", data.id);
    return { ok: true };
  },

  async listContracts({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    const { data: rows } = await admin.from("contracts")
      .select("*, template:contract_templates(name,kind)")
      .eq("business_id", data.business_id).order("created_at", { ascending: false }).limit(200);
    return rows ?? [];
  },
  async generateContract({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    const tpl = data.template_id ? (await admin.from("contract_templates").select("*").eq("id", data.template_id).maybeSingle()).data : null;
    if (data.template_id && !tpl) throw new Error("Modèle introuvable");
    const rawContent = tpl?.content || data.content || "";
    const vars = data.variables || {};
    const content = String(rawContent).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => String(vars[k] ?? `[${k}]`));
    const { data: numRow } = await admin.rpc("generate_contract_number");
    const number = numRow || `DOC-${Date.now()}`;
    const { data: row, error } = await admin.from("contracts").insert({
      business_id: data.business_id,
      template_id: data.template_id || null,
      number, title: data.title, kind: tpl?.kind || data.kind || "contract",
      client_name: data.client_name || null,
      client_email: data.client_email || null,
      client_phone: data.client_phone || null,
      variables: vars, content,
      amount: data.amount ?? null, currency: data.currency || "XOF",
      status: "draft",
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  },
  async updateContractStatus({ data, user, admin }) {
    const { data: c } = await admin.from("contracts").select("business_id").eq("id", data.id).maybeSingle();
    if (!c) throw new Error("Contrat introuvable");
    await assertBusinessOwner(admin, user.id, c.business_id);
    const patch: any = { status: data.status };
    if (data.status === "sent") patch.sent_at = new Date().toISOString();
    if (data.status === "signed") patch.signed_at = new Date().toISOString();
    const { data: row, error } = await admin.from("contracts").update(patch).eq("id", data.id).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  },
  async deleteContract({ data, user, admin }) {
    const { data: c } = await admin.from("contracts").select("business_id").eq("id", data.id).maybeSingle();
    if (!c) return { ok: true };
    await assertBusinessOwner(admin, user.id, c.business_id);
    await admin.from("contracts").delete().eq("id", data.id);
    return { ok: true };
  },

  // ============================================================
  // FACEBOOK / META
  // ============================================================
  async getFacebookIntegration({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    const { data: row } = await admin.from("facebook_integrations")
      .select("id,meta_user_id,ad_account_id,page_id,page_name,scopes,expires_at,created_at")
      .eq("business_id", data.business_id).maybeSingle();
    return row;
  },
  async disconnectFacebook({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    await admin.from("facebook_integrations").delete().eq("business_id", data.business_id);
    return { ok: true };
  },
  async listFacebookCampaigns({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    const { data: rows } = await admin.from("facebook_campaigns")
      .select("*").eq("business_id", data.business_id).order("created_at", { ascending: false });
    return rows ?? [];
  },
  async createFacebookCampaign({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    const { data: integ } = await admin.from("facebook_integrations").select("*").eq("business_id", data.business_id).maybeSingle();
    if (!integ) throw new Error("Connecte d'abord Facebook Ads");
    if (!integ.ad_account_id) throw new Error("Aucun compte publicitaire lié");
    // Appel Meta Marketing API — création campagne (statut PAUSED par défaut)
    const url = `https://graph.facebook.com/v20.0/${integ.ad_account_id}/campaigns`;
    const body = new URLSearchParams({
      name: data.name,
      objective: data.objective || "OUTCOME_TRAFFIC",
      status: "PAUSED",
      special_ad_categories: JSON.stringify([]),
      access_token: integ.access_token,
    });
    const resp = await fetch(url, { method: "POST", body });
    const j = await resp.json();
    if (!resp.ok) throw new Error(j?.error?.message || "Erreur Meta API");
    const { data: row } = await admin.from("facebook_campaigns").insert({
      business_id: data.business_id, integration_id: integ.id,
      meta_campaign_id: j.id, name: data.name, objective: data.objective,
      status: "PAUSED", daily_budget: data.daily_budget ?? null,
    }).select("*").single();
    return row;
  },

  // ============================================================
  // MOMO INTER-NETWORK TRANSFERS (Orange <-> Moov <-> Wave ...)
  // ============================================================
  async getMomoTransferConfig({ admin }) {
    const cfg = await loadMomoTransferConfig(admin);
    return cfg;
  },
  async quoteMomoTransfer({ data, admin }) {
    const cfg = await loadMomoTransferConfig(admin);
    const amount = Math.floor(Number(data?.amount || 0));
    if (!cfg.enabled) return { ok: false, error: "Fonctionnalité désactivée" };
    if (!Number.isFinite(amount) || amount < cfg.min) return { ok: false, error: `Montant minimum ${cfg.min} XOF` };
    if (amount > cfg.max) return { ok: false, error: `Montant maximum ${cfg.max} XOF` };
    const fees = computeMomoTransferFees(amount, cfg);
    return { ok: true, amount_send: amount, fees_xof: fees, total_charged_xof: amount + fees, currency: "XOF", cfg };
  },
  async initMomoTransfer({ data, user, admin }) {
    const userId = user.id;
    await assertUserRateLimit(admin, userId, "initMomoTransfer", 8);
    const cfg = await loadMomoTransferConfig(admin);
    if (!cfg.enabled) return { ok: false, error: "Transferts inter-réseaux désactivés" };
    const amount = Math.floor(Number(data?.amount || 0));
    if (!Number.isFinite(amount) || amount < cfg.min) return { ok: false, error: `Montant minimum ${cfg.min} XOF` };
    if (amount > cfg.max) return { ok: false, error: `Montant maximum ${cfg.max} XOF` };
    const sourceOperator = String(data?.source_operator || "WALLET").trim();
    const destOperator = String(data?.dest_operator || "").trim();
    const destPhone = normalizeBfPhone(data?.dest_phone);
    const destHolder = String(data?.dest_holder || "").slice(0, 120);
    if (!destOperator) return { ok: false, error: "Opérateur destinataire requis" };
    if (!destPhone) return { ok: false, error: "Numéro destinataire invalide" };
    if (!mapCashoutMethod(destOperator)) return { ok: false, error: "Opérateur destinataire non supporté" };
    const fees = computeMomoTransferFees(amount, cfg);
    const total = amount + fees;

    // Débit direct du portefeuille XOF (pas de pay-in) — le client a déjà rechargé.
    const { data: w } = await admin.from("wallets")
      .select("id,balance").eq("user_id", userId).eq("currency", "XOF").maybeSingle();
    const currentBalance = Number(w?.balance || 0);
    if (!w || currentBalance < total) {
      return {
        ok: false,
        error: `Solde XOF insuffisant. Il vous faut ${total.toLocaleString("fr-FR")} XOF (solde: ${currentBalance.toLocaleString("fr-FR")}). Rechargez votre portefeuille depuis le tableau de bord.`,
      };
    }
    const reference = `MTR-${Date.now()}-${userId.slice(0, 8)}`;
    // Débit du wallet
    const newBalance = currentBalance - total;
    const { error: wErr } = await admin.from("wallets").update({ balance: newBalance }).eq("id", w.id);
    if (wErr) throw new Error(wErr.message);
    await admin.from("transactions").insert({
      user_id: userId, type: "withdrawal", status: "success",
      amount: total, currency: "XOF",
      provider: "wallet", provider_ref: reference,
      description: `Transfert inter-réseaux vers ${destOperator} · ${destPhone}`,
    });
    const { data: row, error } = await admin.from("momo_transfers").insert({
      user_id: userId, source_operator: sourceOperator, source_phone: null,
      dest_operator: destOperator, dest_phone: destPhone, dest_holder: destHolder || null,
      amount_send: amount, fees_xof: fees, total_charged_xof: total,
      status: "paid",
      paid_at: new Date().toISOString(),
      payment_reference: reference, payment_intent_id: null,
      checkout_url: null,
      metadata: { init: { mode: "wallet_debit", balance_before: currentBalance, balance_after: newBalance } },
    }).select("*").single();
    if (error) throw new Error(error.message);
    // Déclenche immédiatement le payout vers le destinataire
    try { await triggerMomoTransferCashout(admin, row); } catch (e) { console.error("cashout trigger failed", e); }
    const { data: fresh } = await admin.from("momo_transfers").select("*").eq("id", row.id).maybeSingle();
    return { ok: true, transfer: fresh || row, reference };
  },
  async verifyMomoTransfer({ data, user, admin }) {
    const userId = user.id;
    const reference = String(data?.reference || "");
    if (!reference) return { ok: false, error: "reference manquante" };
    const { data: t } = await admin.from("momo_transfers").select("*").eq("payment_reference", reference).maybeSingle();
    if (!t) return { ok: false, error: "Transfert introuvable" };
    if (t.user_id !== userId && !(await isAdmin(admin, userId))) return { ok: false, error: "Forbidden" };
    const updated = await pollAndProcessMomoTransfer(admin, t);
    return { ok: true, transfer: updated };
  },
  async listMyMomoTransfers({ user, admin }) {
    const { data } = await admin.from("momo_transfers").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
    return data ?? [];
  },
  async adminListMomoTransfers({ user, admin }) {
    if (!(await isAdmin(admin, user.id))) throw new Error("Forbidden");
    const { data } = await admin.from("momo_transfers").select("*").order("created_at", { ascending: false }).limit(200);
    const ids = Array.from(new Set((data ?? []).map((r: any) => r.user_id)));
    const { data: profs } = await admin.from("profiles").select("id,full_name,email,phone").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const byId = new Map((profs ?? []).map((p: any) => [p.id, p]));
    return (data ?? []).map((r: any) => ({ ...r, user: byId.get(r.user_id) || null }));
  },
  async adminRetryMomoTransferPayout({ data, user, admin }) {
    if (!(await isAdmin(admin, user.id))) throw new Error("Forbidden");
    const { data: t } = await admin.from("momo_transfers").select("*").eq("id", data.id).maybeSingle();
    if (!t) throw new Error("Transfert introuvable");
    if (t.status === "delivered") return { ok: true, transfer: t };
    const updated = await pollAndProcessMomoTransfer(admin, t, { forceDisburse: true });
    return { ok: true, transfer: updated };
  },
  async adminUpdateMomoTransferConfig({ data, user, admin }) {
    if (!(await isAdmin(admin, user.id))) throw new Error("Forbidden");
    const map: Record<string, any> = {
      momo_transfer_fee_bps: data?.fee_bps,
      momo_transfer_fee_flat_xof: data?.fee_flat_xof,
      momo_transfer_min_xof: data?.min_xof,
      momo_transfer_max_xof: data?.max_xof,
      momo_transfer_enabled: data?.enabled,
    };
    for (const [k, v] of Object.entries(map)) {
      if (v === undefined || v === null) continue;
      await admin.from("platform_config").upsert({ key: k, value: v }, { onConflict: "key" });
    }
    return await loadMomoTransferConfig(admin);
  },

  // ============================================================
  // RETRAIT PAYPAL (pay-in PayPal via YengaPay -> payout Mobile Money)
  // ============================================================
  async getPaypalWithdrawConfig({ admin }) {
    return await loadPaypalWithdrawConfig(admin);
  },
  async quotePaypalWithdrawal({ data, admin }) {
    const cfg = await loadPaypalWithdrawConfig(admin);
    const amount = Math.floor(Number(data?.amount || 0));
    if (!cfg.enabled) return { ok: false, error: "Retrait PayPal momentanément indisponible" };
    if (!Number.isFinite(amount) || amount < cfg.min) return { ok: false, error: `Montant minimum ${cfg.min} XOF` };
    if (amount > cfg.max) return { ok: false, error: `Montant maximum ${cfg.max} XOF` };
    const fees = computePaypalWithdrawFees(amount, cfg);
    return { ok: true, amount_send: amount, fees_xof: fees, total_charged_xof: amount + fees, currency: "XOF", cfg };
  },
  async initPaypalWithdrawal({ data, user, admin }) {
    const userId = user.id;
    await assertUserRateLimit(admin, userId, "initPaypalWithdrawal", 8);
    const cfg = await loadPaypalWithdrawConfig(admin);
    if (!cfg.enabled) return { ok: false, error: "Retrait PayPal momentanément indisponible" };
    const amount = Math.floor(Number(data?.amount || 0));
    if (!Number.isFinite(amount) || amount < cfg.min) return { ok: false, error: `Montant minimum ${cfg.min} XOF` };
    if (amount > cfg.max) return { ok: false, error: `Montant maximum ${cfg.max} XOF` };
    const destOperator = String(data?.dest_operator || "").trim().toUpperCase();
    if (!["ORANGE_MONEY", "MOOV_MONEY"].includes(destOperator)) {
      return { ok: false, error: "Seuls Orange Money et Moov Money sont autorisés" };
    }
    const destPhone = normalizeBfPhone(data?.dest_phone);
    if (!destPhone || destPhone.replace(/\D/g, "").length < 11) return { ok: false, error: "Numéro destinataire invalide" };
    const destHolder = String(data?.dest_holder || "").slice(0, 120);
    if (!destHolder.trim()) return { ok: false, error: "Nom du bénéficiaire requis" };
    const fees = computePaypalWithdrawFees(amount, cfg);
    const total = amount + fees;

    const apiKey = Deno.env.get("YENGAPAY_PAYPAL_API_KEY") || Deno.env.get("YENGAPAY_API_KEY");
    const groupId = Deno.env.get("YENGAPAY_GROUP_ID");
    const projectId = Deno.env.get("YENGAPAY_PAYPAL_PROJECT_ID") || "94603";
    if (!apiKey || !groupId) throw new Error("Passerelle PayPal non configurée");
    const reference = `PPW-${Date.now()}-${userId.slice(0, 8)}`;
    const callbackUrl = `${SUPABASE_URL}/functions/v1/yengapay-webhook`;
    const baseReturn = String(data?.returnUrl || "");
    const returnUrl = baseReturn
      ? baseReturn + (baseReturn.includes("?") ? "&" : "?") + `ppw=${encodeURIComponent(reference)}`
      : "";
    const res = await fetch(`https://api.yengapay.com/api/v1/groups/${groupId}/payment-intent/${projectId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({
        paymentAmount: total, reference,
        articles: [{ title: "Retrait PayPal", description: `Retrait vers ${destOperator} ${destPhone}`, pictures: [], price: total }],
        callbackUrl,
        ...(returnUrl ? { returnUrl, successUrl: returnUrl, cancelUrl: returnUrl } : {}),
      }),
    });
    const txt = await res.text(); let body: any = txt; try { body = JSON.parse(txt); } catch { /**/ }
    if (!res.ok) throw new Error(`Passerelle ${res.status}: ${typeof body === "string" ? body : JSON.stringify(body).slice(0, 300)}`);
    const paymentIntentId = body?.id || body?.paymentIntentId || body?.paymentIntent?.id || body?.data?.id || null;
    const checkoutUrl = body?.checkoutPageUrlWithPaymentToken || body?.checkout_url || body?.paymentUrl
      || body?.data?.checkoutPageUrlWithPaymentToken || body?.data?.checkout_url || body?.data?.paymentUrl || null;
    if (!checkoutUrl) throw new Error("Aucun lien de paiement retourné par la passerelle");
    const { data: row, error } = await admin.from("momo_transfers").insert({
      user_id: userId, source_operator: "PAYPAL", source_phone: null,
      dest_operator: destOperator, dest_phone: destPhone, dest_holder: destHolder || null,
      amount_send: amount, fees_xof: fees, total_charged_xof: total,
      status: "awaiting_payment",
      payment_reference: reference, payment_intent_id: paymentIntentId,
      checkout_url: checkoutUrl,
      metadata: { kind: "paypal_withdrawal", init: body },
    }).select("*").single();
    if (error) throw new Error(error.message);
    return { ok: true, transfer: row, reference, checkout_url: checkoutUrl };
  },
  async listMyPaypalWithdrawals({ user, admin }) {
    const { data } = await admin.from("momo_transfers").select("*")
      .eq("user_id", user.id).eq("source_operator", "PAYPAL")
      .order("created_at", { ascending: false }).limit(100);
    return data ?? [];
  },
  async adminUpdatePaypalWithdrawConfig({ data, user, admin }) {
    if (!(await isAdmin(admin, user.id))) throw new Error("Forbidden");
    const map: Record<string, any> = {
      paypal_wd_fee_bps: data?.fee_bps,
      paypal_wd_fee_flat_xof: data?.fee_flat_xof,
      paypal_wd_min_xof: data?.min_xof,
      paypal_wd_max_xof: data?.max_xof,
      paypal_wd_enabled: data?.enabled,
    };
    for (const [k, v] of Object.entries(map)) {
      if (v === undefined || v === null) continue;
      await admin.from("platform_config").upsert({ key: k, value: v }, { onConflict: "key" });
    }
    return await loadPaypalWithdrawConfig(admin);
  },

  // ============================================================
  // COMPTABILITÉ PRO — Settings, Comptes, Stock, Rapports
  // ============================================================
  async getAccountingSettings({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    const { data: row } = await admin.from("accounting_settings").select("*").eq("business_id", data.business_id).maybeSingle();
    return row || null;
  },
  async upsertAccountingSettings({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    const patch = {
      business_id: data.business_id,
      legal_name: data.legal_name || null,
      ifu: data.ifu || null,
      rccm: data.rccm || null,
      address: data.address || null,
      phone: data.phone || null,
      email: data.email || null,
      logo_url: data.logo_url || null,
      currency: data.currency || "XOF",
      tva_enabled: !!data.tva_enabled,
      tva_rate: Number(data.tva_rate ?? 18),
      fiscal_year_start: data.fiscal_year_start || "01-01",
      regime: data.regime || "reel_simplifie",
    };
    const { data: row, error } = await admin.from("accounting_settings")
      .upsert(patch, { onConflict: "business_id" }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  },

  async listAccountingAccounts({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    const { data: rows } = await admin.from("accounting_accounts")
      .select("*").eq("business_id", data.business_id).order("created_at");
    return rows ?? [];
  },
  async upsertAccountingAccount({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    const patch = {
      business_id: data.business_id,
      name: data.name, kind: data.kind || "cash",
      currency: data.currency || "XOF",
      opening_balance: Number(data.opening_balance || 0),
      is_active: data.is_active !== false,
    };
    if (data.id) {
      const { data: row, error } = await admin.from("accounting_accounts").update(patch).eq("id", data.id).select("*").single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await admin.from("accounting_accounts").insert(patch).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  },
  async deleteAccountingAccount({ data, user, admin }) {
    const { data: a } = await admin.from("accounting_accounts").select("business_id").eq("id", data.id).maybeSingle();
    if (!a) return { ok: true };
    await assertBusinessOwner(admin, user.id, a.business_id);
    await admin.from("accounting_accounts").delete().eq("id", data.id);
    return { ok: true };
  },

  async listStockItems({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    const { data: rows } = await admin.from("stock_items").select("*").eq("business_id", data.business_id).order("name");
    return rows ?? [];
  },
  async upsertStockItem({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    const patch = {
      business_id: data.business_id,
      sku: data.sku || null,
      name: data.name,
      unit: data.unit || "unité",
      purchase_price: Number(data.purchase_price || 0),
      sale_price: Number(data.sale_price || 0),
      stock_qty: Number(data.stock_qty || 0),
      alert_threshold: Number(data.alert_threshold || 0),
      linked_product_id: data.linked_product_id || null,
      image_url: data.image_url || null,
      is_active: data.is_active !== false,
    };
    if (data.id) {
      const { data: row, error } = await admin.from("stock_items").update(patch).eq("id", data.id).select("*").single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await admin.from("stock_items").insert(patch).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  },
  async deleteStockItem({ data, user, admin }) {
    const { data: s } = await admin.from("stock_items").select("business_id").eq("id", data.id).maybeSingle();
    if (!s) return { ok: true };
    await assertBusinessOwner(admin, user.id, s.business_id);
    await admin.from("stock_items").delete().eq("id", data.id);
    return { ok: true };
  },
  async listStockMovements({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    let q = admin.from("stock_movements").select("*, item:stock_items(name,unit)").eq("business_id", data.business_id).order("created_at", { ascending: false }).limit(300);
    if (data.item_id) q = q.eq("item_id", data.item_id);
    const { data: rows } = await q;
    return rows ?? [];
  },
  async createStockMovement({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    const kind = String(data.kind || "in");
    const qty = Number(data.qty || 0);
    if (!qty) throw new Error("Quantité requise");
    const { data: item } = await admin.from("stock_items").select("*").eq("id", data.item_id).maybeSingle();
    if (!item) throw new Error("Article introuvable");
    let delta = 0;
    if (kind === "in") delta = qty;
    else if (kind === "out") delta = -qty;
    else if (kind === "adjust") delta = qty - Number(item.stock_qty || 0);
    await admin.from("stock_items").update({ stock_qty: Number(item.stock_qty || 0) + delta }).eq("id", item.id);
    const { data: mv, error } = await admin.from("stock_movements").insert({
      business_id: data.business_id, item_id: item.id, kind, qty,
      unit_cost: data.unit_cost != null ? Number(data.unit_cost) : null,
      note: data.note || null,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return mv;
  },

  async getAccountingReports({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    const from = data.from || new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
    const to = data.to || new Date().toISOString().slice(0, 10);
    const [{ data: entries }, { data: accounts }, { data: settings }, { data: items }] = await Promise.all([
      admin.from("accounting_entries").select("*, category:accounting_categories(name), account:accounting_accounts(name,kind)")
        .eq("business_id", data.business_id).gte("entry_date", from).lte("entry_date", to),
      admin.from("accounting_accounts").select("*").eq("business_id", data.business_id),
      admin.from("accounting_settings").select("*").eq("business_id", data.business_id).maybeSingle(),
      admin.from("stock_items").select("id,name,stock_qty,purchase_price,alert_threshold").eq("business_id", data.business_id),
    ]);
    let income = 0, expense = 0, tvaCollected = 0, tvaDeductible = 0;
    const byCategory: Record<string, { name: string; income: number; expense: number }> = {};
    const byAccount: Record<string, { name: string; kind: string; balance: number }> = {};
    for (const a of accounts || []) byAccount[a.id] = { name: a.name, kind: a.kind, balance: Number(a.opening_balance || 0) };
    for (const e of entries || []) {
      const amt = Number(e.amount || 0);
      const tva = Number(e.tva_amount || 0);
      if (e.kind === "income") { income += amt; tvaCollected += tva; }
      else { expense += amt; tvaDeductible += tva; }
      const catKey = e.category_id || "none";
      if (!byCategory[catKey]) byCategory[catKey] = { name: e.category?.name || "Sans catégorie", income: 0, expense: 0 };
      byCategory[catKey][e.kind as "income" | "expense"] += amt;
      if (e.account_id && byAccount[e.account_id]) {
        byAccount[e.account_id].balance += e.kind === "income" ? amt : -amt;
      }
    }
    const stockValue = (items || []).reduce((s: number, i: any) => s + Number(i.stock_qty || 0) * Number(i.purchase_price || 0), 0);
    const stockAlerts = (items || []).filter((i: any) => Number(i.alert_threshold || 0) > 0 && Number(i.stock_qty || 0) <= Number(i.alert_threshold || 0));
    return {
      period: { from, to },
      settings: settings || null,
      pnl: { income, expense, net: income - expense },
      tva: { collected: tvaCollected, deductible: tvaDeductible, due: tvaCollected - tvaDeductible },
      byCategory: Object.values(byCategory),
      byAccount: Object.values(byAccount),
      stock: { value: stockValue, alerts: stockAlerts, count: (items || []).length },
    };
  },

  async createAccountingAttachmentUrl({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    const ext = String(data.ext || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
    const path = `${data.business_id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { data: signed, error } = await admin.storage.from("accounting-attachments")
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  },
  async getAccountingAttachmentUrl({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    const { data: signed, error } = await admin.storage.from("accounting-attachments")
      .createSignedUrl(data.path, 60 * 60);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  },

  // ============ TRANSFERTS INTER-COMPTES (P2P gratuit) ============
  async lookupInternalRecipient({ data, admin }) {
    const phone = normalizeBfPhone(data?.phone);
    if (!phone) return { found: false };
    const { data: profs } = await admin.from("profiles").select("id,full_name,phone");
    const match = (profs || []).find((p: any) => normalizeBfPhone(p.phone) === phone);
    return match
      ? { found: true, name: match.full_name || null }
      : { found: false };
  },

  async initInternalTransfer({ data, user, admin }) {
    const userId = user.id;
    await assertUserRateLimit(admin, userId, "initInternalTransfer", 20);

    const amount = Math.floor(Number(data?.amount || 0));
    if (!Number.isFinite(amount) || amount < 100) return { ok: false, error: "Montant minimum 100 XOF" };
    if (amount > 1_000_000) return { ok: false, error: "Montant maximum 1 000 000 XOF" };

    const phone = normalizeBfPhone(data?.recipient_phone);
    if (!phone) return { ok: false, error: "Numéro destinataire invalide" };

    const recipientName = String(data?.recipient_name || "").slice(0, 120).trim() || null;
    const note = String(data?.note || "").slice(0, 240).trim() || null;

    // Fetch sender profile for name + self-transfer guard
    const { data: senderProfile } = await admin.from("profiles")
      .select("id,full_name,phone").eq("id", userId).maybeSingle();
    if (senderProfile?.phone && normalizeBfPhone(senderProfile.phone) === phone) {
      return { ok: false, error: "Vous ne pouvez pas transférer à votre propre numéro" };
    }

    // Debit sender XOF wallet
    const { data: wS } = await admin.from("wallets")
      .select("id,balance").eq("user_id", userId).eq("currency", "XOF").maybeSingle();
    const bal = Number(wS?.balance || 0);
    if (!wS || bal < amount) {
      return { ok: false, error: `Solde XOF insuffisant (${bal.toLocaleString("fr-FR")} XOF). Rechargez votre portefeuille.` };
    }

    // Lookup recipient by normalized phone
    const { data: profs } = await admin.from("profiles").select("id,full_name,phone");
    const recipient = (profs || []).find((p: any) => p.id !== userId && normalizeBfPhone(p.phone) === phone);

    const reference = `INT-${Date.now()}-${userId.slice(0, 6)}`;

    // Debit sender
    const { error: dErr } = await admin.from("wallets").update({ balance: bal - amount }).eq("id", wS.id);
    if (dErr) throw new Error(dErr.message);
    await admin.from("transactions").insert({
      user_id: userId, type: "transfer_out", status: "success",
      amount, currency: "XOF", provider: "internal", provider_ref: reference,
      description: `Transfert à ${recipientName || phone}${note ? " · " + note : ""}`,
    });

    const senderName = senderProfile?.full_name || "Un utilisateur FASO-INVEST PAY";
    let status = "delivered";
    let recipient_id: string | null = null;

    if (recipient) {
      recipient_id = recipient.id;
      const { data: wR } = await admin.from("wallets")
        .select("id,balance").eq("user_id", recipient.id).eq("currency", "XOF").maybeSingle();
      if (wR) {
        await admin.from("wallets").update({ balance: Number(wR.balance || 0) + amount }).eq("id", wR.id);
      } else {
        await admin.from("wallets").insert({ user_id: recipient.id, currency: "XOF", balance: amount });
      }
      await admin.from("transactions").insert({
        user_id: recipient.id, type: "transfer_in", status: "success",
        amount, currency: "XOF", provider: "internal", provider_ref: reference,
        description: `Reçu de ${senderName}${note ? " · " + note : ""}`,
      });
    } else {
      status = "pending_claim";
    }

    const { data: row, error: insErr } = await admin.from("internal_transfers").insert({
      sender_id: userId,
      recipient_id,
      recipient_phone: phone,
      recipient_name: recipientName,
      amount,
      currency: "XOF",
      note,
      status,
      reference,
      claimed_at: status === "delivered" ? new Date().toISOString() : null,
    }).select("*").single();
    if (insErr) throw new Error(insErr.message);

    // SMS notification (best-effort)
    try {
      const { data: cfg } = await admin.from("sms_config").select("*").limit(1).maybeSingle();
      if (cfg?.enabled) {
        const sender_id = cfg.sender_id || "BBG";
        const amountFmt = amount.toLocaleString("fr-FR");
        const message = recipient
          ? `FASO-INVEST PAY: Vous venez de recevoir ${amountFmt} XOF de ${senderName}. Consultez votre solde dans l'application.`
          : `FASO-INVEST PAY: ${senderName} vous a envoye ${amountFmt} XOF. Creez votre compte gratuit avec ce numero sur fasoinvestpay.com pour retirer via Mobile Money.`;
        const r = await sendSmsRaw({ recipient: phone, message, sender_id });
        await admin.from("sms_logs").insert({
          recipient: phone, message,
          event_key: recipient ? "internal_transfer_received" : "internal_transfer_invite",
          user_id: recipient_id,
          status: r.ok ? "success" : "failed",
          provider_response: r.body,
          error: r.ok ? null : String(r.body?.message || r.body?.error || `HTTP ${r.status}`),
        });
      }
    } catch (e) {
      console.error("[internal-transfer] sms failed", e);
    }

    return { ok: true, transfer: row, delivered: !!recipient };
  },

  async listMyInternalTransfers({ user, admin }) {
    const userId = user.id;
    const { data: sent } = await admin.from("internal_transfers")
      .select("*").eq("sender_id", userId).order("created_at", { ascending: false }).limit(60);
    const { data: received } = await admin.from("internal_transfers")
      .select("*").eq("recipient_id", userId).order("created_at", { ascending: false }).limit(60);
    // Enrich with counterpart names
    const otherIds = Array.from(new Set([
      ...(sent || []).map((r: any) => r.recipient_id).filter(Boolean),
      ...(received || []).map((r: any) => r.sender_id).filter(Boolean),
    ]));
    let byId = new Map<string, any>();
    if (otherIds.length) {
      const { data: profs } = await admin.from("profiles").select("id,full_name,phone").in("id", otherIds);
      byId = new Map((profs || []).map((p: any) => [p.id, p]));
    }
    return {
      sent: (sent || []).map((r: any) => ({ ...r, recipient: r.recipient_id ? byId.get(r.recipient_id) : null })),
      received: (received || []).map((r: any) => ({ ...r, sender: byId.get(r.sender_id) || null })),
    };
  },

  // ============================================================
  // SMS SENDER ID + CREDIT PURCHASE (Business ↔ BBG SMS)
  // ============================================================

  async createSenderIdRequest({ data, user, admin }) {
    const business_id = data?.business_id || null;
    const company_name = String(data?.company_name || "").trim();
    const sender_id = String(data?.sender_id || "").trim().slice(0, 11);
    const usage_note = String(data?.usage_note || "").trim() || null;
    if (!company_name) throw new Error("Nom d'entreprise requis");
    if (!sender_id) throw new Error("Sender ID requis (max 11 caractères)");
    if (business_id) await assertBusinessOwner(admin, user.id, business_id);
    const { data: row, error } = await admin.from("sms_sender_requests").insert({
      business_id, user_id: user.id, company_name, sender_id, usage_note,
    }).select("*").single();
    if (error) throw new Error(error.message);

    // Alert admin via SMS (non-blocking)
    notifySms(admin, "sender_request", {
      userId: user.id,
      amount: 0,
      extra: {
        sender_id,
        company: company_name
      }
    }).catch(() => {});

    return row;
  },

  async listMySenderIdRequests({ user, admin, data }) {
    let q = admin.from("sms_sender_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (data?.business_id) q = q.eq("business_id", data.business_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  },

  async adminListSenderRequests({ user, admin }) {
    if (!(await isAdmin(admin, user.id))) throw new Error("Forbidden");
    const { data: rows, error } = await admin.from("sms_sender_requests").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  },

  async adminUpdateSenderRequest({ data, user, admin }) {
    if (!(await isAdmin(admin, user.id))) throw new Error("Forbidden");
    const { id, status, admin_note } = data;
    if (!id) throw new Error("ID requis");
    const patch: any = {};
    if (status) patch.status = status;
    if (admin_note !== undefined) patch.admin_note = admin_note;
    patch.updated_at = new Date().toISOString();

    const { data: row, error } = await admin.from("sms_sender_requests")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    // If approved, notify user via SMS (non-blocking)
    if (status === "approved" && row.user_id) {
      notifySms(admin, "sender_request", {
        userId: row.user_id,
        amount: 0,
        extra: {
          sender_id: row.sender_id,
          status: "APPROUVÉE"
        }
      }).catch(() => {});
    }

    return row;
  },

  async listSmsCredits({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    const { data: row, error } = await admin.from("sms_wallets")
      .select("*").eq("business_id", data.business_id).maybeSingle();
    if (error) throw new Error(error.message);
    return row || { business_id: data.business_id, credits: 0 };
  },

  async purchaseSmsCredits({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    const { quantity, sender_id } = data;
    if (!quantity || quantity <= 0) throw new Error("Quantité invalide");
    
    // Get SMS price from config
    const { data: cfg } = await admin.from("platform_config").select("value").eq("key", "sms_price").maybeSingle();
    const pricePerSms = Number(cfg?.value || 25);
    const totalCost = quantity * pricePerSms;

    // Check wallet
    const { data: w } = await admin.from("wallets").select("id,balance").eq("user_id", user.id).eq("currency", "XOF").maybeSingle();
    if (!w || Number(w.balance) < totalCost) throw new Error(`Solde insuffisant (${totalCost} XOF requis)`);

    // Deduct from wallet
    await admin.from("wallets").update({ balance: Number(w.balance) - totalCost }).eq("id", w.id);
    
    // Add transaction
    await admin.from("transactions").insert({
      user_id: user.id, type: "sms_purchase", status: "success",
      amount: totalCost, currency: "XOF", provider: "internal",
      description: `Achat de ${quantity} crédits SMS (${sender_id})`,
      metadata: { business_id: data.business_id, quantity, sender_id }
    });

    // Update SMS wallet
    const { data: sw } = await admin.from("sms_wallets").select("id,credits").eq("business_id", data.business_id).maybeSingle();
    if (sw) {
      await admin.from("sms_wallets").update({ credits: Number(sw.credits) + quantity }).eq("id", sw.id);
    } else {
      await admin.from("sms_wallets").insert({ business_id: data.business_id, credits: quantity });
    }

    return { ok: true, quantity, cost: totalCost };
  },


  async adminUpdateSenderRequest({ data, user, admin }) {
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    if (data?.status) patch.status = data.status;
    if (data?.admin_note !== undefined) patch.admin_note = data.admin_note;
    const { data: row, error } = await admin.from("sms_sender_requests").update(patch).eq("id", data.id).select("*").single();
    if (error) throw new Error(error.message);

    // Notify admin on new sender request or status change
    try {
      const { data: cfg } = await admin.from("platform_config").select("value").eq("key", "admin_notification_phone").maybeSingle();
      const adminPhone = cfg?.value || "+22670000000"; // Fallback or configurable
      
      if (data?.status === "approved" || data?.status === "rejected") {
         // Notify user...
      } else {
         // It's a new request being processed? No, this handler is for admin update.
         // We should notify admin in createSenderIdRequest.
      }
    } catch (e) { console.error("Admin SMS notify failed", e); }

    return row;
  },

  async listSmsCredits({ data, user, admin }) {
    await assertBusinessOwner(admin, user.id, data.business_id);
    const { data: rows, error } = await admin.from("sms_credits")
      .select("*").eq("business_id", data.business_id).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  },

  async purchaseSmsCredits({ data, user, admin }) {
    // Débite le portefeuille XOF du propriétaire et crédite le compteur SMS de la boutique.
    // Tarif: 20 XOF / SMS par défaut. Sender ID doit être approuvé au préalable.
    const business_id = data?.business_id;
    const sender_id = String(data?.sender_id || "").trim();
    const qty = Math.max(1, Math.floor(Number(data?.quantity) || 0));
    const unitPrice = 20;
    if (!business_id || !sender_id) throw new Error("business_id et sender_id requis");
    if (!qty || qty > 100000) throw new Error("Quantité invalide (1 – 100 000)");
    await assertBusinessOwner(admin, user.id, business_id);

    // Vérifie le Sender ID approuvé
    const { data: sr } = await admin.from("sms_sender_requests")
      .select("id,status").eq("business_id", business_id).eq("sender_id", sender_id).eq("status", "approved").maybeSingle();
    if (!sr) throw new Error("Sender ID non approuvé — attendez la validation admin.");

    const cost = qty * unitPrice;
    const { data: wallet } = await admin.from("wallets")
      .select("id,balance").eq("user_id", user.id).eq("currency", "XOF").maybeSingle();
    if (!wallet) throw new Error("Portefeuille XOF introuvable");
    if (Number(wallet.balance) < cost) throw new Error(`Solde insuffisant : ${cost} XOF requis`);

    // Débite
    await admin.from("wallets").update({ balance: Number(wallet.balance) - cost }).eq("id", wallet.id);
    await admin.from("transactions").insert({
      user_id: user.id, type: "sms_purchase", status: "success",
      amount: cost, currency: "XOF", provider: "internal",
      description: `Achat ${qty} SMS (${sender_id}) — ${unitPrice} XOF/sms`,
    });

    // Upsert crédit SMS
    const { data: existing } = await admin.from("sms_credits")
      .select("id,balance,total_purchased").eq("business_id", business_id).eq("sender_id", sender_id).maybeSingle();
    if (existing) {
      await admin.from("sms_credits").update({
        balance: (existing.balance || 0) + qty,
        total_purchased: (existing.total_purchased || 0) + qty,
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id);
    } else {
      await admin.from("sms_credits").insert({
        business_id, sender_id, balance: qty, total_purchased: qty,
      });
    }
    return { ok: true, added: qty, cost_xof: cost };
  },

  async send2FAOTP({ user, admin }) {
    const { data: p } = await admin.from("profiles").select("phone").eq("id", user.id).maybeSingle();
    if (!p?.phone) throw new Error("Aucun numéro de téléphone configuré dans votre profil.");
    return await handle2FA(admin, user.id, p.phone, "send", undefined, "2fa");
  },

  async verify2FAOTP({ data, user, admin }) {
    const { code } = data;
    const { data: p } = await admin.from("profiles").select("phone").eq("id", user.id).maybeSingle();
    if (!p?.phone) throw new Error("Profil incomplet.");
    return await handle2FA(admin, user.id, p.phone, "verify", code, "2fa");
  },

  async sendRegistrationOTP({ user, admin }) {
    console.log(`[sendRegistrationOTP] Initiating for user: ${user.id}`);
    
    try {
      // 1. Attempt to get phone from metadata first
      let phone = user.user_metadata?.phone;
      console.log(`[sendRegistrationOTP] Metadata phone: ${phone}`);
      
      if (!phone) {
        // 2. Direct fetch from profiles (safer since metadata might be missing in edge cases)
        const { data: p } = await admin.from("profiles").select("phone").eq("id", user.id).maybeSingle();
        phone = p?.phone;
      }

      if (!phone) {
        // 3. Fallback to auth.admin as last resort
        const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(user.id);
        if (authErr) console.error(`[sendRegistrationOTP] auth.admin error:`, authErr);
        phone = authUser?.user?.user_metadata?.phone || authUser?.user?.phone;
      }

      if (!phone) {
        throw new Error("Numéro WhatsApp introuvable. Veuillez contacter le support.");
      }

      console.log(`[sendRegistrationOTP] Calling handleRegistrationOTP for ${phone}`);
      const result = await handleRegistrationOTP(admin, user.id, phone, "send");
      
      // If the result indicates a transport error (API non-2xx), we still want to show the OTP page
      // but we need to inform handleRegistrationOTP to be strict if we want actual delivery.
      // The handleRegistrationOTP already throws if BBG returns !ok.
      
      return result;
    } catch (e: any) {
      console.error(`[sendRegistrationOTP] CRITICAL:`, e);
      // We throw the error so the frontend catch block is triggered, 
      // where we now have strict mode (no more automatic fastRedirect).
      throw e;
    }
  },

  async verifyRegistrationOTP({ data, user, admin }) {
    try {
      const { code } = data;
      const { data: p } = await admin.from("profiles").select("phone").eq("id", user.id).maybeSingle();
      if (!p?.phone) throw new Error("Profil incomplet.");
      return await handle2FA(admin, user.id, p.phone, "verify", code, "registration");
    } catch (e: any) {
      return { error: e.message || "Erreur de vérification" };
    }
  },

  async update2FASettings({ data, user, admin }) {
    const { enabled } = data;
    const { data: p, error } = await admin.from("profiles").update({ two_factor_enabled: !!enabled }).eq("id", user.id).select("*").single();
    if (error) throw error;
    return { ok: true, enabled: p.two_factor_enabled };
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
    console.log(`[API Dispatch] fn: ${fn}, found: ${!!handler}, total: ${Object.keys(HANDLERS).length}`);
    if (!handler) {
      const keys = Object.keys(HANDLERS);
      const start = keys.slice(0, 3).join(", ");
      const end = keys.slice(-3).join(", ");
      return jsonResponse({ error: `unknown fn: ${fn} (total: ${keys.length}, samples: ${start}...${end})` }, 404);
    }
    const result = await handler({ data, user, admin, userClient });
    return jsonResponse(result);
  } catch (e) {
    const msg = (e as Error).message || "Internal error";
    const status = msg === "Unauthorized" ? 401 : msg === "Forbidden" ? 403 : 400;
    return jsonResponse({ error: msg }, status);
  }
});
// Trigger refresh v2
