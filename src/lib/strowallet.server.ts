const BASE = process.env.STROWALLET_BASE_URL || "https://strowallet.com/api";

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

// Strowallet bitvcard endpoints use GET with query-string parameters.
async function callGet(path: string, params: Record<string, string | number | undefined>): Promise<any> {
  const qs = buildQuery({ public_key: pub(), ...params });
  const url = `${BASE.replace(/\/$/, "")}${path}${path.includes("?") ? "&" : "?"}${qs}`;
  const res = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
  const text = await res.text();
  let body: any = text;
  try { body = JSON.parse(text); } catch { /* keep text */ }
  if (!res.ok) throw new Error(`Strowallet ${res.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  return body;
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
  return callGet(`/bitvcard/create-user/`, {
    firstName: payload.firstName,
    lastName: payload.lastName,
    customerEmail: payload.email,
    phoneNumber: payload.phone,
    dateOfBirth: payload.dob,
    idType: payload.idType,
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
  return callGet(`/bitvcard/create-card/`, {
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
  return callGet(path, { card_id });
}