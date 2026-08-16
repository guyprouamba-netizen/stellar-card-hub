// Public payment gateway endpoint — handles /pay/:slug checkouts AND
// LigdiCash-style REST API authenticated by per-business API keys.
//
// JWT verification is disabled (see config.toml) because anonymous shoppers
// and external systems use this endpoint.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { sendEmail, receiptHtml } from "../_shared/email.ts";
import * as YP from "../_shared/yengapay.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const YENGAPAY_API_KEY = Deno.env.get("YENGAPAY_API_KEY");
const YENGAPAY_GROUP_ID = Deno.env.get("YENGAPAY_GROUP_ID");
const YENGAPAY_PROJECT_ID = Deno.env.get("YENGAPAY_PROJECT_ID");

function admin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
}

async function sha256Hex(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((x) => x.toString(16).padStart(2, "0")).join("");
}

type ApiAuth = { business_id: string; project_id?: string | null; mode: string; key_id: string; webhook_secret?: string | null };

function extractApiToken(req: Request): string {
  const raw =
    req.headers.get("Authorization") ||
    req.headers.get("X-API-Key") ||
    req.headers.get("x-secret-key") ||
    req.headers.get("X-Api-Secret") ||
    "";
  let token = raw.trim();
  if (/^bearer\s+/i.test(token)) token = token.replace(/^bearer\s+/i, "").trim();
  // `apikey` header is used by Supabase itself (anon key) — only accept it when it looks like ours
  if (!/^(fip_|sk_)/.test(token)) {
    const alt = (req.headers.get("apikey") || "").trim();
    if (/^(fip_|sk_)/.test(alt)) token = alt;
  }
  return token;
}

async function authenticateApiKey(req: Request): Promise<ApiAuth | null> {
  const token = extractApiToken(req);
  if (!token) return null;
  const db0 = admin();
  // --- Project secret keys (sk_live_… / sk_test_…) ---
  if (token.startsWith("sk_")) {
    const secret_hash = await sha256Hex(token);
    const { data: k } = await db0.from("project_api_keys")
      .select("id,project_id,business_id,mode,webhook_secret,revoked_at")
      .eq("secret_hash", secret_hash).maybeSingle();
    if (!k || k.revoked_at) return null;
    await db0.from("project_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", k.id);
    return { business_id: k.business_id, project_id: k.project_id, mode: k.mode, key_id: k.id, webhook_secret: k.webhook_secret };
  }
  if (!token.startsWith("fip_")) return null;
  const db = admin();
  const key_hash = await sha256Hex(token);
  const { data } = await db.from("business_api_keys")
    .select("id,business_id,mode,revoked_at,allowed_ips,rate_limit_per_min,scopes").eq("key_hash", key_hash).maybeSingle();
  if (!data || data.revoked_at) return null;
  // IP allowlist
  const ip = getClientIp(req);
  if (Array.isArray((data as any).allowed_ips) && (data as any).allowed_ips.length > 0) {
    if (!(data as any).allowed_ips.includes(ip)) {
      await db.from("security_events").insert({ kind: "ip_blocked", ip, details: { key_id: data.id } });
      return null;
    }
  }
  // Per-key rate limit (per minute)
  const limit = Number((data as any).rate_limit_per_min || 60);
  const sinceIso = new Date(Date.now() - 60_000).toISOString();
  const { count } = await db.from("rate_limit_hits")
    .select("id", { count: "exact", head: true })
    .eq("bucket", `api_key:${data.id}`)
    .gte("hit_at", sinceIso);
  if ((count || 0) >= limit) {
    await db.from("security_events").insert({ kind: "rate_limited", ip, details: { key_id: data.id, limit } });
    return null;
  }
  await db.from("rate_limit_hits").insert({ bucket: `api_key:${data.id}`, ip });
  await db.from("business_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return { business_id: data.business_id, mode: data.mode, key_id: data.id, scopes: (data as any).scopes || [] } as any;
}

// --- Signed webhook delivery to the merchant's server ---
async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((x) => x.toString(16).padStart(2, "0")).join("");
}

async function deliverProjectWebhook(db: any, projectId: string, event: string, payload: Record<string, unknown>) {
  const { data: k } = await db.from("project_api_keys")
    .select("id,business_id,project_id,webhook_url,webhook_secret")
    .eq("project_id", projectId).is("revoked_at", null)
    .order("created_at", { ascending: false }).maybeSingle();
  if (!k?.webhook_url) return;
  const body = JSON.stringify({ event, data: payload, created_at: new Date().toISOString() });
  const t = Math.floor(Date.now() / 1000);
  const signature = await hmacHex(k.webhook_secret, `${t}.${body}`);
  let status_code: number | null = null, response_body: string | null = null, error: string | null = null, success = false;
  try {
    const res = await fetch(k.webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-FIP-Signature": `t=${t},v1=${signature}`, "X-FIP-Event": event },
      body,
    });
    status_code = res.status;
    response_body = (await res.text()).slice(0, 500);
    success = res.ok;
  } catch (e) { error = (e as Error).message; }
  await db.from("project_webhook_deliveries").insert({
    project_id: k.project_id, business_id: k.business_id, event, url: k.webhook_url,
    payload: JSON.parse(body), status_code, response_body, error, success, simulated: false,
  });
}

function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") || "";
  return (fwd.split(",")[0] || req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "0.0.0.0").trim();
}

async function checkPublicRateLimit(bucket: string, req: Request, perMin: number): Promise<boolean> {
  const db = admin();
  const ip = getClientIp(req);
  const sinceIso = new Date(Date.now() - 60_000).toISOString();
  const { count } = await db.from("rate_limit_hits")
    .select("id", { count: "exact", head: true })
    .eq("bucket", bucket).eq("ip", ip).gte("hit_at", sinceIso);
  if ((count || 0) >= perMin) {
    await db.from("security_events").insert({ kind: "rate_limited", ip, details: { bucket, limit: perMin } });
    return false;
  }
  await db.from("rate_limit_hits").insert({ bucket, ip });
  return true;
}

function ref(prefix = "LP") {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function randomToken(bytes = 24) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a).map((x) => x.toString(16).padStart(2, "0")).join("");
}

const PUBLIC_APP_URL = Deno.env.get("PUBLIC_APP_URL") || "";

