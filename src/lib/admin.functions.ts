import { callApi } from "./api-client";

export const adminOverview = () => callApi("adminOverview");
export const adminStrowalletBalance = () => callApi("adminStrowalletBalance");
export const adminToggleUser = (data: { user_id: string; is_active: boolean }) => callApi("adminToggleUser", data);
export const adminUpdateUser = (data: any) => callApi("adminUpdateUser", data);
export const adminDeleteUser = (data: { user_id: string }) => callApi("adminDeleteUser", data);
export const adminReviewKyc = (data: { id: string; status: "approved" | "rejected"; note?: string }) => callApi("adminReviewKyc", data);
export const adminReviewWithdrawal = (data: { id: string; status: "completed" | "failed"; note?: string }) => callApi("adminReviewWithdrawal", data);
export const adminAdjustWallet = (data: { user_id: string; currency: string; amount: number; note?: string }) => callApi("adminAdjustWallet", data);
export const adminGetConfig = () => callApi("adminGetConfig");
export const adminUpdateConfig = (data: any) => callApi("adminUpdateConfig", data);
export const adminReferralsOverview = () => callApi("adminReferralsOverview");
export const adminYengapayInspect = (id: string) => callApi("adminYengapayInspect", { id });
export const adminYengapayVerifyBatch = (ids: string[]) => callApi("adminYengapayVerifyBatch", { ids });
export const adminCreditYengapayExternal = (data: any) => callApi("adminCreditYengapayExternal", data);
export const adminCreditPendingDeposit = (id: string) => callApi("adminCreditPendingDeposit", { id });
export const adminSyncCards = () => callApi("adminSyncCards");
export const adminCardTransactions = (id: string) => callApi("adminCardTransactions", { id });

export const adminListShopTemplates = () => callApi("adminListShopTemplates");
export const adminUpsertShopTemplate = (data: any) => callApi("adminUpsertShopTemplate", data);
export const adminDeleteShopTemplate = (id: string) => callApi("adminDeleteShopTemplate", { id });

export const adminListSenderRequests = () => callApi("adminListSenderRequests");
export const adminUpdateSenderRequest = (data: { id: string; status?: string; admin_note?: string }) => callApi("adminUpdateSenderRequest", data);
