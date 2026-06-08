import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders } from "../_shared/cors.ts";

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
  const secret = Deno.env.get("YENGAPAY_WEBHOOK_SECRET");
  if (!secret) return new Response("Missing webhook secret", { status: 500, headers: corsHeaders });
  const raw = await req.text();
  const sig = req.headers.get("x-yengapay-signature") || req.headers.get("x-signature") || "";
  const expected = await hmacHex(secret, raw);
  if (!timingSafeEqual(new TextEncoder().encode(sig), new TextEncoder().encode(expected))) {
    return new Response("Invalid signature", { status: 401, headers: corsHeaders });
  }
  let payload: any;
  try { payload = JSON.parse(raw); } catch { return new Response("Bad JSON", { status: 400, headers: corsHeaders }); }
  const reference: string | undefined = payload?.reference || payload?.data?.reference;
  const status: string | undefined = (payload?.status || payload?.data?.status || "").toLowerCase();
  if (!reference) return new Response("Missing reference", { status: 400, headers: corsHeaders });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: tx } = await admin.from("transactions").select("id,user_id,amount,status").eq("provider_ref", reference).maybeSingle();
  if (!tx) return new Response("Tx not found", { status: 404, headers: corsHeaders });
  if (tx.status === "success") return new Response("ok", { headers: corsHeaders });

  if (status === "success" || status === "completed" || status === "paid") {
    await admin.from("transactions").update({ status: "success", metadata: payload }).eq("id", tx.id);
    const { data: w } = await admin.from("wallets").select("id,balance").eq("user_id", tx.user_id).eq("currency", "XOF").maybeSingle();
    if (w) await admin.from("wallets").update({ balance: Number(w.balance) + Number(tx.amount) }).eq("id", w.id);
  } else if (status === "failed" || status === "cancelled") {
    await admin.from("transactions").update({ status: "failed", metadata: payload }).eq("id", tx.id);
  }
  return new Response("ok", { headers: corsHeaders });
});