// Délivrance automatique des produits digitaux après paiement réussi.
async function grantDigitalDeliveries(db: any, tx: any, bizName: string) {
  const lines: Array<{ product_id: string; quantity: number }> = [];
  if (tx.order_id) {
    const { data: items } = await db.from("order_items").select("product_id,quantity").eq("order_id", tx.order_id);
    for (const it of items || []) if (it.product_id) lines.push({ product_id: it.product_id, quantity: it.quantity || 1 });
  } else if (tx.product_id) {
    lines.push({ product_id: tx.product_id, quantity: 1 });
  }
  if (lines.length === 0) return [];
  const { data: products } = await db.from("products")
    .select("id,name,type,downloadable,download_url,download_name,download_limit,download_expiry_days,access_instructions,purchase_note")
    .in("id", lines.map((l) => l.product_id));
  const grants: Array<{ name: string; url: string; instructions: string | null }> = [];
  for (const p of products || []) {
    const digital = p.downloadable || p.type === "digital";
    if (!digital) continue;
    if (!p.download_url && !p.access_instructions) continue;
    const token = randomToken(24);
    const expires = p.download_expiry_days
      ? new Date(Date.now() + Number(p.download_expiry_days) * 86400000).toISOString()
      : null;
    await db.from("product_downloads").insert({
      business_id: tx.business_id, product_id: p.id, order_id: tx.order_id || null,
      payment_id: tx.id, customer_email: tx.customer_email, customer_name: tx.customer_name,
      product_name: p.name, file_url: p.download_url || "", file_name: p.download_name || null,
      access_token: token, download_limit: p.download_limit ?? null, expires_at: expires,
    });
    grants.push({
      name: p.name,
      url: `${SUPABASE_URL}/functions/v1/pay/download/${token}`,
      instructions: p.access_instructions || p.purchase_note || null,
    });
  }
  if (grants.length && tx.customer_email) {
    const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto">
      <h2>Votre achat est prêt 🎉</h2>
      <p>Merci pour votre paiement chez <b>${bizName}</b> (référence <b>${tx.reference}</b>).</p>
      <p>Voici l'accès à vos produits numériques :</p>
      <ul>${grants.map((g) => `<li style="margin:10px 0"><b>${g.name}</b><br/>${g.url ? `<a href="${g.url}">Télécharger le fichier</a>` : ""}${g.instructions ? `<br/><span>${g.instructions}</span>` : ""}</li>`).join("")}</ul>
      <p style="color:#666;font-size:12px">Ces liens sont personnels. Conservez cet email comme preuve de paiement.</p>
    </div>`;
    await sendEmail({
      to: tx.customer_email,
      subject: `Accès à votre achat — ${bizName}`,
      html,
      text: grants.map((g) => `${g.name}: ${g.url}`).join("\n"),
      fromName: bizName,
    }).catch((e) => console.error("digital delivery email", e));
  }
  return grants;
}

// Consommation d'un lien de téléchargement (contrôle limite + expiration).
async function consumeDownload(token: string) {
  const db = admin();
  const { data: d } = await db.from("product_downloads").select("*").eq("access_token", token).maybeSingle();
  if (!d) return { error: "Lien de téléchargement introuvable", status: 404 };
  if (d.expires_at && new Date(d.expires_at).getTime() < Date.now()) return { error: "Lien expiré", status: 410 };
  if (d.download_limit !== null && Number(d.downloads_used) >= Number(d.download_limit)) {
    return { error: "Nombre de téléchargements atteint", status: 429 };
  }
  if (!d.file_url) return { error: "Aucun fichier associé", status: 404 };
  await db.from("product_downloads").update({
    downloads_used: Number(d.downloads_used) + 1, last_downloaded_at: new Date().toISOString(),
  }).eq("id", d.id);
  return { url: d.file_url as string };
}

async function createYengaPayIntent(opts: {
  amount: number; reference: string; title: string; description: string;
  callbackUrl: string; returnUrl?: string;
}) {
  if (!YENGAPAY_API_KEY || !YENGAPAY_GROUP_ID || !YENGAPAY_PROJECT_ID) {
    throw new Error("Passerelle YengaPay non configurée");
  }
  const url = `https://api.yengapay.com/api/v1/groups/${YENGAPAY_GROUP_ID}/payment-intent/${YENGAPAY_PROJECT_ID}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": YENGAPAY_API_KEY },
    body: JSON.stringify({
      paymentAmount: opts.amount,
      reference: opts.reference,
      articles: [{ title: opts.title.slice(0, 80), description: opts.description.slice(0, 200), pictures: [], price: opts.amount }],
      callbackUrl: opts.callbackUrl,
      ...(opts.returnUrl ? { returnUrl: opts.returnUrl, successUrl: opts.returnUrl, cancelUrl: opts.returnUrl } : {}),
    }),
  });
  const text = await res.text();
  let body: any = text; try { body = JSON.parse(text); } catch { /**/ }
  if (!res.ok) throw new Error(`YengaPay ${res.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  const checkoutUrl = body?.checkoutPageUrlWithPaymentToken || body?.checkout_url || body?.paymentUrl;
  const paymentIntentId = body?.id || body?.paymentIntentId || body?.paymentIntent?.id || body?.data?.id || null;
  return { checkoutUrl, paymentIntentId, raw: body };
}

async function lookupYengaPay(reference: string, paymentIntentId?: string | null) {
  if (!YENGAPAY_API_KEY || !YENGAPAY_GROUP_ID) return null;
  const candidates: string[] = [];
  if (paymentIntentId) candidates.push(`https://api.yengapay.com/api/v1/groups/${YENGAPAY_GROUP_ID}/payment-intent/${paymentIntentId}`);
  candidates.push(`https://api.yengapay.com/api/v1/groups/${YENGAPAY_GROUP_ID}/payment-intent/reference/${reference}`);
  for (const u of candidates) {
    try {
      const r = await fetch(u, { headers: { "x-api-key": YENGAPAY_API_KEY } });
      const t = await r.text(); let b: any = t; try { b = JSON.parse(t); } catch { /**/ }
      if (r.ok) return b;
    } catch { /**/ }
  }
  return null;
}

function mapStatus(raw: string): "pending" | "success" | "failed" {
  const s = String(raw || "").toUpperCase();
  if (["DONE", "SUCCESS", "SUCCEEDED", "COMPLETED", "PAID"].includes(s)) return "success";
  if (["FAILED", "CANCELLED", "CANCELED", "EXPIRED", "REJECTED"].includes(s)) return "failed";
  return "pending";
}

