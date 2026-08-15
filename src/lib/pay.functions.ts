// Public client for the `pay` edge function (no auth).
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const ENDPOINT = `${SUPABASE_URL}/functions/v1/pay`;

async function call(action: string, payload: Record<string, any> = {}) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    body: JSON.stringify({ action, ...payload }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j?.error) throw new Error(j?.error || `HTTP ${res.status}`);
  return j;
}

export const getPublicLink = (slug: string) => call("getLink", { slug });
export const initCheckout = (data: {
  slug: string; amount?: number; customer_name?: string; customer_phone?: string; customer_email?: string; returnUrl?: string;
}) => call("initCheckout", data);
export const verifyPayment = (reference: string) => call("verifyPayment", { reference });

// --- Shop (vitrine publique) ---
export const getShop = (slug: string) => call("getShop", { slug });
export const getVitrine = (projectId: string) => call("getVitrine", { project_id: projectId });
export const initShopCheckout = (data: {
  business_slug: string;
  items: Array<{ product_id: string; quantity: number }>;
  customer_email: string;
  customer_name?: string; customer_phone?: string;
  shipping_address?: string; customer_note?: string;
  returnUrl?: string;
}) => call("initShopCheckout", data);
export const getOrder = (token: string) => call("getOrder", { token });
// --- Paiement Mobile Money intégré (aucune redirection) ---
export type MomoOperator = { code: string; label: string; flow: "otp" | "push" };
export type PayStatus = "pending" | "success" | "failed";

export const listOperators = () => call("listOperators") as Promise<{ ok: boolean; operators: MomoOperator[] }>;
export const getCheckout = (reference: string) => call("getCheckout", { reference });
export const payDirect = (data: { reference: string; operator: string; phone: string }) =>
  call("payDirect", data) as Promise<{ ok: boolean; requiresOtp?: boolean; status: PayStatus; message?: string }>;
export const confirmDirect = (data: { reference: string; otp: string }) =>
  call("confirmDirect", data) as Promise<{ ok: boolean; status: PayStatus }>;

export const FALLBACK_MOMO_OPERATORS: MomoOperator[] = [
  { code: "ORANGE_MONEY_BF", label: "Orange Money", flow: "otp" },
  { code: "MOOV_MONEY_BF", label: "Moov Money", flow: "push" },
  { code: "TELECEL_BF", label: "Telecel Money", flow: "push" },
  { code: "SANK_MONEY", label: "Sank Money", flow: "push" },
  { code: "CORIS_MONEY", label: "Coris Money", flow: "push" },
];
