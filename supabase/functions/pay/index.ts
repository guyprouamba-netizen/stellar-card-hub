// Public payment gateway endpoint — handles /pay/:slug checkouts AND
// LigdiCash-style REST API authenticated by per-business API keys.
//
// JWT verification is disabled (see config.toml) because anonymous shoppers
// and external systems use this endpoint.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { sendEmail, receiptHtml } from "../_shared/email.ts";

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

async function authenticateApiKey(req: Request): Promise<{ business_id: string; mode: string; key_id: string } | null> {
  const h = req.headers.get("Authorization") || req.headers.get("X-API-Key") || "";
  const token = h.toLowerCase().startsWith("bearer ") ? h.slice(7) : h;
  if (!token || !token.startsWith("fip_")) return null;
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
  return { credited: true, fee, net };
}

// --- Public actions (no auth) ---
async function getPublicLink(slug: string) {
  const db = admin();
  const { data: link } = await db.from("payment_links")
    .select("id,slug,title,description,amount,min_amount,max_amount,currency,status,business_id")
    .eq("slug", slug).maybeSingle();
  if (!link || link.status !== "active") return null;
  const { data: biz } = await db.from("businesses")
    .select("id,name,slug,logo_url,status")
    .eq("id", link.business_id).maybeSingle();
  if (!biz || biz.status !== "active") return null;
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
  const callbackUrl = `${SUPABASE_URL}/functions/v1/yengapay-webhook`;
  const baseReturn = String(body?.returnUrl || link.redirect_url || "");
  const returnUrl = baseReturn
    ? baseReturn + (baseReturn.includes("?") ? "&" : "?") + `pay_ref=${encodeURIComponent(reference)}`
    : "";
  const yp = await createYengaPayIntent({
    amount, reference,
    title: link.title, description: `${business.name} — ${link.title}`,
    callbackUrl, returnUrl,
  });
  const { error } = await db.from("payment_link_payments").insert({
    link_id: link.id, business_id: business.id,
    project_id: (link as any).project_id || null,
    product_id: (link as any).product_id || null,
    reference, amount, currency: link.currency,
    customer_name: body?.customer_name || null,
    customer_phone: body?.customer_phone || null,
    customer_email: customerEmail,
    provider: "yengapay",
    payment_intent_id: yp.paymentIntentId,
    metadata: { init: yp.raw },
  });
  if (error) throw new Error(error.message);
  return { ok: true, reference, checkout_url: yp.checkoutUrl };
}

async function verifyPayment(reference: string) {
  const db = admin();
  const { data: tx } = await db.from("payment_link_payments")
    .select("id,status,payment_intent_id,reference,amount,currency,net_amount,fee_amount,paid_at,order_id")
    .eq("reference", reference).maybeSingle();
  if (!tx) return { ok: false, error: "Référence introuvable" };
  if (tx.status !== "pending") return { ok: true, status: tx.status, payment: tx };
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
    .select("id,name,slug,description,logo_url,contact_email,contact_phone,status")
    .eq("slug", slug).maybeSingle();
  if (!biz || biz.status !== "active") return null;
  const [{ data: products }, { data: posts }, { data: media }] = await Promise.all([
    db.from("products").select("id,name,slug,description,price,currency,status")
      .eq("business_id", biz.id).eq("status", "active").order("created_at", { ascending: false }),
    db.from("business_posts").select("id,title,body,image_url,product_id,published_at")
      .eq("business_id", biz.id).eq("published", true).order("published_at", { ascending: false }).limit(20),
    db.from("product_media").select("product_id,type,url,position").order("position", { ascending: true }),
  ]);
  const mediaByProduct: Record<string, any[]> = {};
  for (const m of (media || [])) {
    (mediaByProduct[(m as any).product_id] ||= []).push(m);
  }
  const productsWithMedia = (products || []).map((p: any) => ({ ...p, media: mediaByProduct[p.id] || [] }));
  return {
    business: { id: biz.id, name: biz.name, slug: biz.slug, description: biz.description, logo_url: biz.logo_url, contact_email: biz.contact_email, contact_phone: biz.contact_phone },
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
  if (!biz || biz.status !== "active") throw new Error("Boutique introuvable");
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
  // Créer paiement YengaPay
  const reference = ref("SHOP");
  const callbackUrl = `${SUPABASE_URL}/functions/v1/yengapay-webhook`;
  const baseReturn = String(body?.returnUrl || "");
  const returnUrl = baseReturn
    ? baseReturn + (baseReturn.includes("?") ? "&" : "?") + `pay_ref=${encodeURIComponent(reference)}&order=${encodeURIComponent(order.public_token)}`
    : "";
  const yp = await createYengaPayIntent({
    amount: total, reference,
    title: `Commande ${orderNumber}`,
    description: `${biz.name} — ${orderItems.length} article(s)`,
    callbackUrl, returnUrl,
  });
  await db.from("payment_link_payments").insert({
    link_id: null as any, business_id: biz.id, order_id: order.id,
    reference, amount: total, currency,
    customer_name: body?.customer_name || null,
    customer_phone: body?.customer_phone || null,
    customer_email: customerEmail,
    provider: "yengapay",
    payment_intent_id: yp.paymentIntentId,
    metadata: { init: yp.raw, order_id: order.id },
  } as any);
  return { ok: true, reference, checkout_url: yp.checkoutUrl, order_token: order.public_token, order_number: orderNumber };
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

// --- Dispatcher ---
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  try {
    const url = new URL(req.url);
    // Path-based routing for REST clients: /pay/v1/...
    const segments = url.pathname.split("/").filter(Boolean);
    // Last segment after function name "pay"
    const tail = segments.slice(segments.indexOf("pay") + 1);

    // ===== REST API style (LigdiCash-like) =====
    if (tail[0] === "v1") {
      const auth = await authenticateApiKey(req);
      if (!auth) return jsonResponse({ error: "Invalid or missing API key" }, 401);
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
      const limits: Record<string, number> = { getLink: 60, initCheckout: 10, verifyPayment: 30 };
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