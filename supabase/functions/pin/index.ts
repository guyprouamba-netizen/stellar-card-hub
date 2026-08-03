// Fonction PIN : gestion du code PIN à 6 chiffres (définition / vérification / statut).
// Le hash n'est jamais renvoyé au client. Utilise le service role côté serveur.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

const TRIVIAL_PINS = new Set([
  "000000", "111111", "222222", "333333", "444444", "555555",
  "666666", "777777", "888888", "999999",
  "123456", "654321", "012345", "543210",
]);

function isSequential(pin: string) {
  let asc = true;
  let desc = true;
  for (let i = 1; i < pin.length; i++) {
    const prev = pin.charCodeAt(i - 1);
    const cur = pin.charCodeAt(i);
    if (cur - prev !== 1) asc = false;
    if (prev - cur !== 1) desc = false;
  }
  return asc || desc;
}

function isValidPin(pin: unknown): pin is string {
  if (typeof pin !== "string") return false;
  if (!/^\d{6}$/.test(pin)) return false;
  if (TRIVIAL_PINS.has(pin)) return false;
  if (isSequential(pin)) return false;
  return true;
}

function toHex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

async function hashPin(pin: string) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = toHex(saltBytes.buffer);
  const hashHex = await sha256Hex(`${saltHex}:${pin}`);
  return `sha256$${saltHex}$${hashHex}`;
}

async function verifyPinHash(pin: string, stored: string) {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "sha256") return false;
  const [, saltHex, hashHex] = parts;
  const candidate = await sha256Hex(`${saltHex}:${pin}`);
  if (candidate.length !== hashHex.length) return false;
  // Comparaison en temps constant
  let diff = 0;
  for (let i = 0; i < candidate.length; i++) diff |= candidate.charCodeAt(i) ^ hashHex.charCodeAt(i);
  return diff === 0;
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
  const { data, error } = await client.auth.getClaims(token);
  const userId = (data as any)?.claims?.sub;
  if (error || !userId) {
    // Repli de compatibilité si getClaims indisponible sur cette version du SDK
    const { data: userData, error: userErr } = await client.auth.getUser(token);
    if (userErr || !userData.user) throw new Error("Unauthorized");
    return { userId: userData.user.id };
  }
  return { userId: userId as string };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Méthode non autorisée" }, 405);

  try {
    const { userId } = await getAuthUser(req);
    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    const admin = adminClient();

    if (action === "status") {
      const { data, error } = await admin.from("profiles").select("pin_hash").eq("id", userId).maybeSingle();
      if (error) throw error;
      return jsonResponse({ hasPin: !!data?.pin_hash });
    }

    if (action === "set") {
      const pin = body?.pin;
      if (!isValidPin(pin)) {
        return jsonResponse({ error: "Le code PIN doit contenir exactement 6 chiffres et ne pas être une suite triviale." }, 400);
      }
      const hash = await hashPin(pin);
      const { error } = await admin
        .from("profiles")
        .update({ pin_hash: hash, pin_set_at: new Date().toISOString(), pin_failed_attempts: 0, pin_locked_until: null })
        .eq("id", userId);
      if (error) throw error;
      return jsonResponse({ ok: true });
    }

    if (action === "verify") {
      const pin = body?.pin;
      if (typeof pin !== "string" || !/^\d{6}$/.test(pin)) {
        return jsonResponse({ error: "Code PIN invalide." }, 400);
      }
      const { data: profile, error } = await admin
        .from("profiles")
        .select("pin_hash, pin_failed_attempts, pin_locked_until")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!profile?.pin_hash) {
        return jsonResponse({ error: "Aucun code PIN configuré." }, 400);
      }

      const now = Date.now();
      if (profile.pin_locked_until && new Date(profile.pin_locked_until).getTime() > now) {
        const remainingMs = new Date(profile.pin_locked_until).getTime() - now;
        return jsonResponse({
          ok: false,
          locked: true,
          lockedUntil: profile.pin_locked_until,
          remaining: 0,
          message: `Trop de tentatives. Réessayez dans ${Math.ceil(remainingMs / 60000)} minute(s).`,
        }, 423);
      }

      const match = await verifyPinHash(pin, profile.pin_hash);
      if (match) {
        await admin.from("profiles").update({ pin_failed_attempts: 0, pin_locked_until: null }).eq("id", userId);
        return jsonResponse({ ok: true });
      }

      const attempts = (profile.pin_failed_attempts ?? 0) + 1;
      const remaining = Math.max(0, MAX_ATTEMPTS - attempts);
      const update: Record<string, unknown> = { pin_failed_attempts: attempts };
      let locked = false;
      if (attempts >= MAX_ATTEMPTS) {
        update.pin_locked_until = new Date(now + LOCK_MINUTES * 60_000).toISOString();
        update.pin_failed_attempts = 0;
        locked = true;
      }
      await admin.from("profiles").update(update).eq("id", userId);
      return jsonResponse({
        ok: false,
        locked,
        remaining: locked ? 0 : remaining,
        message: locked
          ? `Trop de tentatives. Compte verrouillé ${LOCK_MINUTES} minutes.`
          : `Code PIN incorrect. ${remaining} tentative(s) restante(s).`,
      });
    }

    return jsonResponse({ error: "Action inconnue" }, 400);
  } catch (e: any) {
    const message = e?.message === "Unauthorized" ? "Non autorisé" : "Une erreur est survenue.";
    return jsonResponse({ error: message }, e?.message === "Unauthorized" ? 401 : 500);
  }
});
