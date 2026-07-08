import { callApi } from "./api-client";

export const adminOverview = (_args?: any) => callApi("adminOverview");
export const adminStrowalletBalance = (_args?: any) => callApi("adminStrowalletBalance");
export const adminToggleUser = (args: { data: { user_id: string; is_active: boolean } }) => callApi("adminToggleUser", args.data);
export const adminReviewKyc = (args: { data: { user_id: string; decision: "approved" | "rejected"; note?: string } }) => callApi("adminReviewKyc", args.data);
export const adminReviewWithdrawal = (args: { data: { id: string; decision: "approved" | "rejected" | "paid"; note?: string } }) => callApi("adminReviewWithdrawal", args.data);
export const adminDeleteUser = (args: { data: { user_id: string } }) => callApi("adminDeleteUser", args.data);
export const adminAdjustWallet = (args: { data: { user_id: string; currency: string; amount: number; note?: string } }) => callApi("adminAdjustWallet", args.data);
export const adminGetConfig = (_args?: any) => callApi("adminGetConfig");
export const adminUpdateConfig = (args: { data: Record<string, number> }) => callApi("adminUpdateConfig", args.data);
export const adminUpdateUser = (args: { data: { user_id: string; full_name?: string; email?: string; password?: string } }) => callApi("adminUpdateUser", args.data);
export const adminReferralsOverview = (_args?: any) => callApi("adminReferralsOverview");
export const adminYengapayInspect = (args: { data: { id: string } }) => callApi("adminYengapayInspect", args.data);
export const adminCreditPendingDeposit = (args: { data: { txId: string; note?: string } }) => callApi("adminCreditPendingDeposit", args.data);
