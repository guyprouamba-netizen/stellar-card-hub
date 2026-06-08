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
  return call("GET", "/bitvcard/nfc-card-transactions/", { card_id });
}

export async function fundWithdrawNfcCard(p: { card_id: string; amount: number; type: "fund" | "withdraw" }) {
  return call("POST", "/bitvcard/fund-withdraw-nfccard/", { card_id: p.card_id, amount: String(p.amount), type: p.type });
}

export async function nfcCardStatus(card_id: string, status: "active" | "frozen") {
  return call("POST", "/bitvcard/nfc-cards/status", { card_id, status });
}

export async function getStrowalletBalance(currency: "USD" | "NGN" = "USD") {
  return call("GET", `/check-balance/${currency}/`, {}).catch(() => call("GET", `/wallet/balance/${currency}/`, {}));
}

export function extractNfcCard(resp: any): { card_id: string | null; last4: string | null; brand: string | null } {
  const r = resp?.response ?? resp?.data ?? resp ?? {};
  const card_id = r.card_id || r.cardId || r.id || resp?.card_id || null;
  const last4 = r.last4 || r.lastFour || r.last_four || (r.card_number ? String(r.card_number).slice(-4) : null);
  const brand = r.cardBrand || r.brand || r.card_brand || null;
  return { card_id: card_id ? String(card_id) : null, last4: last4 ? String(last4) : null, brand: brand ? String(brand) : null };
}

export function extractCardDetails(resp: any): { number: string | null; cvv: string | null; expiry: string | null; holder: string | null; status: string | null; balance: number | null; last4: string | null; brand: string | null } {
  const r = resp?.response ?? resp?.data ?? resp ?? {};
  const number = r.card_number || r.cardNumber || r.pan || null;
  const cvv = r.cvv || r.cvv2 || r.card_cvv || null;
  const exp = r.expiry || r.expiry_date || r.expiration || (r.expiry_month && r.expiry_year ? `${String(r.expiry_month).padStart(2, "0")}/${String(r.expiry_year).slice(-2)}` : null);
  const holder = r.name_on_card || r.holder || r.card_holder || r.name || null;
  const status = (r.card_status || r.status || null) as string | null;
  const bal = r.balance ?? r.card_balance ?? null;
  const last4 = r.last4 || r.lastFour || r.last_four || (number ? String(number).slice(-4) : null);
  const brand = r.cardBrand || r.brand || r.card_brand || null;
  return {
    number: number ? String(number) : null,
    cvv: cvv ? String(cvv) : null,
    expiry: exp ? String(exp) : null,
    holder: holder ? String(holder) : null,
    status: status ? String(status) : null,
    balance: bal !== null && Number.isFinite(Number(bal)) ? Number(bal) : null,
    last4: last4 ? String(last4) : null,
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