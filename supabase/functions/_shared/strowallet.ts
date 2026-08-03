// Strowallet NFC Card API wrapper
// Doc: https://strowallet.readme.io/reference/create-nfc-card
const RAW_BASE = Deno.env.get("STROWALLET_BASE_URL") || "https://strowallet.com/api";
const MODE = Deno.env.get("STROWALLET_MODE") || "sandbox";
const base = () => RAW_BASE.replace(/\/$/, "").replace(/\/api$/, "") + "/api";

function pub() {
  const key = Deno.env.get("STROWALLET_PUBLIC_KEY");
  if (!key) throw new Error("STROWALLET_PUBLIC_KEY missing");
  return key;
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.append(k, String(v));
  }
  return sp.toString();
}

async function call(method: "GET" | "POST", path: string, params: Record<string, string | number | undefined>): Promise<any> {
  // NOTE: l'API NFC (/bitvcard/...) n'accepte PAS le paramètre `mode`
  // (réservé à l'ancienne API USA virtual card). L'inclure provoque
  // 422 {"mode":["The selected mode is invalid."]}.
  const qs = buildQuery({ public_key: pub(), ...params });
  const url = `${base()}${path}?${qs}`;
  const res = await fetch(url, { method, headers: { Accept: "application/json" } });
  const text = await res.text();
  let body: any = text;
  try { body = JSON.parse(text); } catch { /**/ }
  if (!res.ok) throw new Error(`Strowallet ${res.status}: ${typeof body === "string" ? body.slice(0, 400) : JSON.stringify(body).slice(0, 600)}`);
  if (typeof body === "string" && body.includes("<html")) {
    throw new Error(`Strowallet a renvoyé une page HTML pour ${path}`);
  }
  const nestedStatusCode = Number(body?.statusCode ?? body?.data?.statusCode ?? body?.response?.statusCode ?? 0);
  if (Number.isFinite(nestedStatusCode) && nestedStatusCode >= 400) {
    const msg = body?.message ?? body?.data?.message ?? body?.error ?? body?.data?.error ?? JSON.stringify(body);
    throw new Error(`Strowallet: ${typeof msg === "string" ? msg : JSON.stringify(msg)}`);
  }
  if (body && typeof body === "object" && body.success === false) {
    const msg = body.message || body.error || JSON.stringify(body);
    throw new Error(`Strowallet: ${typeof msg === "string" ? msg : JSON.stringify(msg)}`);
  }
  return body;
}

export type NfcCardInput = {
  firstName: string; lastName: string; dob: string; // mm/dd/yyyy or yyyy-mm-dd
  idType: "national_id" | "passport" | "drivers_license" | string;
  idNumber: string; email: string;
  line1: string; city: string; state: string; postalCode: string; country: string; // 3-letter
  amountUsd: number; phone: string;
  nameOnCard?: string;
};

function toMDY(dob: string): string {
  // Accept yyyy-mm-dd or mm/dd/yyyy
  if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    const [y, m, d] = dob.split("-");
    return `${m}/${d}/${y}`;
  }
  return dob;
}

export async function createNfcCard(p: NfcCardInput) {
  return call("POST", "/bitvcard/create-nfc-card/", {
    name: p.nameOnCard || `${p.firstName} ${p.lastName}`.trim(),
    first_name: p.firstName,
    last_name: p.lastName,
    dob: toMDY(p.dob),
    id_type: p.idType,
    id_number: p.idNumber,
    email: p.email,
    line1: p.line1,
    city: p.city,
    state: p.state,
    postal_code: p.postalCode,
    country: p.country,
    amount_usd: String(p.amountUsd),
    phone: p.phone,
  });
}

export async function getNfcCardDetails(card_id: string) {
  return call("GET", "/bitvcard/fetch-nfccard-detail/", { card_id });
}

export async function getNfcCardHistory(card_id: string) {
  const paths = [
    "/bitvcard/nfc-card-transactions/",
    "/bitvcard/card-transactions/",
    "/bitvcard/nfc-card-transaction/",
  ];
  let lastErr: unknown = null;
  for (const p of paths) {
    try {
      const res = await call("GET", p, { card_id });
      const items = extractCardTransactions(res);
      if (items.length > 0) return res;
      // Réponse exploitable mais vide : on la garde en réserve si aucun autre chemin ne fait mieux.
      lastErr = lastErr ?? res;
    } catch (e) {
      lastErr = e;
    }
  }
  if (lastErr instanceof Error) throw lastErr;
  return lastErr ?? { response: [] };
}

