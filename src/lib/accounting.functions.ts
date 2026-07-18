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

// --- Pro ---
export const getAccountingSettings = (business_id: string) => callApi("getAccountingSettings", { business_id });
export const upsertAccountingSettings = (business_id: string, data: any) => callApi("upsertAccountingSettings", { business_id, ...data });

export const listAccountingAccounts = (business_id: string) => callApi("listAccountingAccounts", { business_id });
export const upsertAccountingAccount = (business_id: string, data: any) => callApi("upsertAccountingAccount", { business_id, ...data });
export const deleteAccountingAccount = (id: string) => callApi("deleteAccountingAccount", { id });

export const listStockItems = (business_id: string) => callApi("listStockItems", { business_id });
export const upsertStockItem = (business_id: string, data: any) => callApi("upsertStockItem", { business_id, ...data });
export const deleteStockItem = (id: string) => callApi("deleteStockItem", { id });
export const listStockMovements = (business_id: string, item_id?: string) => callApi("listStockMovements", { business_id, item_id });
export const createStockMovement = (business_id: string, data: any) => callApi("createStockMovement", { business_id, ...data });

export const getAccountingReports = (business_id: string, filters?: { from?: string; to?: string }) =>
  callApi("getAccountingReports", { business_id, ...(filters || {}) });

export const createAccountingAttachmentUrl = (business_id: string, ext: string) =>
  callApi("createAccountingAttachmentUrl", { business_id, ext });
export const getAccountingAttachmentUrl = (business_id: string, path: string) =>
  callApi("getAccountingAttachmentUrl", { business_id, path });

// SYSCOHADA — plan comptable simplifié (classes principales)
export const SYSCOHADA_ACCOUNTS = [
  { code: "601", label: "Achats de marchandises", kind: "expense" },
  { code: "602", label: "Achats matières premières", kind: "expense" },
  { code: "604", label: "Achats études/prestations", kind: "expense" },
  { code: "605", label: "Fournitures consommables", kind: "expense" },
  { code: "611", label: "Transports", kind: "expense" },
  { code: "622", label: "Locations", kind: "expense" },
  { code: "625", label: "Primes d'assurance", kind: "expense" },
  { code: "626", label: "Publicité / marketing", kind: "expense" },
  { code: "627", label: "Frais bancaires", kind: "expense" },
  { code: "628", label: "Télécommunications", kind: "expense" },
  { code: "641", label: "Impôts et taxes", kind: "expense" },
  { code: "661", label: "Rémunérations du personnel", kind: "expense" },
  { code: "664", label: "Charges sociales", kind: "expense" },
  { code: "671", label: "Intérêts d'emprunts", kind: "expense" },
  { code: "701", label: "Ventes de marchandises", kind: "income" },
  { code: "702", label: "Ventes de produits finis", kind: "income" },
  { code: "706", label: "Prestations de services", kind: "income" },
  { code: "707", label: "Ventes en ligne / boutique", kind: "income" },
  { code: "758", label: "Produits divers", kind: "income" },
  { code: "771", label: "Intérêts perçus", kind: "income" },
] as const;