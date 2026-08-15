// Client Direct Payment (paiement 100% in-app, sans redirection).
// Contrat officiel :
//   POST /groups/{groupId}/projects/{projectId}/direct-payment/init
//        body { amount, reference, articles[], customerEmailToNotify? }
//   POST /groups/{groupId}/projects/{projectId}/direct-payment/send-otp   (MOOV/CORISM/SANKM)
//        body { paymentIntentId, operatorCode, countryCode, customerMSISDN }
//   POST /groups/{groupId}/projects/{projectId}/direct-payment/pay
//        body { paymentIntentId, operatorCode, countryCode, customerMSISDN, otp? }
//   GET  /groups/{groupId}/projects/{projectId}/direct-payment/status/{paymentIntentId}
const YENGAPAY_BASE = "https://api.yengapay.com/api/v1";

export type OperatorFlow = "otp" | "push";
export type Operator = {
  code: string; label: string; flow: OperatorFlow; prefixes: string[];
  /** Code opérateur attendu par la passerelle. */
  ypCode: string;
  countryCode: string;
  /** Anciens codes conservés pour les paiements déjà enregistrés. */
  aliases?: string[];
  /** Code USSD que le client compose lui-même pour générer son code de paiement (Orange). */
  ussdPrefix?: string;
  /** Instruction affichée au client. */
  hint?: string;
  /** true = l'opérateur envoie l'OTP par SMS (send-otp API), false = le client le génère via USSD. */
  otpBySms?: boolean;
};

// Opérateurs supportés (Burkina Faso).
export const OPERATORS: Operator[] = [
  {
    code: "ORANGE_MONEY_BF", ypCode: "ORANGE", countryCode: "BF", aliases: ["ORANGE", "ORANGE_BF"],
    label: "Orange Money", flow: "otp", prefixes: ["07", "05"],
    ussdPrefix: "*144*4*6*", otpBySms: false,
    hint: "Composez le code USSD affiché pour générer votre code de paiement Orange Money, puis saisissez-le ci-dessous.",
  },
  {
    code: "MOOV_MONEY_BF", ypCode: "MOOV", countryCode: "BF", aliases: ["MOOV", "MOOV_BF"],
    label: "Moov Money", flow: "push", prefixes: ["06", "01"],
    hint: "Validez la demande de paiement qui s'affiche sur votre téléphone.",
  },
  {
    code: "TELECEL_BF", ypCode: "TELECEL", countryCode: "BF", aliases: ["TELECEL"],
    label: "Telecel Money", flow: "otp", prefixes: ["05"], otpBySms: false,
    hint: "Générez votre code de paiement Telecel Money depuis le menu USSD de votre téléphone, puis saisissez-le ci-dessous.",
  },
  {
    code: "SANK_MONEY", ypCode: "SANKM", countryCode: "BF", aliases: ["SANKM", "SANKM_BF"],
    label: "Sank Money", flow: "otp", prefixes: [], otpBySms: true,
    hint: "Un code de confirmation Sank Money vous est envoyé par SMS.",
  },
  {
    code: "CORIS_MONEY", ypCode: "CORISM", countryCode: "BF", aliases: ["CORISM", "CORISM_BF"],
    label: "Coris Money", flow: "otp", prefixes: [], otpBySms: true,
    hint: "Un code de confirmation Coris Money vous est envoyé par SMS.",
  },
];

/** Code USSD complet à composer pour un montant donné (Orange Money). */
export function ussdCodeFor(op: Operator, amount: number): string | null {
  if (!op.ussdPrefix) return null;
  return `${op.ussdPrefix}${Math.round(Number(amount))}#`;
}

export function findOperator(code: string): Operator | undefined {
  const c = String(code || "").toUpperCase();
  return OPERATORS.find((o) => o.code === c || o.ypCode === c || (o.aliases || []).includes(c));
}

/** Normalise un numéro burkinabè au format MSISDN attendu (226XXXXXXXX). */
export function toMsisdn(phone: string, countryCode = "BF"): string {
  let d = String(phone || "").replace(/\D/g, "");
  d = d.replace(/^0+/, "");
  if (countryCode === "BF" && d.length === 8) d = `226${d}`;
  return d;
}

function creds() {
  const apiKey = Deno.env.get("YENGAPAY_API_KEY");
  const groupId = Deno.env.get("YENGAPAY_GROUP_ID");
  const projectId = Deno.env.get("YENGAPAY_PROJECT_ID");
  if (!apiKey || !groupId || !projectId) throw new Error("Configuration de la passerelle de paiement manquante");
  return { apiKey, groupId, projectId };
}

function headers(apiKey: string) {
  return { "Content-Type": "application/json", "x-api-key": apiKey };
}

