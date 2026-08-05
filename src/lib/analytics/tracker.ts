import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "fasopay:analytics:session";
const VISITOR_KEY = "fasopay:analytics:visitor";
const GEO_KEY = "fasopay:analytics:geo";
const SESSION_TTL_MS = 30 * 60 * 1000;

type SessionRecord = { key: string; expiresAt: number };

function uid() {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch { /* ignore */ }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

export function detectDevice(): string {
  const ua = navigator.userAgent;
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) return "tablette";
  if (/Mobi|Android|iPhone|iPod|Opera Mini|IEMobile/i.test(ua)) return "mobile";
  return "desktop";
}

export function detectBrowser(): string {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/SamsungBrowser/.test(ua)) return "Samsung Internet";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  return "Autre";
}

export function detectOs(): string {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac OS X/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Autre";
}

function classifySource(referrer: string, params: URLSearchParams): string {
  const utm = (params.get("utm_medium") || "").toLowerCase();
  if (utm.includes("cpc") || utm.includes("paid") || params.get("gclid") || params.get("fbclid")) return "publicité";
  if (!referrer) return "direct";
  let host = "";
  try { host = new URL(referrer).hostname.replace(/^www\./, ""); } catch { return "direct"; }
  if (host === location.hostname) return "direct";
  if (/facebook|instagram|twitter|x\.com|tiktok|linkedin|whatsapp|telegram|snapchat|youtube/.test(host)) return "réseaux sociaux";
  if (/google|bing|yahoo|duckduckgo|ecosia|qwant/.test(host)) return "organique";
  return "référencement";
}

/** Géolocalisation approximative (pays/ville) — best effort, mise en cache 24 h. */
async function resolveGeo(): Promise<{ country?: string; country_code?: string; city?: string }> {
  const cached = read<{ value: any; savedAt: number }>(GEO_KEY);
  if (cached && Date.now() - cached.savedAt < 24 * 3600_000) return cached.value;
  try {
    const res = await fetch("https://ipapi.co/json/");
    if (!res.ok) throw new Error("geo");
    const j = await res.json();
    const value = { country: j.country_name || undefined, country_code: j.country_code || undefined, city: j.city || undefined };
    write(GEO_KEY, { value, savedAt: Date.now() });
    return value;
  } catch {
    return cached?.value ?? {};
  }
}

function currentSessionKey(): { key: string; isNew: boolean } {
  const existing = read<SessionRecord>(SESSION_KEY);
  if (existing && existing.expiresAt > Date.now()) {
    write(SESSION_KEY, { key: existing.key, expiresAt: Date.now() + SESSION_TTL_MS });
    return { key: existing.key, isNew: false };
  }
  const key = uid();
  write(SESSION_KEY, { key, expiresAt: Date.now() + SESSION_TTL_MS });
  return { key, isNew: true };
}

function visitorKey(): { key: string; returning: boolean } {
  const existing = read<string>(VISITOR_KEY);
  if (existing) return { key: existing, returning: true };
  const key = uid();
  write(VISITOR_KEY, key);
  return { key, returning: false };
}

let sessionKeyCache: string | null = null;
let bootstrapped = false;

export function getSessionKey(): string {
  if (!sessionKeyCache) sessionKeyCache = currentSessionKey().key;
  return sessionKeyCache;
}

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch { return null; }
}

/** Crée (ou rafraîchit) la session analytique courante. */
export async function startSession() {
  if (typeof window === "undefined" || !navigator.onLine) return;
  const { key, isNew } = currentSessionKey();
  sessionKeyCache = key;
  const visitor = visitorKey();
  const userId = await currentUserId();
  if (!isNew && bootstrapped) {
    await supabase.from("analytics_sessions")
      .update({ last_seen_at: new Date().toISOString(), ...(userId ? { user_id: userId } : {}) })
      .eq("session_key", key);
    return;
  }
  bootstrapped = true;
  if (!isNew) {
    await supabase.from("analytics_sessions")
      .update({ last_seen_at: new Date().toISOString(), ...(userId ? { user_id: userId } : {}) })
      .eq("session_key", key);
    return;
  }
  const params = new URLSearchParams(location.search);
  const geo = await resolveGeo();
  await supabase.from("analytics_sessions").insert({
    session_key: key,
    user_id: userId,
    visitor_key: visitor.key,
    is_returning: visitor.returning,
    device_type: detectDevice(),
    browser: detectBrowser(),
    os: detectOs(),
    referrer: document.referrer || null,
    source: classifySource(document.referrer || "", params),
    utm_source: params.get("utm_source"),
    utm_medium: params.get("utm_medium"),
    utm_campaign: params.get("utm_campaign"),
    landing_path: location.pathname,
    country: geo.country ?? null,
    country_code: geo.country_code ?? null,
    city: geo.city ?? null,
  });
}

/** Enregistre une page vue et le temps passé sur la page précédente. */
export async function trackPageview(path: string, title?: string) {
  if (typeof window === "undefined" || !navigator.onLine) return;
  try {
    const key = getSessionKey();
    const userId = await currentUserId();
    await supabase.from("analytics_events").insert({
      session_key: key, user_id: userId, kind: "pageview",
      path, title: title ?? document.title, funnel_step: funnelStepFor(path),
    });
  } catch { /* le tracking ne doit jamais casser l'UI */ }
}

/** Temps passé sur une page (envoyé quand on la quitte). */
export async function trackPageDuration(path: string, durationMs: number) {
  if (typeof window === "undefined" || !navigator.onLine || durationMs < 300) return;
  try {
    const userId = await currentUserId();
    await supabase.from("analytics_events").insert({
      session_key: getSessionKey(), user_id: userId, kind: "page_duration",
      path, duration_ms: Math.min(durationMs, 30 * 60_000),
    });
  } catch { /* silencieux */ }
}

/** Action clé (recharger, acheter une carte, retirer…). */
export async function trackAction(action: string, meta: Record<string, unknown> = {}) {
  if (typeof window === "undefined" || !navigator.onLine) return;
  try {
    const userId = await currentUserId();
    await supabase.from("analytics_events").insert({
      session_key: getSessionKey(), user_id: userId, kind: "action",
      action, path: location.pathname, funnel_step: funnelStepFor(location.pathname), meta: meta as any,
    });
  } catch { /* le tracking ne doit jamais casser l'UI */ }
}

export function funnelStepFor(path: string): string | null {
  if (path === "/") return "accueil";
  if (path.startsWith("/shop")) return "boutique";
  if (path.startsWith("/pay")) return "paiement";
  if (path.startsWith("/order")) return "confirmation";
  if (path.startsWith("/dashboard")) return "tableau_de_bord";
  if (path.startsWith("/cards")) return "cartes";
  if (path.startsWith("/wallet")) return "portefeuille";
  return null;
}