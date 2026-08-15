// Client YengaPay Direct Payment (paiement 100% in-app, sans redirection).
// Doc SDK officiel : POST /groups/{groupId}/direct-payment/init/{projectId}
//                    POST /groups/{groupId}/direct-payment/send-otp/{projectId}
//                    POST /groups/{groupId}/direct-payment/pay/{projectId}
const YENGAPAY_BASE = "https://api.yengapay.com/api/v1";

export type OperatorFlow = "otp" | "push";
export type Operator = {
  code: string; label: string; flow: OperatorFlow; prefixes: string[];
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
    code: "ORANGE_MONEY_BF", label: "Orange Money", flow: "otp", prefixes: ["07", "05"],
    ussdPrefix: "*144*4*6*", otpBySms: false,
    hint: "Composez le code USSD affiché pour générer votre code de paiement Orange Money, puis saisissez-le ci-dessous.",
  },
  {
    code: "MOOV_MONEY_BF", label: "Moov Money", flow: "push", prefixes: ["06", "01"],
    hint: "Validez la demande de paiement qui s'affiche sur votre téléphone (ou composez *555#).",
  },
  {
    code: "TELECEL_BF", label: "Telecel Money", flow: "push", prefixes: ["05"],
    hint: "Validez la demande de paiement reçue sur votre téléphone.",
  },
  {
    code: "SANK_MONEY", label: "Sank Money", flow: "push", prefixes: [],
    hint: "Ouvrez l'application Sank Money et validez la demande de paiement.",
  },
  {
    code: "CORIS_MONEY", label: "Coris Money", flow: "push", prefixes: [],
    hint: "Validez la demande de paiement dans Coris Money.",
  },
];

/** Code USSD complet à composer pour un montant donné (Orange Money). */
export function ussdCodeFor(op: Operator, amount: number): string | null {
  if (!op.ussdPrefix) return null;
  return `${op.ussdPrefix}${Math.round(Number(amount))}#`;
}

export function findOperator(code: string): Operator | undefined {
  return OPERATORS.find((o) => o.code === String(code || "").toUpperCase());
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
  amount: number; reference: string; callbackUrl: string; description?: string;
}) {
  const { apiKey, groupId, projectId } = creds();
  const paths = [
    `/groups/${groupId}/direct-payment/init/${projectId}`,
    `/groups/${groupId}/direct-payment/init`,
    `/groups/${groupId}/payment-intent/${projectId}`,
  ];
  const body = {
    paymentAmount: Number(opts.amount),
    reference: opts.reference,
    callbackUrl: opts.callbackUrl,
    articles: [{ title: "Recharge FASO-INVEST PAY", description: opts.description || "Recharge portefeuille", pictures: [], price: Number(opts.amount) }],
  };
  const r = await fetchWithFallback(paths, apiKey, body);
  return r;
}

export async function sendDirectPaymentOtp(opts: { reference: string; phone: string; operator: string; paymentIntentId?: string }) {
  const { apiKey, groupId, projectId } = creds();
  const paths = [
    `/groups/${groupId}/direct-payment/send-otp/${projectId}`,
    `/groups/${groupId}/direct-payment/send-otp`,
  ];
  const body: any = {
    reference: opts.reference,
    phoneNumber: opts.phone,
    operator: opts.operator,
  };
  if (opts.paymentIntentId) body.paymentIntentId = opts.paymentIntentId;
  return await fetchWithFallback(paths, apiKey, body);
}

export async function payDirectPayment(opts: { reference: string; phone: string; operator: string; otp?: string; paymentIntentId?: string }) {
  const { apiKey, groupId, projectId } = creds();
  const paths = [
    `/groups/${groupId}/direct-payment/pay/${projectId}`,
    `/groups/${groupId}/direct-payment/pay`,
  ];
  const body: any = {
    reference: opts.reference,
    phoneNumber: opts.phone,
    operator: opts.operator,
  };
  if (opts.otp) body.otp = opts.otp;
  if (opts.paymentIntentId) body.paymentIntentId = opts.paymentIntentId;
  return await fetchWithFallback(paths, apiKey, body);
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
