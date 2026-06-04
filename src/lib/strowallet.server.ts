const BASE = process.env.STROWALLET_BASE_URL || "https://strowallet.com/api";

function pub() {
  const key = process.env.STROWALLET_PUBLIC_KEY;
  if (!key) throw new Error("STROWALLET_PUBLIC_KEY missing");
  return key;
}

async function call(path: string, init: RequestInit = {}): Promise<any> {
  const url = `${BASE.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body: any = text;
  try { body = JSON.parse(text); } catch { /* keep text */ }
  if (!res.ok) throw new Error(`Strowallet ${res.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  return body;
}

export async function getStrowalletBalance() {
  // Strowallet exposes account info via /bitvcard/balance endpoint
  return call(`/bitvcard/balance?public_key=${encodeURIComponent(pub())}`);
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
  return call(`/bitvcard/create-user/`, {
    method: "POST",
    body: JSON.stringify({
      public_key: pub(),
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
    }),
  });
}

export async function createStrowalletCard(payload: {
  customerEmail: string;
  amount: number;
  brand?: "Visa" | "MasterCard";
}) {
  return call(`/bitvcard/create-card/`, {
    method: "POST",
    body: JSON.stringify({
      public_key: pub(),
      name_on_card: payload.customerEmail,
      card_type: "virtual",
      amount: payload.amount,
      customerEmail: payload.customerEmail,
      mode: "sandbox",
    }),
  });
}

export async function getStrowalletCardDetails(card_id: string) {
  return call(`/bitvcard/fetch-card-detail/`, {
    method: "POST",
    body: JSON.stringify({ public_key: pub(), card_id }),
  });
}

export async function strowalletCardAction(action: "freeze" | "unfreeze" | "terminate", card_id: string) {
  const path = action === "freeze" ? "/bitvcard/freeze-card/" : action === "unfreeze" ? "/bitvcard/unfreeze-card/" : "/bitvcard/terminate-card/";
  return call(path, { method: "POST", body: JSON.stringify({ public_key: pub(), card_id }) });
}