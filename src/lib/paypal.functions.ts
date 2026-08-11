import { callApi } from "./api-client";

export type PaypalWdConfig = {
  fee_bps: number; fee_flat_xof: number; min: number; max: number; enabled: boolean;
};

export const getPaypalWithdrawConfig = () => callApi<PaypalWdConfig>("getPaypalWithdrawConfig");
export const quotePaypalWithdrawal = (amount: number) =>
  callApi<{ ok: boolean; error?: string; amount_send?: number; fees_xof?: number; total_charged_xof?: number }>(
    "quotePaypalWithdrawal", { amount });
export const initPaypalWithdrawal = (data: {
  amount: number; dest_operator: "ORANGE_MONEY" | "MOOV_MONEY"; dest_phone: string; dest_holder: string; returnUrl?: string;
}) => callApi<{ ok: boolean; error?: string; checkout_url?: string; reference?: string; transfer?: any }>("initPaypalWithdrawal", data);
export const listMyPaypalWithdrawals = () => callApi<any[]>("listMyPaypalWithdrawals");
export const adminUpdatePaypalWithdrawConfig = (data: {
  fee_bps?: number; fee_flat_xof?: number; min_xof?: number; max_xof?: number; enabled?: boolean;
}) => callApi<PaypalWdConfig>("adminUpdatePaypalWithdrawConfig", data);