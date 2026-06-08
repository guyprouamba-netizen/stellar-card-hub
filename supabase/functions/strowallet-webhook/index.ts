import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders } from "../_shared/cors.ts";
import { freezeNfcCard, extractNfcCard } from "../_shared/strowallet.ts";

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

  // Événements virtualcard.* (nouvelle API NFC)
  const cardId: string | undefined = payload?.cardId || payload?.card_id || payload?.data?.cardId || payload?.data?.card_id;
  if (!cardId) return new Response("ok", { status: 200, headers: corsHeaders });
  const { data: card } = await admin.from("cards").select("id,user_id,failed_attempts,status,balance").eq("provider_card_id", cardId).maybeSingle();
  if (!card) return new Response("unknown card", { status: 200, headers: corsHeaders });

  const isCreated = lower.includes("created");
  const isDeclined = lower.includes("declined") || lower.includes("failed");
  const isTerminated = lower.includes("terminated");
  const isWithdraw = lower.includes("withdrawal");
  const isSuccess = lower.includes("success") || lower.includes("complete");

  if (isCreated) {
    const { last4, brand } = extractNfcCard(payload);
    await admin.from("cards").update({
      status: "active",
      ...(last4 ? { last4 } : {}),
      ...(brand ? { brand: brand.toLowerCase() } : {}),
    }).eq("id", card.id);
  } else if (isTerminated) {
    await admin.from("cards").update({ status: "terminated" }).eq("id", card.id);
    await admin.from("transactions").insert({
      user_id: card.user_id, type: "card_terminated", status: "success",
      amount: Number(payload?.amount ?? 0), currency: "USD", provider: "strowallet", provider_ref: cardId,
      description: "Carte résiliée par l'émetteur", metadata: payload,
    });
  } else if (isDeclined) {
    const attempts = (card.failed_attempts ?? 0) + 1;
    if (attempts >= 2) {
      try { await freezeNfcCard(cardId); } catch { /* ignore */ }
      await admin.from("cards").update({ failed_attempts: attempts, status: "frozen_auto", auto_frozen_at: new Date().toISOString() }).eq("id", card.id);
      await admin.from("transactions").insert({
        user_id: card.user_id, type: "card_auto_freeze", status: "success",
        amount: 0, currency: "USD", provider: "strowallet", provider_ref: cardId,
        description: `Carte gelée automatiquement après 2 tentatives échouées — ${payload?.reason || "paiement refusé"}`,
        metadata: payload,
      });
    } else {
      await admin.from("cards").update({ failed_attempts: attempts }).eq("id", card.id);
    }
  } else if (isWithdraw && isSuccess) {
    const amt = Number(payload?.amount ?? 0);
    if (amt > 0) {
      await admin.from("cards").update({ balance: Math.max(0, Number(card.balance) - amt) }).eq("id", card.id);
    }
    await admin.from("transactions").insert({
      user_id: card.user_id, type: "card_withdraw", status: "success",
      amount: amt, currency: "USD", provider: "strowallet", provider_ref: cardId,
      description: "Retrait depuis la carte virtuelle", metadata: payload,
    });
  } else if (isSuccess) {
    await admin.from("cards").update({ failed_attempts: 0 }).eq("id", card.id);
  }
  return new Response("ok", { status: 200, headers: corsHeaders });
});