// Crédite atomiquement le marchand si paiement marqué success (idempotent).
async function settlePayment(db: any, paymentId: string, providerBody: any) {
  const { data: tx } = await db.from("payment_link_payments")
    .select("id,business_id,amount,status,fee_amount,net_amount,reference,currency,customer_email,customer_name,link_id,project_id,product_id,order_id").eq("id", paymentId).maybeSingle();
  if (!tx || tx.status !== "pending") return { credited: false };
  const { data: biz } = await db.from("businesses").select("id,balance,fee_bps").eq("id", tx.business_id).single();
  const fee = Math.round((Number(tx.amount) * Number(biz.fee_bps || 0)) / 10000);
  const net = Number(tx.amount) - fee;
  const { data: updated } = await db.from("payment_link_payments").update({
    status: "success", fee_amount: fee, net_amount: net,
    paid_at: new Date().toISOString(),
    metadata: { ...((tx as any).metadata || {}), settle: providerBody },
  }).eq("id", paymentId).eq("status", "pending").select("id").maybeSingle();
  if (!updated) return { credited: false };
  await db.from("businesses").update({ balance: Number(biz.balance) + net }).eq("id", biz.id);
  // Also credit project balance if linked
  if ((tx as any).project_id) {
    const { data: proj } = await db.from("projects").select("id,balance").eq("id", (tx as any).project_id).maybeSingle();
    if (proj) await db.from("projects").update({ balance: Number(proj.balance) + net }).eq("id", proj.id);
  }
  // Marque la commande liée comme payée
  if ((tx as any).order_id) {
    await db.from("orders").update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", (tx as any).order_id).eq("status", "pending_payment");
  }
  // Auto-generate receipt invoice
  try {
    const { data: link } = await db.from("payment_links").select("title").eq("id", (tx as any).link_id).maybeSingle();
    const { data: bizFull } = await db.from("businesses").select("name,slug").eq("id", tx.business_id).single();
    const ym = new Date().toISOString().slice(0, 7).replace("-", "");
    const { count } = await db.from("invoices").select("id", { count: "exact", head: true }).eq("business_id", tx.business_id);
    const number = `${String(bizFull.slug).toUpperCase().slice(0, 6)}-${ym}-${String((count || 0) + 1).padStart(4, "0")}`;
    await db.from("invoices").insert({
      business_id: tx.business_id, project_id: (tx as any).project_id || null,
      payment_id: tx.id, kind: "receipt", number,
      customer_name: (tx as any).customer_name, customer_email: (tx as any).customer_email,
      items: [{ label: link?.title || "Paiement", qty: 1, price: Number(tx.amount) }],
      subtotal: Number(tx.amount), tax: 0, total: Number(tx.amount),
      currency: tx.currency, status: "paid",
    });
    // Send confirmation email
    if ((tx as any).customer_email) {
      const html = receiptHtml({
        business: bizFull.name, reference: (tx as any).reference,
        amount: Number(tx.amount), currency: tx.currency,
        title: link?.title || "Paiement", date: new Date().toLocaleString("fr-FR"),
      });
      await sendEmail({
        to: (tx as any).customer_email,
        subject: `Reçu ${number} — ${bizFull.name}`,
        html, text: `Paiement confirmé de ${tx.amount} ${tx.currency} à ${bizFull.name}. Référence ${(tx as any).reference}.`,
        fromName: bizFull.name,
      }).catch((e) => console.error("receipt email failed", e));
      await db.from("payment_link_payments").update({ receipt_sent_at: new Date().toISOString() }).eq("id", tx.id);
    }
  } catch (e) { console.error("invoice/email pipeline", e); }
  // Produits numériques : génération des accès + email de livraison
  try {
    const { data: bizName } = await db.from("businesses").select("name").eq("id", tx.business_id).single();
    await grantDigitalDeliveries(db, tx, bizName?.name || "Votre marchand");
  } catch (e) { console.error("digital delivery", e); }
  if ((tx as any).project_id) {
    await deliverProjectWebhook(db, (tx as any).project_id, "payment.succeeded", {
      reference: (tx as any).reference, amount: Number(tx.amount), fee, net,
      currency: tx.currency, status: "success",
      customer_email: (tx as any).customer_email, customer_name: (tx as any).customer_name,
    }).catch((e) => console.error("project webhook", e));
  }
  return { credited: true, fee, net };
}


function appBaseUrl() {
  return (PUBLIC_APP_URL || "https://pay.faso-invest.com").replace(/\/+$/, "");
}

// ============================================================
// PAIEMENT MOBILE MONEY IN-APP (aucune redirection externe)
// ============================================================
function publicOperators() {
  const ops = [...YP.OPERATORS];
  // Ajouter Paydunya si configuré
  if (Deno.env.get("PAYDUNYA_TOKEN")) {
    ops.push({
      code: "PAYDUNYA",
      label: "Paydunya (Sénégal, Côte d'Ivoire...)",
      flow: "push",
      hint: "Payez via votre compte Paydunya ou Mobile Money local.",
    } as any);
  }
  return ops.map((o) => ({
    code: o.code, label: o.label, flow: o.flow,
    prefixes: o.prefixes, ussdPrefix: o.ussdPrefix || null,
    otpBySms: o.otpBySms !== false, hint: o.hint || null,
  }));
}

async function loadPending(db: any, reference: string) {
  const { data: tx } = await db.from("payment_link_payments")
    .select("id,reference,amount,currency,status,payment_intent_id,metadata,business_id,order_id")
    .eq("reference", reference).maybeSingle();
  return tx;
}

async function directStatus(db: any, tx: any) {
  const meta = (tx.metadata as any) || {};
  const intent = tx.payment_intent_id || meta.intent;
  if (!intent) return "pending" as const;
  try {
    const r = await YP.checkDirectPaymentStatus(intent);
    if (!r.ok) return "pending" as const;
    return YP.extractProviderStatus(r.body);
  } catch { return "pending" as const; }
}

// Contexte d'un paiement (page /checkout/:reference et suivi)
async function getCheckoutContext(reference: string) {
  const db = admin();
  const tx = await loadPending(db, reference);
  if (!tx) return null;
  const { data: biz } = await db.from("businesses").select("id,name,slug,logo_url").eq("id", tx.business_id).maybeSingle();
  const meta = (tx.metadata as any) || {};
  return {
    payment: {
      reference: tx.reference, amount: Number(tx.amount), currency: tx.currency,
      status: tx.status, description: meta.description || null, return_url: meta.return_url || null,
    },
    business: biz ? { id: biz.id, name: biz.name, slug: biz.slug, logo_url: biz.logo_url } : null,
    operators: publicOperators(),
  };
}

