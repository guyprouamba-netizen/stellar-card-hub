// Strowallet API wrapper (Deno port of src/lib/strowallet.server.ts)
const RAW_BASE = Deno.env.get("STROWALLET_BASE_URL") || "https://strowallet.com/api";

function pub() {
  const key = Deno.env.get("STROWALLET_PUBLIC_KEY");
  if (!key) throw new Error("STROWALLET_PUBLIC_KEY missing");
  return key;
}

function base() { return RAW_BASE.replace(/\/$/, ""); }

function apiPath(path: string) {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (base().endsWith("/api")) return clean.startsWith("/api/") ? clean.slice(4) : clean;
  return clean.startsWith("/api/") ? clean : `/api${clean}`;
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    sp.append(k, String(v));
  }
  return sp.toString();
}

function formatProviderError(body: unknown) {
  if (typeof body === "string") return body;
  if (body && typeof body === "object") {
    const p = body as { message?: unknown; errors?: unknown; error?: unknown };
    const m = p.message ?? p.error;
    if (typeof m === "string") return m;
    if (m && typeof m === "object") return JSON.stringify(m);
    if (p.errors && typeof p.errors === "object") return JSON.stringify(p.errors);
    return JSON.stringify(body);
  }
  return "Réponse Strowallet invalide";
}

async function callGet(path: string, params: Record<string, string | number | undefined>): Promise<any> {
  const qs = buildQuery({ public_key: pub(), ...params });
  const fp = apiPath(path);
  const url = `${base()}${fp}${fp.includes("?") ? "&" : "?"}${qs}`;
  const res = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
  const text = await res.text();
  let body: any = text;
  try { body = JSON.parse(text); } catch { /**/ }
  if (!res.ok) throw new Error(`Strowallet ${res.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  if (typeof body === "string" && body.includes("<html")) {
    throw new Error(`Strowallet a renvoyé une page HTML au lieu d'une réponse API pour ${path}. Vérifiez l'URL de base configurée.`);
  }
  return body;
}

async function callPost(path: string, params: Record<string, string | number | undefined>): Promise<any> {
  const body = buildQuery({ public_key: pub(), ...params });
  const fp = apiPath(path);
  const url = `${base()}${fp}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body,
    redirect: "follow",
  });
  const text = await res.text();
  let parsed: any = text;
  try { parsed = JSON.parse(text); } catch { /**/ }
  if (!res.ok) throw new Error(`Strowallet ${res.status}: ${typeof parsed === "string" ? parsed.slice(0, 300) : JSON.stringify(parsed)}`);
  if (typeof parsed === "string" && parsed.includes("<html")) {
    throw new Error(`Strowallet a renvoyé une page HTML (endpoint ${path} introuvable).`);
  }
  if (parsed && typeof parsed === "object" && (("success" in parsed && parsed.success === false) || ("status" in parsed && parsed.status === false))) {
    throw new Error(`Strowallet: ${formatProviderError(parsed)}`);
  }
  return parsed;
}

export async function getStrowalletBalance(currency: "USD" | "NGN" = "USD") {
  return callGet(`/wallet/balance/${currency}/`, {});
}

export async function createStrowalletCustomer(p: any) {
  return callPost(`/bitvcard/create-user/`, {
    firstName: p.firstName, lastName: p.lastName, customerEmail: p.email,
    phoneNumber: String(p.phone).replace(/[^0-9]/g, ""),
    dateOfBirth: (() => { const [y, m, d] = String(p.dob).split("-"); return `${m}/${d}/${y}`; })(),
    idType: String(p.idType).toUpperCase(),
    idNumber: p.idNumber, idImage: p.idImage, userPhoto: p.selfie,
    line1: p.address, city: p.city, country: p.country,
    state: p.state || p.city, zipCode: p.zipCode || "00000", houseNumber: p.houseNumber || "1",
  });
}

export function extractStrowalletCustomerId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const r = payload as any;
  const raw = r.response?.customerId ?? r.response?.bitvcard_customer_id ?? r.customerId ?? r.bitvcard_customer_id;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export async function getStrowalletCardholder(p: { customerEmail?: string; customerId?: string }) {
  return callGet(`/bitvcard/getcardholder/`, { customerEmail: p.customerEmail, customerId: p.customerId });
}

