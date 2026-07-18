// Phone OTP via BBG SMS — send + verify.
// Public function (verify_jwt=false via default). Uses service role.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BBG_TOKEN = Deno.env.get("BBG_SMS_API_TOKEN")!;
const BBG_ENDPOINT = "https://bbgsmsapp.betterbegoing.com/api/http/sms/send";

function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const d = String(input).replace(/[^\d]/g, "");
  if (!d) return null;
  if (d.startsWith("226") && d.length >= 11) return d.slice(0, 11);
  if (d.length === 8) return "226" + d;
  if (d.length >= 10 && d.length <= 15) return d;
  return null;
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(status: number, body: any) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

async function sendSms(recipient: string, message: string, sender_id = "FASOPAY") {
  const res = await fetch(BBG_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ api_token: BBG_TOKEN, recipient, sender_id, type: "plain", message }),
  });
  const text = await res.text();
  let body: any = text; try { body = JSON.parse(text); } catch { /* */ }
  return { ok: res.ok, body, status: res.status };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  let payload: any = {};
  try { payload = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }
  const action = String(payload?.action || "");

  if (action === "send") {
    const phone = normalizePhone(payload?.phone);
    if (!phone) return json(400, { error: "Numéro invalide" });

    // Anti-spam: max 3 codes / 15 min pour ce numéro
    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    const { count } = await admin.from("phone_otp").select("id", { count: "exact", head: true })
      .eq("phone", phone).gte("created_at", since);
    if ((count ?? 0) >= 3) return json(429, { error: "Trop de tentatives, patientez 15 min." });

    // Vérifier qu'aucun autre compte vérifié n'utilise déjà ce numéro
    const { data: existing } = await admin.rpc("normalize_bf_phone", { input: phone });
    void existing;
    const { data: dupes } = await admin.from("profiles").select("id, phone_verified").eq("phone", phone);
    // (l'index unique protège déjà; on renvoie un message clair si déjà vérifié)
    const userId = String(payload?.user_id || "") || null;
    const takenByOther = (dupes || []).some((p: any) => p.phone_verified && p.id !== userId);
    if (takenByOther) return json(409, { error: "Ce numéro est déjà utilisé par un autre compte." });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const code_hash = await sha256(code + ":" + phone);
    const expires_at = new Date(Date.now() + 10 * 60_000).toISOString();

    const { error: insErr } = await admin.from("phone_otp").insert({
      phone, code_hash, expires_at, user_id: userId,
    });
    if (insErr) return json(500, { error: insErr.message });

    const message = `FASO-INVEST PAY: votre code de vérification est ${code}. Valide 10 min. Ne le partagez avec personne.`;
    const r = await sendSms(phone, message);
    if (!r.ok) return json(502, { error: "SMS non délivré: " + (r.body?.message || r.body?.error || r.status) });
    return json(200, { ok: true });
  }

  if (action === "verify") {
    const phone = normalizePhone(payload?.phone);
    const code = String(payload?.code || "").trim();
    const userId = String(payload?.user_id || "") || null;
    if (!phone || !/^\d{6}$/.test(code)) return json(400, { error: "Code invalide" });

    const { data: otps } = await admin.from("phone_otp").select("*")
      .eq("phone", phone).is("consumed_at", null)
      .order("created_at", { ascending: false }).limit(1);
    const otp = otps?.[0];
    if (!otp) return json(400, { error: "Aucun code en attente" });
    if (new Date(otp.expires_at).getTime() < Date.now())
      return json(400, { error: "Code expiré, redemandez-en un" });
    if ((otp.attempts ?? 0) >= 5) return json(429, { error: "Trop de tentatives" });

    const expected = await sha256(code + ":" + phone);
    if (expected !== otp.code_hash) {
      await admin.from("phone_otp").update({ attempts: (otp.attempts ?? 0) + 1 }).eq("id", otp.id);
      return json(400, { error: "Code incorrect" });
    }

    await admin.from("phone_otp").update({ consumed_at: new Date().toISOString() }).eq("id", otp.id);
    if (userId) {
      await admin.from("profiles").update({
        phone, phone_verified: true, phone_verified_at: new Date().toISOString(),
      }).eq("id", userId);
    }
    return json(200, { ok: true });
  }

  return json(400, { error: "action inconnue" });
});