async function doFetch(url: string, apiKey: string, body?: any) {
  const res = await fetch(url, {
    method: "POST",
    headers: headers(apiKey),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed: any = text;
  try { parsed = JSON.parse(text); } catch { /* keep raw text */ }
  return { ok: res.ok, status: res.status, body: parsed };
}

// Tente plusieurs variantes de chemin tolérant les évolutions d'API (404 -> fallback).
async function fetchWithFallback(paths: string[], apiKey: string, body?: any) {
  let last: { ok: boolean; status: number; body: any } | null = null;
  for (const p of paths) {
    const r = await doFetch(`${YENGAPAY_BASE}${p}`, apiKey, body);
    last = r;
    if (r.ok) return r;
    if (r.status !== 404) return r; // erreur non liée au chemin : on s'arrête là
  }
  return last!;
}

export type InitDepositResult = { ok: boolean; reference: string; raw: any; status?: string };

export async function initDirectPayment(opts: {
  amount: number; reference: string; callbackUrl?: string; description?: string; customerEmail?: string;
}) {
  const { apiKey, groupId, projectId } = creds();
  const amount = Math.round(Number(opts.amount));
  const body: any = {
    amount,
    reference: opts.reference,
    articles: [{ title: opts.description || "Paiement", description: opts.description || "Paiement", price: amount }],
  };
  if (opts.customerEmail) body.customerEmailToNotify = opts.customerEmail;
  return await fetchWithFallback([
    `/groups/${groupId}/projects/${projectId}/direct-payment/init`,
    `/groups/${groupId}/direct-payment/init/${projectId}`,
  ], apiKey, body);
}

/** paymentIntentId renvoyé par /init (tolère les variantes de nommage). */
export function extractIntentId(body: any): string | null {
  return body?.paymentIntentId || body?.id || body?.paymentIntent?.id || body?.data?.paymentIntentId || body?.data?.id || null;
}

/** Opérateurs réellement disponibles + frais renvoyés par /init. */
export function extractAvailableOperators(body: any): any[] {
  const list = body?.availableOperators || body?.operators || body?.data?.availableOperators;
  return Array.isArray(list) ? list : [];
}

export async function sendDirectPaymentOtp(opts: { reference?: string; phone: string; operator: string; paymentIntentId?: string }) {
  const { apiKey, groupId, projectId } = creds();
  const op = findOperator(opts.operator);
  const body: any = {
    paymentIntentId: opts.paymentIntentId,
    operatorCode: op?.ypCode || String(opts.operator || "").toUpperCase(),
    countryCode: op?.countryCode || "BF",
    customerMSISDN: toMsisdn(opts.phone, op?.countryCode || "BF"),
  };
  return await fetchWithFallback([
    `/groups/${groupId}/projects/${projectId}/direct-payment/send-otp`,
    `/groups/${groupId}/direct-payment/send-otp/${projectId}`,
  ], apiKey, body);
}

export async function payDirectPayment(opts: { reference?: string; phone: string; operator: string; otp?: string; paymentIntentId?: string }) {
  const { apiKey, groupId, projectId } = creds();
  const op = findOperator(opts.operator);
  const body: any = {
    paymentIntentId: opts.paymentIntentId,
    operatorCode: op?.ypCode || String(opts.operator || "").toUpperCase(),
    countryCode: op?.countryCode || "BF",
    customerMSISDN: toMsisdn(opts.phone, op?.countryCode || "BF"),
  };
  if (opts.otp) body.otp = String(opts.otp);
  return await fetchWithFallback([
    `/groups/${groupId}/projects/${projectId}/direct-payment/pay`,
    `/groups/${groupId}/direct-payment/pay/${projectId}`,
  ], apiKey, body);
}

export async function checkDirectPaymentStatus(paymentIntentId: string) {
  const { apiKey, groupId, projectId } = creds();
  const url = `${YENGAPAY_BASE}/groups/${groupId}/projects/${projectId}/direct-payment/status/${paymentIntentId}`;
  const res = await fetch(url, { headers: { "x-api-key": apiKey, Accept: "application/json" } });
  const text = await res.text();
  let body: any = text;
  try { body = JSON.parse(text); } catch { /* keep raw */ }
  return { ok: res.ok, status: res.status, body };
}

export function extractProviderStatus(body: any): "success" | "failed" | "pending" {
  const st = String(body?.status || body?.paymentStatus || body?.data?.status || "").toUpperCase();
  if (["DONE", "SUCCESS", "SUCCEEDED", "COMPLETED", "PAID"].includes(st)) return "success";
  if (["FAILED", "CANCELLED", "CANCELED", "EXPIRED", "REJECTED"].includes(st)) return "failed";
  return "pending";
}

// Crédite le wallet XOF de l'utilisateur de manière idempotente pour une transaction "deposit"
// identifiée par sa référence (provider_ref). Ne crédite qu'une seule fois même appelée en concurrence
// (webhook + polling client), grâce à la mise à jour conditionnelle status=pending -> success.
export async function creditDeposit(
  admin: any,
  userId: string,
  reference: string,
  amount: number,
  meta: Record<string, unknown> = {},
): Promise<{ credited: boolean }> {
  const { data: tx } = await admin
    .from("transactions")
    .select("id,user_id,amount,status,metadata")
    .eq("provider_ref", reference)
    .eq("type", "deposit")
    .maybeSingle();
  if (!tx) return { credited: false };
  if (tx.status === "success") return { credited: false };
  const { data: updated } = await admin
    .from("transactions")
    .update({ status: "success", metadata: { ...(tx.metadata as any), ...meta } })
    .eq("id", tx.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (!updated) return { credited: false };
  const creditAmount = Number(amount ?? tx.amount);
  const { data: w } = await admin.from("wallets").select("id,balance").eq("user_id", tx.user_id).eq("currency", "XOF").maybeSingle();
  if (w) {
    await admin.from("wallets").update({ balance: Number(w.balance) + creditAmount }).eq("id", w.id);
  }
  return { credited: true };
}
