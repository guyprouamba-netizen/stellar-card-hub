import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders } from "../_shared/cors.ts";
import { strowalletCardAction, normalizeKycVerdict } from "../_shared/strowallet.ts";

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i];
  return r === 0;
}

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  const secret = Deno.env.get("STROWALLET_WEBHOOK_SECRET");
  if (!secret) return new Response("Webhook secret not configured", { status: 500, headers: corsHeaders });
  const body = await req.text();
  const sig = req.headers.get("x-strowallet-signature") || req.headers.get("x-webhook-signature") || "";
  const expected = await hmacHex(secret, body);
  if (!timingSafeEqual(new TextEncoder().encode(sig), new TextEncoder().encode(expected))) {
    return new Response("Invalid signature", { status: 401, headers: corsHeaders });
  }
  let payload: any;
  try { payload = JSON.parse(body); } catch { return new Response("Bad JSON", { status: 400, headers: corsHeaders }); }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const eventType: string = payload?.event || payload?.type || "";
  const lower = eventType.toLowerCase();

  if (lower.includes("kyc") || lower.includes("customer")) {
    const customerId: string | undefined = payload?.data?.customerId || payload?.customerId || payload?.data?.bitvcard_customer_id;
    const customerEmail: string | undefined = payload?.data?.customerEmail || payload?.customerEmail || payload?.data?.email;
    let userId: string | null = null;
    if (customerId) {
      const { data } = await admin.from("profiles").select("id").eq("strowallet_customer_id", customerId).maybeSingle();
      userId = data?.id ?? null;
    }
    if (!userId && customerEmail) {
      const { data } = await admin.from("profiles").select("id").eq("email", customerEmail).maybeSingle();
      userId = data?.id ?? null;
    }
    if (userId) {
      const { raw, verdict } = normalizeKycVerdict(payload);
      const status = verdict === "approved" ? "approved" : verdict === "rejected" ? "rejected" : undefined;
      await admin.from("kyc_submissions").update({
        provider_status: raw ?? verdict, provider_response: payload,
        ...(status ? { status } : {}),
      }).eq("user_id", userId);
      if (customerId) await admin.from("profiles").update({ strowallet_customer_id: customerId }).eq("id", userId);
    }
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const cardId: string | undefined = payload?.data?.card_id || payload?.card_id;
  if (!cardId) return new Response("ok", { status: 200, headers: corsHeaders });
  const { data: card } = await admin.from("cards").select("id,user_id,failed_attempts,status").eq("provider_card_id", cardId).maybeSingle();
  if (!card) return new Response("unknown card", { status: 200, headers: corsHeaders });

  const failureEvents = ["card.transaction.declined","card.payment.failed","transaction.declined","payment_failed","card.transaction.failed"];
  const successEvents = ["card.transaction.success","card.payment.success","transaction.success"];

  if (failureEvents.some((e) => lower.includes(e.toLowerCase()))) {
    const attempts = (card.failed_attempts ?? 0) + 1;
    try { await strowalletCardAction("freeze", cardId); } catch { /* ignore */ }
    await admin.from("cards").update({ failed_attempts: attempts, status: "frozen_auto", auto_frozen_at: new Date().toISOString() }).eq("id", card.id);
    await admin.from("transactions").insert({
      user_id: card.user_id, type: "card_auto_freeze", status: "success",
      amount: 0, currency: "USD", provider: "strowallet", provider_ref: cardId,
      description: "Carte gelée automatiquement après tentative de paiement échouée",
      metadata: payload,
    });
  } else if (successEvents.some((e) => lower.includes(e.toLowerCase()))) {
    await admin.from("cards").update({ failed_attempts: 0 }).eq("id", card.id);
  }
  return new Response("ok", { status: 200, headers: corsHeaders });
});