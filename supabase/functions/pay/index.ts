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
    .select("id,business_id,mode,revoked_at").eq("key_hash", key_hash).maybeSingle();
  if (!data || data.revoked_at) return null;
  await db.from("business_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return { business_id: data.business_id, mode: data.mode, key_id: data.id };
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
    .select("id,business_id,amount,status,fee_amount,net_amount,reference,currency,customer_email,customer_name,link_id,project_id,product_id").eq("id", paymentId).maybeSingle();
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
    .select("id,status,payment_intent_id,reference,amount,currency,net_amount,fee_amount,paid_at")
    .eq("reference", reference).maybeSingle();
  if (!tx) return { ok: false, error: "Référence introuvable" };
  if (tx.status !== "pending") return { ok: true, status: tx.status, payment: tx };
  const body = await lookupYengaPay(reference, tx.payment_intent_id);
  if (!body) return { ok: true, status: "pending" };
  const st = mapStatus(body?.status || body?.paymentStatus || body?.data?.status);
  if (st === "success") {
    await settlePayment(db, tx.id, body);
    return { ok: true, status: "success" };
  }
  if (st === "failed") {
    await db.from("payment_link_payments").update({ status: "failed", metadata: { verify: body } }).eq("id", tx.id).eq("status", "pending");
    return { ok: true, status: "failed" };
  }
  return { ok: true, status: "pending" };
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
      if (action === "getLink") {
        const ctx = await getPublicLink(String(payload?.slug || ""));
        if (!ctx) return jsonResponse({ error: "Not found" }, 404);
        return jsonResponse({ ok: true, ...ctx });
      }
      if (action === "initCheckout") {
        const r = await initCheckout(payload);
        return jsonResponse(r);
      }
      if (action === "verifyPayment") {
        const r = await verifyPayment(String(payload?.reference || ""));
        return jsonResponse(r);
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