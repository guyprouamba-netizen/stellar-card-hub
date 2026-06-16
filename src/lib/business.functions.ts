import { callApi } from "./api-client";

export const listMyBusinesses = () => callApi("listMyBusinesses");
export const createBusiness = (data: { name: string; description?: string; contact_email?: string; contact_phone?: string }) =>
  callApi("createBusiness", data);
export const updateBusiness = (data: { id: string; name?: string; description?: string; contact_email?: string; contact_phone?: string; logo_url?: string }) =>
  callApi("updateBusiness", data);

export const listPaymentLinks = (business_id: string) => callApi("listPaymentLinks", { business_id });
export const createPaymentLink = (data: {
  business_id: string; title: string; description?: string;
  amount?: number | null; min_amount?: number | null; max_amount?: number | null;
  currency?: string; redirect_url?: string; callback_url?: string;
}) => callApi("createPaymentLink", data);
export const updatePaymentLink = (data: { id: string; [k: string]: any }) => callApi("updatePaymentLink", data);

export const listLinkPayments = (business_id: string, link_id?: string) =>
  callApi("listLinkPayments", { business_id, link_id });

export const listApiKeys = (business_id: string) => callApi("listApiKeys", { business_id });
export const createApiKey = (data: { business_id: string; label?: string; mode?: "live" | "test" }) =>
  callApi("createApiKey", data);
export const revokeApiKey = (id: string) => callApi("revokeApiKey", { id });

export const cashoutBusinessBalance = (business_id: string) =>
  callApi("cashoutBusinessBalance", { business_id });