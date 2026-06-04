// Lightweight API client for the existing Laravel backend (Strowallet + YengaPay)
// Configure with VITE_API_BASE_URL (e.g. https://api.tondomaine.com/api)

const BASE = (import.meta as any).env?.VITE_API_BASE_URL ?? "/api";
const TOKEN_KEY = "volty_token";

export const auth = {
  get token() {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
  },
  set(token: string) {
    if (typeof window !== "undefined") localStorage.setItem(TOKEN_KEY, token);
  },
  clear() {
    if (typeof window !== "undefined") localStorage.removeItem(TOKEN_KEY);
  },
};

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const token = auth.token;
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : await res.text();
  if (!res.ok) {
    const msg = (body && typeof body === "object" && "message" in body && (body as { message?: string }).message) || res.statusText;
    throw new ApiError(String(msg), res.status, body);
  }
  return body as T;
}

export const api = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, data?: unknown) =>
    request<T>(p, { method: "POST", body: data instanceof FormData ? data : JSON.stringify(data ?? {}) }),
  put: <T>(p: string, data?: unknown) =>
    request<T>(p, { method: "PUT", body: JSON.stringify(data ?? {}) }),
  del: <T>(p: string) => request<T>(p, { method: "DELETE" }),
};

// ===== Endpoints (mirroring the existing Laravel routes) =====

export type Wallet = {
  balance: number;
  currency: string;
  symbol?: string;
};

export type Transaction = {
  id: string | number;
  type: string;
  amount: number;
  currency: string;
  status: "success" | "pending" | "failed" | string;
  description?: string;
  created_at: string;
};

export const walletApi = {
  balance: () => api.get<{ data: { wallets: Wallet[] } }>("/user/wallet/balance"),
  transactions: (limit = 20) =>
    api.get<{ data: { transactions: Transaction[] } }>(`/user/transactions?limit=${limit}`),
  rechargeYengapay: (amount: number, currency = "XOF") =>
    api.post<{ data: { checkout_url: string; reference: string } }>("/user/add-money/yengapay", {
      amount,
      currency,
    }),
  canAffordCard: (amount: number, currency = "USD") =>
    api.get<{ data: { can_afford: boolean; required: number; available: number } }>(
      `/user/wallet/can-afford-card?amount=${amount}&currency=${currency}`
    ),
};

export const kycApi = {
  status: () => api.get<{ data: { status: string; provider_status?: string } }>("/user/kyc/status"),
  sync: () => api.post<{ data: { status: string } }>("/user/kyc/sync"),
  submit: (form: FormData) => api.post<{ data: { status: string } }>("/user/strowallet/create-customer", form),
};

export const cardApi = {
  list: () => api.get<{ data: { cards: Array<Record<string, unknown>> } }>("/user/strowallet/cards"),
  details: (id: string) =>
    api.get<{ data: Record<string, unknown> }>(`/user/strowallet/card-details/${id}`),
  buy: (payload: { amount: number; currency: string; brand?: string }) =>
    api.post<{ data: Record<string, unknown> }>("/user/strowallet/card-buy", payload),
  freeze: (id: string) => api.post(`/user/strowallet/card/${id}/freeze`),
  unfreeze: (id: string) => api.post(`/user/strowallet/card/${id}/unfreeze`),
  remove: (id: string) => api.del(`/user/strowallet/card/${id}`),
};

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ data: { token: string; user: Record<string, unknown> } }>("/user/auth/login", {
      email,
      password,
    }),
  register: (payload: Record<string, unknown>) =>
    api.post<{ data: { token: string } }>("/user/auth/register", payload),
  me: () => api.get<{ data: { user: Record<string, unknown> } }>("/user/me"),
  logout: () => api.post("/user/auth/logout"),
};