// Normalise la réponse (quelle que soit sa forme) en tableau homogène
// [{id,date,amount,currency,status,description,type}] pour l'affichage et la persistance.
export function extractCardTransactions(resp: any): Array<{
  id: string | null; date: string | null; amount: number; currency: string;
  status: string; description: string; type: string | null;
}> {
  const raw: any = resp?.response ?? resp?.data ?? resp;
  let list: any[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (Array.isArray(raw?.response)) list = raw.response;
  else if (Array.isArray(raw?.data)) list = raw.data;
  else if (Array.isArray(raw?.transactions)) list = raw.transactions;
  else if (Array.isArray(resp?.transactions)) list = resp.transactions;
  else if (Array.isArray(resp)) list = resp;

  return list.map((t: any) => {
    const statusRaw = String(t.status || t.transaction_status || "success").toLowerCase();
    return {
      id: t.id ? String(t.id) : (t.transaction_id ? String(t.transaction_id) : (t.reference ? String(t.reference) : null)),
      date: t.date || t.created_at || t.createdAt || t.transaction_date || null,
      amount: Number(t.amount || 0),
      currency: String(t.currency || "USD"),
      status: statusRaw.includes("fail") ? "failed" : statusRaw.includes("pending") ? "pending" : "success",
      description: t.description || t.narration || t.type || t.transaction_type || "Transaction carte",
      type: t.type || t.transaction_type || null,
    };
  });
}

export async function fundWithdrawNfcCard(p: { card_id: string; amount: number; type: "fund" | "withdraw" }) {
  return call("POST", "/bitvcard/fund-withdraw-nfccard/", { card_id: p.card_id, amount: String(p.amount), type: p.type });
}

export async function nfcCardStatus(card_id: string, status: "active" | "frozen") {
  return call("POST", "/bitvcard/nfc-cards/status", { card_id, status });
}

export async function nfcCardAction(card_id: string, action: "freeze" | "unfreeze") {
  return call("POST", "/bitvcard/action/status/", { card_id, action });
}

export async function freezeNfcCard(card_id: string) {
  try {
    return await nfcCardStatus(card_id, "frozen");
  } catch {
    return await nfcCardAction(card_id, "freeze");
  }
}

export async function unfreezeNfcCard(card_id: string) {
  try {
    return await nfcCardStatus(card_id, "active");
  } catch {
    return await nfcCardAction(card_id, "unfreeze");
  }
}

export async function ensureNfcCardActive(card_id: string) {
  const attempts: any[] = [];
  try {
    attempts.push({ step: "status", response: await nfcCardStatus(card_id, "active") });
  } catch (e) {
    attempts.push({ step: "status", error: (e as Error).message });
  }
  try {
    attempts.push({ step: "action", response: await nfcCardAction(card_id, "unfreeze") });
  } catch (e) {
    attempts.push({ step: "action", error: (e as Error).message });
  }

  const details = await getNfcCardDetails(card_id);
  const parsed = extractCardDetails(details);
  const status = String(parsed.status || "").toLowerCase();
  // On ne lève une erreur QUE si la carte est explicitement gelée par l'émetteur.
  // Les statuts "pending" / "processing" / "failed" / "review" sont des états transitoires
  // de provisionnement : on retourne les détails partiels et on laisse l'UI/refresh re-essayer.
  if (status === "frozen") {
    const err: any = new Error(`La carte est toujours gelée chez l'émetteur`);
    err.details = { attempts, details };
    throw err;
  }
  return { attempts, details };
}

export async function getStrowalletBalance(currency: "USD" | "NGN" = "USD") {
  return call("GET", `/check-balance/${currency}/`, {}).catch(() => call("GET", `/wallet/balance/${currency}/`, {}));
}

function cardNode(resp: any) {
  return resp?.response?.card_detail
    || resp?.data?.card_detail
    || resp?.card_detail
    || resp?.response
    || resp?.data
    || resp
    || {};
}

export function extractNfcCard(resp: any): { card_id: string | null; last4: string | null; brand: string | null } {
  const r = cardNode(resp);
  const card_id = r.card_id || r.cardId || r.id || resp?.card_id || null;
  const rawLast4 = r.last4 || r.lastFour || r.last_four || (r.card_number ? String(r.card_number).slice(-4) : null);
  const last4 = rawLast4 && /^\d{4}$/.test(String(rawLast4)) ? String(rawLast4) : null;
  const brand = r.cardBrand || r.brand || r.card_brand || null;
  return { card_id: card_id ? String(card_id) : null, last4, brand: brand ? String(brand) : null };
}

export function extractCardDetails(resp: any): { number: string | null; cvv: string | null; expiry: string | null; holder: string | null; status: string | null; balance: number | null; last4: string | null; brand: string | null } {
  const r = cardNode(resp);
  const number = r.card_number || r.cardNumber || r.pan || null;
  const cvv = r.cvv || r.cvv2 || r.card_cvv || null;
  const exp = r.expiry || r.expiry_date || r.expiration || (r.expiry_month && r.expiry_year ? `${String(r.expiry_month).padStart(2, "0")}/${String(r.expiry_year).slice(-2)}` : null);
  const holder = r.name_on_card || r.card_holder_name || r.holder || r.card_holder || r.card_name || r.name || null;
  const status = (r.card_status || r.status || null) as string | null;
  const bal = r.balance ?? r.card_balance ?? null;
  const rawLast4 = r.last4 || r.lastFour || r.last_four || (number ? String(number).slice(-4) : null);
  const last4 = rawLast4 && /^\d{4}$/.test(String(rawLast4)) ? String(rawLast4) : null;
  const brand = r.cardBrand || r.brand || r.card_brand || null;
  return {
    number: number ? String(number) : null,
    cvv: cvv ? String(cvv) : null,
    expiry: exp ? String(exp) : null,
    holder: holder ? String(holder) : null,
    status: status ? String(status) : null,
    balance: bal !== null && Number.isFinite(Number(bal)) ? Number(bal) : null,
    last4,
    brand: brand ? String(brand) : null,
  };
}

export async function strowalletDiagnostic() {
  const publicKey = Deno.env.get("STROWALLET_PUBLIC_KEY") || "";
  const attempts: any[] = [];
  try {
    const b = await getStrowalletBalance("USD");
    attempts.push({ check: "balance USD", ok: true, body: b });
  } catch (e) {
    attempts.push({ check: "balance USD", ok: false, error: (e as Error).message });
  }
  return { base: base(), mode: MODE, publicKeyPresent: !!publicKey, attempts };
}