export async function ensureStrowalletCustomer(p: any) {
  try {
    const existing = await getStrowalletCardholder({ customerEmail: p.email });
    const id = extractStrowalletCustomerId(existing);
    if (id) return { customerId: id, created: false as const, response: existing };
  } catch { /**/ }
  const created = await createStrowalletCustomer(p);
  const id = extractStrowalletCustomerId(created);
  if (!id) throw new Error("Strowallet a répondu sans customerId après création du client.");
  return { customerId: id, created: true as const, response: created };
}

export async function createStrowalletCard(p: { customerEmail: string; amount: number; brand?: string }) {
  return callPost(`/bitvcard/create-card/`, {
    name_on_card: p.customerEmail, card_type: "virtual",
    amount: p.amount, customerEmail: p.customerEmail, mode: "sandbox",
  });
}

export async function getStrowalletCardDetails(card_id: string) {
  return callGet(`/bitvcard/fetch-card-detail/`, { card_id });
}

export async function fundStrowalletCard(p: { card_id: string; amount: number }) {
  return callPost(`/bitvcard/fund-card/`, { card_id: p.card_id, amount: p.amount });
}

export async function getStrowalletCardTransactions(p: { card_id: string }) {
  return callGet(`/bitvcard/card-transactions/`, { card_id: p.card_id });
}

export async function strowalletCardAction(action: "freeze" | "unfreeze" | "terminate", card_id: string) {
  const path = action === "freeze" ? "/bitvcard/freeze-card/" : action === "unfreeze" ? "/bitvcard/unfreeze-card/" : "/bitvcard/terminate-card/";
  return callPost(path, { card_id });
}

export function normalizeKycVerdict(payload: unknown): { raw: string | null; verdict: "approved"|"rejected"|"pending"|"unknown"; reason: string | null } {
  if (!payload || typeof payload !== "object") return { raw: null, verdict: "unknown", reason: null };
  const root = payload as any;
  const c = root.response ?? root.customer ?? root.data ?? root;
  const cands = [c?.kycStatus, c?.kyc_status, c?.idStatus, c?.id_status, c?.status, c?.verificationStatus, c?.verification_status, c?.customerStatus, c?.customer_status].filter((x) => typeof x === "string");
  const raw = cands.length ? String(cands[0]) : null;
  const reason = (typeof c?.reason === "string" && c.reason) || (typeof c?.message === "string" && c.message) || null;
  if (!raw) return { raw: null, verdict: "unknown", reason };
  const v = raw.toLowerCase();
  if (["approved", "high_kyc", "verified", "active", "success", "successful"].some((k) => v.includes(k))) return { raw, verdict: "approved", reason };
  if (["reject", "declin", "denied", "failed", "fail"].some((k) => v.includes(k))) return { raw, verdict: "rejected", reason };
  if (["pending", "review", "processing", "low_kyc", "unreview", "submitted", "wait"].some((k) => v.includes(k))) return { raw, verdict: "pending", reason };
  return { raw, verdict: "unknown", reason };
}

export async function strowalletDiagnostic() {
  const apiBase = base();
  const publicKey = Deno.env.get("STROWALLET_PUBLIC_KEY") || "";
  const attempts: any[] = [];
  async function probe(method: "GET"|"POST", path: string, params: Record<string,string>) {
    const qs = new URLSearchParams({ public_key: publicKey, ...params }).toString();
    const fp = apiPath(path);
    const url = method === "GET" ? `${apiBase}${fp}?${qs}` : `${apiBase}${fp}`;
    try {
      const res = await fetch(url, {
        method,
        headers: method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" } : { Accept: "application/json" },
        body: method === "POST" ? qs : undefined,
        redirect: "follow",
      });
      const text = await res.text();
      attempts.push({ method, path, status: res.status, contentType: res.headers.get("content-type") || "", bodyPreview: text.slice(0, 400) });
    } catch (e) { attempts.push({ method, path, status: 0, contentType: "", bodyPreview: `fetch error: ${(e as Error).message}` }); }
  }
  await probe("GET", "/wallet/balance/USD/", {});
  await probe("GET", "/wallet/balance/NGN/", {});
  return { base: apiBase, publicKeyPresent: !!publicKey, attempts };
}