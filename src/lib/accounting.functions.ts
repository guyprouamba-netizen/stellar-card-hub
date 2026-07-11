import { callApi } from "./api-client";

export const listAccountingCategories = (business_id: string) =>
  callApi("listAccountingCategories", { business_id });
export const upsertAccountingCategory = (business_id: string, data: { id?: string; name: string; kind: "income" | "expense"; color?: string }) =>
  callApi("upsertAccountingCategory", { business_id, ...data });
export const deleteAccountingCategory = (id: string) => callApi("deleteAccountingCategory", { id });

export const listAccountingEntries = (business_id: string, filters?: { from?: string; to?: string; kind?: string }) =>
  callApi("listAccountingEntries", { business_id, ...(filters || {}) });
export const upsertAccountingEntry = (business_id: string, data: any) =>
  callApi("upsertAccountingEntry", { business_id, ...data });
export const deleteAccountingEntry = (id: string) => callApi("deleteAccountingEntry", { id });

export const getAccountingSummary = (business_id: string, filters?: { from?: string; to?: string }) =>
  callApi("getAccountingSummary", { business_id, ...(filters || {}) });