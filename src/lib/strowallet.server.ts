const RAW_BASE = process.env.STROWALLET_BASE_URL || "https://strowallet.com/api";

function pub() {
  const key = process.env.STROWALLET_PUBLIC_KEY;
  if (!key) throw new Error("STROWALLET_PUBLIC_KEY missing");
  return key;
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    sp.append(k, String(v));
  }
  return sp.toString();
}

function base() {
  return RAW_BASE.replace(/\/$/, "");
}

function apiPath(path: string) {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (base().endsWith("/api")) return clean.startsWith("/api/") ? clean.slice(4) : clean;
  return clean.startsWith("/api/") ? clean : `/api${clean}`;
}

function formatProviderError(body: unknown) {
  if (typeof body === "string") return body;
  if (body && typeof body === "object") {
    const payload = body as { message?: unknown; errors?: unknown; error?: unknown };
    const message = payload.message ?? payload.error;
    if (typeof message === "string") return message;
    if (message && typeof message === "object") return JSON.stringify(message);
    if (payload.errors && typeof payload.errors === "object") return JSON.stringify(payload.errors);
    return JSON.stringify(body);
  }
  return "Réponse Strowallet invalide";
}

// Strowallet bitvcard endpoints use GET with query-string parameters.
async function callGet(path: string, params: Record<string, string | number | undefined>): Promise<any> {
  const qs = buildQuery({ public_key: pub(), ...params });
  const finalPath = apiPath(path);
  const url = `${base()}${finalPath}${finalPath.includes("?") ? "&" : "?"}${qs}`;
  const res = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
  const text = await res.text();
  let body: any = text;
  try { body = JSON.parse(text); } catch { /* keep text */ }
  if (!res.ok) throw new Error(`Strowallet ${res.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  if (typeof body === "string" && body.includes("<html")) {
    throw new Error(`Strowallet a renvoyé une page HTML au lieu d'une réponse API pour ${path}. Vérifiez l'URL de base configurée.`);
  }
  return body;
}

// Strowallet bitvcard write endpoints (create/freeze/etc.) use POST with form-encoded body.
async function callPost(path: string, params: Record<string, string | number | undefined>): Promise<any> {
  const body = buildQuery({ public_key: pub(), ...params });
  const finalPath = apiPath(path);
  const url = `${base()}${finalPath}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body,
    redirect: "follow",
  });
  const text = await res.text();
  let parsed: any = text;
  try { parsed = JSON.parse(text); } catch { /* keep text */ }
  if (!res.ok) throw new Error(`Strowallet ${res.status}: ${typeof parsed === "string" ? parsed.slice(0, 300) : JSON.stringify(parsed)}`);
  // If Strowallet returned an HTML 404 page despite 200, surface a clean error
  if (typeof parsed === "string" && parsed.includes("<html")) {
    throw new Error(`Strowallet a renvoyé une page HTML (endpoint ${path} introuvable). Vérifiez la clé publique et l'URL de base.`);
  }
  if (parsed && typeof parsed === "object" && (("success" in parsed && parsed.success === false) || ("status" in parsed && parsed.status === false))) {
    throw new Error(`Strowallet: ${formatProviderError(parsed)}`);
  }
  return parsed;
}

export async function getStrowalletBalance() {
  return callGet(`/bitvcard/balance/`, {});
}

export async function createStrowalletCustomer(payload: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string; // YYYY-MM-DD
  idType: string;
  idNumber: string;
  idImage: string; // URL
  selfie: string; // URL
  address: string;
  city: string;
  country: string;
}) {
  return callPost(`/bitvcard/create-user/`, {
    firstName: payload.firstName,
    lastName: payload.lastName,
    customerEmail: payload.email,
    phoneNumber: payload.phone.replace(/[^0-9]/g, ''),
    dateOfBirth: (() => { const [y, m, d] = payload.dob.split("-"); return `${m}/${d}/${y}`; })(),
    idType: (() => { const t = payload.idType.toLowerCase(); if (t === "nin") return "national_id"; if (t === "voters_card") return "voters_card"; if (t === "id_card") return "id_card"; return t; })(),
    idNumber: payload.idNumber,
    idImage: payload.idImage,
    userPhoto: payload.selfie,
    line1: payload.address,
    city: payload.city,
    country: payload.country,
    state: payload.city,
    zipCode: "00000",
    houseNumber: "1",
  });
}

export async function createStrowalletCard(payload: {
  customerEmail: string;
  amount: number;
  brand?: "Visa" | "MasterCard";
}) {
  return callPost(`/bitvcard/create-card/`, {
    name_on_card: payload.customerEmail,
    card_type: "virtual",
    amount: payload.amount,
    customerEmail: payload.customerEmail,
    mode: "sandbox",
  });
}

export async function getStrowalletCardDetails(card_id: string) {
  return callGet(`/bitvcard/fetch-card-detail/`, { card_id });
}

export async function strowalletCardAction(action: "freeze" | "unfreeze" | "terminate", card_id: string) {
  const path = action === "freeze" ? "/bitvcard/freeze-card/" : action === "unfreeze" ? "/bitvcard/unfreeze-card/" : "/bitvcard/terminate-card/";
  return callPost(path, { card_id });
}

// Raw diagnostic call — returns status + raw body so we can debug Strowallet routing without throwing.
export async function strowalletDiagnostic(): Promise<{
  base: string;
  publicKeyPresent: boolean;
  attempts: Array<{ method: string; path: string; status: number; contentType: string; bodyPreview: string }>;
}> {
  const apiBase = base();
  const publicKey = process.env.STROWALLET_PUBLIC_KEY || "";
  const attempts: Array<{ method: string; path: string; status: number; contentType: string; bodyPreview: string }> = [];

  async function probe(method: "GET" | "POST", path: string, params: Record<string, string>) {
    const qs = new URLSearchParams({ public_key: publicKey, ...params }).toString();
    const finalPath = apiPath(path);
    const url = method === "GET" ? `${apiBase}${finalPath}?${qs}` : `${apiBase}${finalPath}`;
    try {
      const res = await fetch(url, {
        method,
        headers: method === "POST"
          ? { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }
          : { Accept: "application/json" },
        body: method === "POST" ? qs : undefined,
        redirect: "follow",
      });
      const text = await res.text();
      attempts.push({
        method, path, status: res.status,
        contentType: res.headers.get("content-type") || "",
        bodyPreview: text.slice(0, 400),
      });
    } catch (e) {
      attempts.push({ method, path, status: 0, contentType: "", bodyPreview: `fetch error: ${(e as Error).message}` });
    }
  }

  // Probe balance (read-only) in both modes, then create-user OPTIONS-like check
  await probe("GET", "/bitvcard/balance/", {});
  await probe("POST", "/bitvcard/balance/", {});
  await probe("POST", "/bitvcard/create-user/", {
    firstName: "TEST", lastName: "PROBE", customerEmail: "probe@example.com",
    phoneNumber: "+22600000000", dateOfBirth: "1990-01-01",
    idType: "PASSPORT", idNumber: "TEST123",
    idImage: "https://via.placeholder.com/300", userPhoto: "https://via.placeholder.com/300",
    line1: "Test street", city: "Ouagadougou", country: "BF", state: "Centre",
    zipCode: "00226", houseNumber: "1",
  });

  return { base: apiBase, publicKeyPresent: !!publicKey, attempts };
}