// Démarre le paiement : init intent + OTP (Orange) ou push USSD (autres)
async function payDirect(payload: any) {
  const db = admin();
  const reference = String(payload?.reference || "");
  const phone = String(payload?.phone || "").replace(/[^0-9+]/g, "");
  
  if (payload?.operator === "PAYDUNYA") {
    const tx = await loadPending(db, reference);
    if (!tx) throw new Error("Paiement introuvable");
    const { data: biz } = await db.from("businesses").select("name").eq("id", tx.business_id).single();
    const PD = await import("../_shared/paydunya.ts");
    const inv = await PD.createInvoice({
      amount: Number(tx.amount),
      description: `Paiement ${biz?.name || "Marchand"} - Ref ${reference}`,
      callback_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/paydunya-webhook`,
      return_url: `${appBaseUrl()}/order/${reference}`,
      cancel_url: `${appBaseUrl()}/order/${reference}`,
      customer: { email: tx.customer_email, name: tx.customer_name, phone: tx.customer_phone }
    });
    await db.from("payment_link_payments").update({ 
      payment_intent_id: inv.token,
      provider: "paydunya",
      metadata: { ...(tx.metadata || {}), token: inv.token }
    }).eq("id", tx.id);
    return { ok: true, status: "pending", checkoutUrl: inv.response_text || inv.token };
  }

  const op = YP.findOperator(String(payload?.operator || ""));
  if (!op) throw new Error("Opérateur non pris en charge");
  if (phone.replace(/\D/g, "").length < 8) throw new Error("Numéro de téléphone invalide");
  const tx = await loadPending(db, reference);
  if (!tx) throw new Error("Paiement introuvable");
  if (tx.status !== "pending") return { ok: true, status: tx.status, requiresOtp: false };

  const meta = (tx.metadata as any) || {};
  let intent = tx.payment_intent_id || meta.intent || null;
  // Une intention de paiement a une durée de vie courte : on en recrée une au-delà de 8 minutes.
  const intentAge = meta.intent_at ? Date.now() - new Date(meta.intent_at).getTime() : Infinity;
  if (intent && intentAge > 8 * 60 * 1000) intent = null;
  if (!intent) {
    let init: any;
    try {
      init = await YP.initDirectPayment({
        amount: Number(tx.amount), reference,
        callbackUrl: `${SUPABASE_URL}/functions/v1/yengapay-webhook`,
        description: meta.description || "Paiement",
      });
    } catch { throw new Error("Service de paiement momentanément indisponible. Réessayez."); }
      if (!init.ok) { console.error("[direct init]", reference, init.status, JSON.stringify(init.body).slice(0, 800)); throw new Error("Le paiement n'a pas pu être initié. Vérifiez le montant et réessayez."); }
    intent = YP.extractIntentId(init.body);
    const avail = YP.extractAvailableOperators(init.body);
    if (avail.length) meta.available = avail;
    if (!intent) { console.error("[direct init] no intent", reference, JSON.stringify(init.body).slice(0, 800)); throw new Error("Le paiement n'a pas pu être initié. Réessayez."); }
  }
  // Frais et total réels renvoyés par la passerelle pour cet opérateur.
  const availOp = (meta.available || []).find((a: any) => String(a?.code).toUpperCase() === op.ypCode);
  const fees = availOp ? Number(availOp.fees || 0) : 0;
  const total = availOp ? Number(availOp.totalAmount || tx.amount) : Number(tx.amount);
  await db.from("payment_link_payments").update({
    payment_intent_id: intent,
    customer_phone: phone,
    metadata: { ...meta, direct: true, operator: op.code, phone, intent, fees, total, intent_at: new Date().toISOString() },
  }).eq("id", tx.id);

  if (op.flow === "otp") {
    // Le code USSD doit porter le montant réellement débité (frais opérateur inclus).
    const ussd = YP.ussdCodeFor(op, total);
    // Orange Money : le client génère lui-même son code via USSD (aucun SMS à envoyer).
    if (op.otpBySms === false) {
      return {
        ok: true, requiresOtp: true, status: "pending", ussd, fees, total,
        message: op.hint || "Composez le code USSD pour générer votre code de paiement.",
      };
    }
    let r: any;
    try { r = await YP.sendDirectPaymentOtp({ reference, phone, operator: op.code, paymentIntentId: intent! }); }
    catch { throw new Error("Impossible d'envoyer le code de confirmation. Réessayez."); }
    if (!r.ok) { console.error("[direct otp]", reference, r.status, JSON.stringify(r.body).slice(0, 800)); throw new Error("L'envoi du code de confirmation a échoué. Vérifiez votre numéro."); }
    return { ok: true, requiresOtp: true, status: "pending", ussd, fees, total, message: r.body?.message || "Un code de confirmation vous a été envoyé par SMS." };
  }

  let r: any;
  try { r = await YP.payDirectPayment({ reference, phone, operator: op.code, paymentIntentId: intent! }); }
  catch { throw new Error("Impossible de joindre l'opérateur. Réessayez."); }
  if (!r.ok) { console.error("[direct pay]", reference, r.status, JSON.stringify(r.body).slice(0, 800)); throw new Error(providerMessage(r.body) || "L'opérateur a refusé l'opération. Vérifiez votre numéro et votre solde."); }
  const st = YP.extractProviderStatus(r.body);
  if (st === "success") { await settlePayment(db, tx.id, r.body); return { ok: true, requiresOtp: false, status: "success" }; }
  if (st === "failed") { await markFailed(db, tx, r.body); return { ok: true, requiresOtp: false, status: "failed" }; }
  return { ok: true, requiresOtp: false, status: "pending", fees, total, message: r.body?.message || op.hint || "Confirmez le paiement sur votre téléphone." };
}

/** Message d'erreur lisible renvoyé par la passerelle, sans exposer le partenaire. */
function providerMessage(body: any): string | null {
  const raw = body?.message || body?.error?.message || body?.error || (Array.isArray(body?.errors) ? body.errors[0] : null);
  const msg = typeof raw === "string" ? raw.trim() : "";
  if (!msg) return null;
  if (/yenga|kreezus/i.test(msg)) return null;
  const low = msg.toLowerCase();
  if (/otp (does not exist|not found|expired|invalid)|invalid otp|code (invalide|expir)/.test(low))
    return "Code de paiement invalide ou expiré. Générez un nouveau code sur votre téléphone puis réessayez immédiatement.";
  if (/insufficient|solde|balance/.test(low))
    return "Solde insuffisant sur votre compte Mobile Money.";
  if (/msisdn|phone|numero|number/.test(low))
    return "Numéro Mobile Money invalide pour cet opérateur.";
  if (/min(imum)?amount|max(imum)?amount|amount/.test(low))
    return "Montant non autorisé par l'opérateur pour cette transaction.";
  if (/expired|expire/.test(low))
    return "La session de paiement a expiré. Relancez le paiement.";
  if (/cancel|refus|declin/.test(low))
    return "Paiement refusé par l'opérateur.";
  return msg.slice(0, 180);
}

async function markFailed(db: any, tx: any, body: any) {
  await db.from("payment_link_payments").update({ status: "failed", metadata: { ...((tx.metadata as any) || {}), fail: body } })
    .eq("id", tx.id).eq("status", "pending");
  if (tx.order_id) await db.from("orders").update({ status: "cancelled" }).eq("id", tx.order_id).eq("status", "pending_payment");
}

// Confirmation OTP (Orange Money)
async function confirmDirect(payload: any) {
  const db = admin();
  const reference = String(payload?.reference || "");
  const otp = String(payload?.otp || "").replace(/\D/g, "");
  const tx = await loadPending(db, reference);
  if (!tx) throw new Error("Paiement introuvable");
  if (tx.status !== "pending") return { ok: true, status: tx.status };
  const meta = (tx.metadata as any) || {};
  if (!otp) throw new Error("Code de confirmation requis");
  let r: any;
  try { r = await YP.payDirectPayment({ reference, phone: meta.phone, operator: meta.operator, otp, paymentIntentId: tx.payment_intent_id || meta.intent }); }
  catch { throw new Error("Service momentanément indisponible. Réessayez."); }
  if (!r.ok) {
    console.error("[direct confirm]", reference, r.status, JSON.stringify(r.body).slice(0, 800));
    throw new Error(providerMessage(r.body) || "Code incorrect ou paiement refusé.");
  }
  const st = YP.extractProviderStatus(r.body);
  if (st === "success") { await settlePayment(db, tx.id, r.body); return { ok: true, status: "success" }; }
  if (st === "failed") { await markFailed(db, tx, r.body); return { ok: true, status: "failed" }; }
  return { ok: true, status: "pending" };
}

// --- Public actions (no auth) ---
async function getPublicLink(slug: string) {
  const db = admin();
  const { data: link } = await db.from("payment_links")
    .select("id,slug,title,description,amount,min_amount,max_amount,currency,status,business_id")
    .eq("slug", slug).maybeSingle();
  if (!link) return null;
  // On n'exclut que les statuts explicitement bloquants — un lien "draft"/"pending" reste utilisable
  if (["disabled", "archived", "deleted", "revoked"].includes(String(link.status || "").toLowerCase())) return null;
  const { data: biz } = await db.from("businesses")
    .select("id,name,slug,logo_url,status")
    .eq("id", link.business_id).maybeSingle();
  if (!biz) return null;
  // On accepte tout business existant (les status "pending"/"review" doivent pouvoir encaisser).
  if (biz.status === "suspended" || biz.status === "terminated" || biz.status === "banned") return null;
  return { link, business: { id: biz.id, name: biz.name, slug: biz.slug, logo_url: biz.logo_url } };
}

async function initCheckout(body: any) {
  const db = admin();
  const slug = String(body?.slug || "");
  const ctx = await getPublicLink(slug);
  if (!ctx) throw new Error("Lien introuvable ou inactif");
  const { link, business } = ctx;
  // Email obligatoire pour recevoir le reçu (sécurité + UX)
  const customerEmail = String(body?.customer_email || "").trim().toLowerCase();
  if (!customerEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customerEmail)) {
    throw new Error("Email client requis pour recevoir le reçu");
  }
  let amount = Number(link.amount);
  if (!link.amount) {
    amount = Number(body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Montant requis");
    if (link.min_amount && amount < Number(link.min_amount)) throw new Error(`Montant minimum ${link.min_amount}`);
    if (link.max_amount && amount > Number(link.max_amount)) throw new Error(`Montant maximum ${link.max_amount}`);
  }
  const reference = ref("LP");
  const { error } = await db.from("payment_link_payments").insert({
    link_id: link.id, business_id: business.id,
    project_id: (link as any).project_id || null,
    product_id: (link as any).product_id || null,
    reference, amount, currency: link.currency,
    customer_name: body?.customer_name || null,
    customer_phone: body?.customer_phone || null,
    customer_email: customerEmail,
    provider: "mobile_money",
    metadata: { direct: false, source: "link" },
  });
  if (error) throw new Error(error.message);
  
  // Rétablir la redirection YengaPay
  try {
    const { checkoutUrl, paymentIntentId } = await createYengaPayIntent({
      amount, reference,
      title: link.title || "Paiement",
      description: link.description || "Paiement via FASO-INVEST PAY",
      callbackUrl: `${SUPABASE_URL}/functions/v1/yengapay-webhook`,
      returnUrl: body?.returnUrl || `${appBaseUrl()}/order/${reference}`
    });
    
    if (checkoutUrl) {
      await db.from("payment_link_payments").update({ payment_intent_id: paymentIntentId }).eq("reference", reference);
      return { ok: true, reference, amount, currency: link.currency, checkoutUrl };
    }
  } catch (e) {
    console.error("YengaPay redirect init failed", e);
  }

  return { ok: true, reference, amount, currency: link.currency };
}

async function verifyPayment(reference: string) {
  const db = admin();
  const { data: tx } = await db.from("payment_link_payments")
    .select("id,status,payment_intent_id,reference,amount,currency,net_amount,fee_amount,paid_at,order_id,metadata,business_id")
    .eq("reference", reference).maybeSingle();
  if (!tx) return { ok: false, error: "Référence introuvable" };
  if (tx.status !== "pending") return { ok: true, status: tx.status, payment: tx };
  if (((tx as any).metadata as any)?.direct) {
    const st2 = await directStatus(db, tx);
    if (st2 === "success") { await settlePayment(db, tx.id, { verify: "direct" }); return { ok: true, status: "success", order_id: (tx as any).order_id || null }; }
    if (st2 === "failed") { await markFailed(db, tx, { verify: "direct" }); return { ok: true, status: "failed" }; }
    return { ok: true, status: "pending" };
  }
  if (tx.provider === "paydunya" && tx.payment_intent_id) {
    const PD = await import("../_shared/paydunya.ts");
    const confirmation = await PD.verifyInvoice(tx.payment_intent_id);
    const pdStatus = PD.mapPaydunyaStatus(confirmation.status);
    if (pdStatus === "success") {
      await settlePayment(db, tx.id, confirmation);
      return { ok: true, status: "success", order_id: (tx as any).order_id || null };
    }
    if (pdStatus === "failed") {
      await markFailed(db, tx, confirmation);
      return { ok: true, status: "failed" };
    }
    return { ok: true, status: "pending" };
  }

  const body = await lookupYengaPay(reference, tx.payment_intent_id);
  if (!body) return { ok: true, status: "pending" };
  const st = mapStatus(body?.status || body?.paymentStatus || body?.data?.status);
  if (st === "success") {
    await settlePayment(db, tx.id, body);
    return { ok: true, status: "success", order_id: (tx as any).order_id || null };
  }
  if (st === "failed") {
    await db.from("payment_link_payments").update({ status: "failed", metadata: { verify: body } }).eq("id", tx.id).eq("status", "pending");
    if ((tx as any).order_id) {
      await db.from("orders").update({ status: "cancelled" }).eq("id", (tx as any).order_id).eq("status", "pending_payment");
    }
    return { ok: true, status: "failed" };
  }
  return { ok: true, status: "pending" };
}

// ============================================================
// SHOP (public storefront) — vitrine complète du marchand
// ============================================================
async function getPublicShop(slug: string) {
  const db = admin();
  const { data: biz } = await db.from("businesses")
    .select("id,name,slug,description,tagline,theme,logo_url,cover_url,contact_email,contact_phone,status,template_id")
    .eq("slug", slug).maybeSingle();
  if (!biz || ["suspended", "terminated", "banned"].includes(String(biz.status || "").toLowerCase())) return null;
  const [{ data: products }, { data: posts }, { data: media }, { data: projects }, { data: template }] = await Promise.all([
    db.from("products").select("id,name,slug,description,price,currency,status,project_id,image_url,show_in_shop")
      .eq("business_id", biz.id).eq("status", "active").eq("show_in_shop", true)
      .order("created_at", { ascending: false }),
    db.from("business_posts").select("id,title,body,image_url,product_id,published_at")
      .eq("business_id", biz.id).eq("published", true).order("published_at", { ascending: false }).limit(20),
    db.from("product_media").select("product_id,type,url,position").order("position", { ascending: true }),
    db.from("projects").select("id,name,slug,description,logo_url,cover_url,currency")
      .eq("business_id", biz.id).eq("show_in_shop", true).order("created_at", { ascending: false }),
    biz.template_id ? db.from("shop_templates").select("id,name,config").eq("id", biz.template_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const mediaByProduct: Record<string, any[]> = {};
  for (const m of (media || [])) {
    (mediaByProduct[(m as any).product_id] ||= []).push(m);
  }
  const productsWithMedia = (products || []).map((p: any) => ({
    ...p,
    media: mediaByProduct[p.id] || (p.image_url ? [{ product_id: p.id, type: "image", url: p.image_url, position: 0 }] : []),
  }));
  return {
    business: {
      id: biz.id, name: biz.name, slug: biz.slug, description: biz.description,
      tagline: (biz as any).tagline || null, theme: (biz as any).theme || {},
      logo_url: biz.logo_url, cover_url: (biz as any).cover_url || null,
      contact_email: biz.contact_email, contact_phone: biz.contact_phone,
      template: template || null,
    },
    projects: [
      ...(productsWithMedia.some((p: any) => !p.project_id)
        ? [{
            id: "_shop", name: "Produits", description: null, cover_url: null, logo_url: null,
            products: productsWithMedia.filter((p: any) => !p.project_id),
          }]
        : []),
      ...(projects || [])
        .map((pr: any) => ({ ...pr, products: productsWithMedia.filter((p: any) => p.project_id === pr.id) }))
        .filter((pr: any) => pr.products.length > 0),
    ],
    products: productsWithMedia,
    posts: posts || [],
  };
}

async function initShopCheckout(body: any) {
  const db = admin();
  const businessSlug = String(body?.business_slug || "");
  const items: Array<{ product_id: string; quantity: number }> = Array.isArray(body?.items) ? body.items : [];
  const customerEmail = String(body?.customer_email || "").trim().toLowerCase();
  if (!customerEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customerEmail)) {
    throw new Error("Email client requis pour recevoir le reçu");
  }
  if (items.length === 0) throw new Error("Panier vide");
  const { data: biz } = await db.from("businesses").select("id,name,slug,status").eq("slug", businessSlug).maybeSingle();
  if (!biz || ["suspended", "terminated", "banned"].includes(String(biz.status || "").toLowerCase())) throw new Error("Boutique introuvable");
  const productIds = items.map((i) => String(i.product_id));
  const { data: products } = await db.from("products").select("id,name,price,currency,status,business_id").in("id", productIds);
  const valid = (products || []).filter((p: any) => p.business_id === biz.id && p.status === "active");
  if (valid.length === 0) throw new Error("Produits invalides");
  const currency = valid[0].currency || "XOF";
  let total = 0;
  const orderItems: any[] = [];
  for (const it of items) {
    const p: any = valid.find((x: any) => x.id === it.product_id);
    if (!p) continue;
    const qty = Math.max(1, Math.floor(Number(it.quantity) || 1));
    total += Number(p.price) * qty;
    orderItems.push({ product_id: p.id, name: p.name, unit_price: Number(p.price), quantity: qty });
  }
  if (total <= 0) throw new Error("Total invalide");
  // Créer l'ordre
  const { data: numRow } = await db.rpc("generate_order_number");
  const orderNumber = (numRow as any) || `CMD-${Date.now()}`;
  const { data: order, error: oErr } = await db.from("orders").insert({
    business_id: biz.id, order_number: orderNumber, status: "pending_payment",
    customer_name: body?.customer_name || null, customer_email: customerEmail,
    customer_phone: body?.customer_phone || null, shipping_address: body?.shipping_address || null,
    customer_note: body?.customer_note || null,
    total_amount: total, currency,
    metadata: { source: "shop" },
  }).select("id,order_number,public_token").single();
  if (oErr) throw new Error(oErr.message);
  await db.from("order_items").insert(orderItems.map((it) => ({ ...it, order_id: order.id })));

  const reference = ref("SH");
  const { error: pErr } = await db.from("payment_link_payments").insert({
    business_id: biz.id, order_id: order.id,
    reference, amount: total, currency,
    customer_name: body?.customer_name || null,
    customer_phone: body?.customer_phone || null,
    customer_email: customerEmail,
    provider: "mobile_money",
    metadata: { source: "shop", direct: false },
  });
  if (pErr) throw new Error(pErr.message);

  // Rétablir la redirection YengaPay pour le Shop
  try {
    const { checkoutUrl, paymentIntentId } = await createYengaPayIntent({
      amount: total, reference,
      title: `Commande ${order.order_number}`,
      description: `Paiement boutique ${biz.name}`,
      callbackUrl: `${SUPABASE_URL}/functions/v1/yengapay-webhook`,
      returnUrl: body?.returnUrl || `${appBaseUrl()}/shop/${biz.slug}?order=${order.public_token}&pay_ref=${reference}`
    });
    
    if (checkoutUrl) {
      await db.from("payment_link_payments").update({ payment_intent_id: paymentIntentId }).eq("reference", reference);
      return { ok: true, reference, amount: total, currency, order_token: order.public_token, checkoutUrl };
    }
  } catch (e) {
    console.error("YengaPay shop redirect init failed", e);
  }

  return { ok: true, reference, amount: total, currency, order_token: order.public_token };
}

// Vitrine publique d'un projet (catalogue produits)
async function getPublicVitrine(projectId: string) {
  const db = admin();
  const { data: project } = await db.from("projects")
    .select("id,name,slug,description,logo_url,cover_url,currency,status,business_id")
    .eq("id", projectId).maybeSingle();
  if (!project) return null;
  const { data: biz } = await db.from("businesses")
    .select("id,name,slug,description,logo_url,contact_email,contact_phone,status")
    .eq("id", project.business_id).maybeSingle();
  if (!biz || ["suspended", "terminated", "banned"].includes(String(biz.status || "").toLowerCase())) return null;
  const { data: products } = await db.from("products")
    .select("id,name,slug,description,price,currency,status")
    .eq("project_id", project.id).eq("status", "active")
    .order("created_at", { ascending: false });
  const ids = (products || []).map((p: any) => p.id);
  const { data: media } = ids.length
    ? await db.from("product_media").select("product_id,type,url,position").in("product_id", ids).order("position", { ascending: true })
    : { data: [] as any[] };
  const byProduct: Record<string, any[]> = {};
  for (const m of (media || [])) (byProduct[(m as any).product_id] ||= []).push(m);
  return {
    project: {
      id: project.id, name: project.name, slug: project.slug, description: project.description,
      logo_url: project.logo_url, cover_url: project.cover_url, currency: project.currency || "XOF",
    },
    business: { id: biz.id, name: biz.name, slug: biz.slug, logo_url: biz.logo_url, contact_email: biz.contact_email, contact_phone: biz.contact_phone },
    products: (products || []).map((p: any) => ({ ...p, media: byProduct[p.id] || [] })),
  };
}

async function getPublicOrder(token: string) {
  const db = admin();
  const { data: order } = await db.from("orders")
    .select("id,order_number,status,customer_name,customer_email,total_amount,currency,paid_at,created_at,updated_at,merchant_note,shipping_address,business_id")
    .eq("public_token", token).maybeSingle();
  if (!order) return null;
  const [{ data: items }, { data: biz }] = await Promise.all([
    db.from("order_items").select("name,unit_price,quantity").eq("order_id", order.id),
    db.from("businesses").select("name,slug,logo_url,contact_email,contact_phone").eq("id", order.business_id).single(),
  ]);
  return { order, items: items || [], business: biz };
}

// --- API key actions (LigdiCash-style) ---
async function apiCreateLink(business_id: string, body: any) {
  const db = admin();
  const title = String(body?.title || "").trim();
  if (title.length < 2) throw new Error("title requis");
  const base = (title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "link").slice(0, 40);
  let slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  for (let i = 0; i < 5; i++) {
    const { data } = await db.from("payment_links").select("id").eq("slug", slug).maybeSingle();
    if (!data) break;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  const { data: row, error } = await db.from("payment_links").insert({
    business_id, slug, title,
    description: body?.description || null,
    amount: body?.amount ?? null,
    min_amount: body?.min_amount ?? null,
    max_amount: body?.max_amount ?? null,
    currency: body?.currency || "XOF",
    redirect_url: body?.redirect_url || null,
    callback_url: body?.callback_url || null,
    status: "active",
  }).select("id,slug,title,amount,currency,status,created_at").single();
  if (error) throw new Error(error.message);
  return { ...row, pay_url: `/pay/${row.slug}` };
}

async function apiGetPayment(business_id: string, reference: string) {
  const db = admin();
  const { data } = await db.from("payment_link_payments")
    .select("id,reference,amount,currency,status,customer_name,customer_phone,customer_email,fee_amount,net_amount,paid_at,created_at")
    .eq("business_id", business_id).eq("reference", reference).maybeSingle();
  if (!data) return null;
  return data;
}

// Crée une session de paiement pour un projet marchand (API passerelle).
async function apiCreateSession(auth: ApiAuth, body: any) {
  const db = admin();
  const amount = Number(body?.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("amount requis (entier > 0)");
  const currency = String(body?.currency || "XOF").toUpperCase();
  const description = String(body?.description || body?.title || "Paiement").slice(0, 200);
  const customer_email = String(body?.customer_email || "").trim().toLowerCase() || null;
  const reference = String(body?.reference || "").trim() || ref("API");
  if (!/^[A-Za-z0-9\-_]{6,40}$/.test(reference)) throw new Error("reference invalide");
  const { data: dup } = await db.from("payment_link_payments").select("id").eq("reference", reference).maybeSingle();
  if (dup) throw new Error("reference déjà utilisée");

  const { data: biz } = await db.from("businesses").select("id,name,status").eq("id", auth.business_id).maybeSingle();
  if (!biz || ["suspended", "terminated", "banned"].includes(String(biz.status || "").toLowerCase())) {
    throw new Error("Compte marchand indisponible");
  }
  const returnUrl = String(body?.return_url || body?.returnUrl || "");
  const { error } = await db.from("payment_link_payments").insert({
    business_id: auth.business_id, project_id: auth.project_id || null,
    reference, amount, currency,
    customer_name: body?.customer_name || null,
    customer_phone: body?.customer_phone || null,
    customer_email,
    provider: "mobile_money",
    metadata: { source: "api", key_id: auth.key_id, metadata: body?.metadata ?? null, direct: true, return_url: returnUrl, description },
  });
  if (error) throw new Error(error.message);
  return { reference, amount, currency, status: "pending", checkout_url: `${appBaseUrl()}/checkout/${reference}` };
}

// Notifie le marchand dès l'ouverture de la page de paiement (transaction lisible en temps réel).
async function notifyPending(db: any, projectId: string | null | undefined, data: Record<string, unknown>) {
  if (!projectId) return;
  await deliverProjectWebhook(db, projectId, "payment.pending", data).catch((e) => console.error("pending webhook", e));
}

// --- Dispatcher ---
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  try {
    const url = new URL(req.url);
    // Path-based routing for REST clients: /pay/v1/...
    const segments = url.pathname.split("/").filter(Boolean);
    // Last segment after function name "pay"
    const tail = segments.slice(segments.indexOf("pay") + 1);

    // ===== Téléchargement de produit numérique : GET /pay/download/:token =====
    if (tail[0] === "download" && tail[1] && req.method === "GET") {
      const r = await consumeDownload(String(tail[1]));
      if ((r as any).error) return jsonResponse({ error: (r as any).error }, (r as any).status || 400);
      return new Response(null, { status: 302, headers: { ...corsHeaders, Location: (r as any).url } });
    }

    // ===== REST API style (LigdiCash-like) =====
    if (tail[0] === "v1") {
      const auth = await authenticateApiKey(req);
      if (!auth) return jsonResponse({ error: "Invalid or missing API key" }, 401);
      // Test de clé : GET /v1/ping
      if ((tail[1] === "ping" || tail[1] === "me") && req.method === "GET") {
        return jsonResponse({ ok: true, data: { business_id: auth.business_id, project_id: auth.project_id ?? null, mode: auth.mode } });
      }
      // Session de paiement : POST /v1/checkout/sessions | /v1/payments | /v1/charges
      const isSession =
        (tail[1] === "checkout" && (tail[2] === "sessions" || tail[2] === "session")) ||
        ((tail[1] === "payments" || tail[1] === "charges" || tail[1] === "payment-intents") && !tail[2]);
      if (isSession && req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        const s = await apiCreateSession(auth, body);
        await notifyPending(admin(), auth.project_id, { ...s, project_id: auth.project_id });
        return jsonResponse({ ok: true, data: s });
      }
      if (tail[1] === "payment-links" && req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        const link = await apiCreateLink(auth.business_id, body);
        return jsonResponse({ ok: true, data: link });
      }
      if (tail[1] === "payments" && tail[2] && req.method === "GET") {
        const p = await apiGetPayment(auth.business_id, tail[2]);
        if (!p) return jsonResponse({ error: "Payment not found" }, 404);
        return jsonResponse({ ok: true, data: p });
      }
      return jsonResponse({ error: "Unknown endpoint" }, 404);
    }

    // ===== Public action style (used by the React /pay/:slug page) =====
    if (req.method === "POST") {
      const payload = await req.json().catch(() => ({}));
      const action = String(payload?.action || "");
      // Anti-abuse: rate-limit by IP for public actions
      const limits: Record<string, number> = { getLink: 60, initCheckout: 10, verifyPayment: 60, getShop: 60, getVitrine: 60, initShopCheckout: 10, getOrder: 30, payDirect: 15, confirmDirect: 20, getCheckout: 60 };
      if (limits[action]) {
        const ok = await checkPublicRateLimit(`pay:${action}`, req, limits[action]);
        if (!ok) return jsonResponse({ error: "Trop de requêtes, réessayez dans une minute." }, 429);
      }
      if (action === "getLink") {
        const ctx = await getPublicLink(String(payload?.slug || ""));
        if (!ctx) return jsonResponse({ error: "Not found" }, 404);
        return jsonResponse({ ok: true, ...ctx });
      }
      if (action === "initCheckout") {
        // Sanitize inputs (defense in depth)
        payload.customer_name = String(payload?.customer_name || "").slice(0, 80);
        payload.customer_phone = String(payload?.customer_phone || "").slice(0, 24);
        const r = await initCheckout(payload);
        return jsonResponse(r);
      }
      if (action === "getCheckout") {
        const ctx = await getCheckoutContext(String(payload?.reference || ""));
        if (!ctx) return jsonResponse({ error: "Paiement introuvable" }, 404);
        return jsonResponse({ ok: true, ...ctx });
      }
      if (action === "listOperators") {
        return jsonResponse({ ok: true, operators: publicOperators() });
      }
      if (action === "payDirect") {
        const r = await payDirect(payload);
        return jsonResponse(r);
      }
      if (action === "confirmDirect") {
        const r = await confirmDirect(payload);
        return jsonResponse(r);
      }
      if (action === "verifyPayment") {
        const refStr = String(payload?.reference || "");
        if (!/^[A-Z0-9\-]{6,40}$/.test(refStr)) return jsonResponse({ error: "Invalid reference" }, 400);
        const r = await verifyPayment(refStr);
        return jsonResponse(r);
      }
      if (action === "getShop") {
        const s = String(payload?.slug || "");
        const ctx = await getPublicShop(s);
        if (!ctx) return jsonResponse({ error: "Boutique introuvable" }, 404);
        return jsonResponse({ ok: true, ...ctx });
      }
      if (action === "initShopCheckout") {
        const r = await initShopCheckout(payload);
        return jsonResponse(r);
      }
      if (action === "getVitrine") {
        const pid = String(payload?.project_id || "");
        if (!/^[0-9a-f-]{36}$/i.test(pid)) return jsonResponse({ error: "Projet invalide" }, 400);
        const ctx = await getPublicVitrine(pid);
        if (!ctx) return jsonResponse({ error: "Vitrine introuvable" }, 404);
        return jsonResponse({ ok: true, ...ctx });
      }
      if (action === "getOrder") {
        const tok = String(payload?.token || "");
        if (!/^[a-f0-9]{16,64}$/i.test(tok)) return jsonResponse({ error: "Token invalide" }, 400);
        const o = await getPublicOrder(tok);
        if (!o) return jsonResponse({ error: "Commande introuvable" }, 404);
        return jsonResponse({ ok: true, ...o });
      }
      return jsonResponse({ error: "Unknown action" }, 400);
    }
    return jsonResponse({ error: "Method not allowed" }, 405);
  } catch (e) {
    return jsonResponse({ error: (e as Error).message || "Internal error" }, 400);
  }
});

// Helper exported for the webhook (settlement)
export { settlePayment, mapStatus };