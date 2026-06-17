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

// --- Projects ---
export const listProjects = (business_id: string) => callApi("listProjects", { business_id });
export const createProject = (data: any) => callApi("createProject", data);
export const updateProject = (data: any) => callApi("updateProject", data);
export const deleteProject = (id: string) => callApi("deleteProject", { id });

// --- Products ---
export const listProducts = (project_id: string) => callApi("listProducts", { project_id });
export const createProduct = (data: any) => callApi("createProduct", data);
export const updateProduct = (data: any) => callApi("updateProduct", data);
export const deleteProduct = (id: string) => callApi("deleteProduct", { id });
export const addProductMedia = (data: { product_id: string; type: "image" | "video"; url: string; position?: number }) =>
  callApi("addProductMedia", data);
export const deleteProductMedia = (id: string) => callApi("deleteProductMedia", { id });

// --- Invoices ---
export const listInvoices = (business_id: string, project_id?: string) =>
  callApi("listInvoices", { business_id, project_id });
export const createInvoice = (data: any) => callApi("createInvoice", data);
export const updateInvoice = (data: any) => callApi("updateInvoice", data);

// --- Action plans ---
export const listActionPlans = (business_id: string, project_id?: string) =>
  callApi("listActionPlans", { business_id, project_id });
export const createActionPlan = (data: any) => callApi("createActionPlan", data);
export const updateActionPlan = (data: any) => callApi("updateActionPlan", data);
export const deleteActionPlan = (id: string) => callApi("deleteActionPlan", { id });

// --- Dashboard ---
export const getBusinessDashboard = (business_id: string) =>
  callApi("getBusinessDashboard", { business_id });