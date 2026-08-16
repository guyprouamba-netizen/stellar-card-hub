/**
 * Paydunya integration helper (West Africa).
 * Supported: Checkout (Invoice) and Disbursement (Withdrawals).
 */

export interface PaydunyaConfig {
  masterKey: string;
  publicKey: string;
  privateKey: string;
  token: string;
  mode: "test" | "live";
}

export function getPaydunyaConfig(): PaydunyaConfig {
  const masterKey = Deno.env.get("PAYDUNYA_MASTER_KEY");
  const publicKey = Deno.env.get("PAYDUNYA_PUBLIC_KEY");
  const privateKey = Deno.env.get("PAYDUNYA_PRIVATE_KEY");
  const token = Deno.env.get("PAYDUNYA_TOKEN");
  const mode = (Deno.env.get("PAYDUNYA_MODE") || "test") as "test" | "live";

  if (!masterKey || !publicKey || !privateKey || !token) {
    throw new Error("Paydunya credentials missing in environment variables.");
  }

  return { masterKey, publicKey, privateKey, token, mode };
}

const BASE_URL = "https://app.paydunya.com/api/v1";

export async function createInvoice(data: {
  amount: number;
  description: string;
  callback_url: string;
  return_url: string;
  cancel_url: string;
  customer?: {
    name?: string;
    phone?: string;
    email?: string;
  };
}) {
  const cfg = getPaydunyaConfig();
  const headers = {
    "Content-Type": "application/json",
    "PAYDUNYA-MASTER-KEY": cfg.masterKey,
    "PAYDUNYA-PRIVATE-KEY": cfg.privateKey,
    "PAYDUNYA-TOKEN": cfg.token,
  };

  const body = {
    invoice: {
      total_amount: data.amount,
      description: data.description,
    },
    store: {
      name: "FASO-INVEST PAY",
    },
    actions: {
      cancel_url: data.cancel_url,
      return_url: data.return_url,
      callback_url: data.callback_url,
    },
    custom_data: {
      customer_name: data.customer?.name || "Client",
    }
  };

  const res = await fetch(`${BASE_URL}/checkout-invoice/create`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const resData = await res.json();
  if (resData.response_code !== "00") {
    throw new Error(resData.response_text || "Failed to create Paydunya invoice");
  }

  return resData;
}

export async function verifyInvoice(token: string) {
  const cfg = getPaydunyaConfig();
  const headers = {
    "PAYDUNYA-MASTER-KEY": cfg.masterKey,
    "PAYDUNYA-PRIVATE-KEY": cfg.privateKey,
    "PAYDUNYA-TOKEN": cfg.token,
  };

  const res = await fetch(`${BASE_URL}/checkout-invoice/confirm/${token}`, {
    method: "GET",
    headers,
  });

  return await res.json();
}

/**
 * Disbursement (Payout)
 * 1. create-invoice
 * 2. submit-invoice
 */
export async function createDisbursement(data: {
  amount: number;
  recipient_phone: string;
  recipient_name: string;
  account_alias: string; // Phone number or account identifier
  disburse_channel: "orange-money-bf" | "moov-money-bf" | "telecel-cash-bf" | "wave-bf";
}) {
  const cfg = getPaydunyaConfig();
  const headers = {
    "Content-Type": "application/json",
    "PAYDUNYA-MASTER-KEY": cfg.masterKey,
    "PAYDUNYA-PRIVATE-KEY": cfg.privateKey,
    "PAYDUNYA-TOKEN": cfg.token,
  };

  // Channel mapping for Paydunya (example)
  // Paydunya uses specific aliases for channels.
  // Common for BF: 'orange-money-bf', 'moov-money-bf'

  const body = {
    disbursement: {
      amount: data.amount,
      disburse_channel: data.disburse_channel,
      account_alias: data.account_alias,
      description: `Retrait FASO-PAY pour ${data.recipient_name}`,
    }
  };

  const res = await fetch(`${BASE_URL}/disbursement/create-invoice`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const resData = await res.json();
  if (resData.response_code !== "00") {
    throw new Error(resData.response_text || "Failed to create Paydunya disbursement invoice");
  }

  // Then submit
  const submitBody = { disburse_token: resData.disburse_token };
  const submitRes = await fetch(`${BASE_URL}/disbursement/submit-invoice`, {
    method: "POST",
    headers,
    body: JSON.stringify(submitBody),
  });

  return await submitRes.json();
}

export function mapPaydunyaStatus(status: string): "pending" | "success" | "failed" {
  const s = String(status || "").toLowerCase();
  if (s === "completed") return "success";
  if (["cancelled", "expired", "failed"].includes(s)) return "failed";
  return "pending";
}
