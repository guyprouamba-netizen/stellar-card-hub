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
export const initShopCheckout = (data: {
  business_slug: string;
  items: Array<{ product_id: string; quantity: number }>;
  customer_email: string;
  customer_name?: string; customer_phone?: string;
  shipping_address?: string; customer_note?: string;
  returnUrl?: string;
}) => call("initShopCheckout", data);
export const getOrder = (token: string) => call("getOrder", { token });