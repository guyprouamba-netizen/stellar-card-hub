import { callApi } from "./api-client";

export const listMyBusinesses = () => callApi("listMyBusinesses");
export const createBusiness = (data: { name: string; description?: string; contact_email?: string; contact_phone?: string }) =>
  callApi("createBusiness", data);
export const updateBusiness = (data: { id: string; name?: string; description?: string; contact_email?: string; contact_phone?: string; logo_url?: string; cover_url?: string }) =>
  callApi("updateBusiness", data);

export const listPaymentLinks = (business_id: string) => callApi("listPaymentLinks", { business_id });
export const createPaymentLink = (data: {
  business_id: string; title: string; description?: string;
  amount?: number | null; min_amount?: number | null; max_amount?: number | null;
  currency?: string; redirect_url?: string; callback_url?: string;
  project_id?: string; product_id?: string; channel?: "online" | "pos" | "both";
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
export const listBusinessProducts = (business_id: string) => callApi("listProducts", { business_id });
export const createProduct = (data: any) => callApi("createProduct", data);
export const updateProduct = (data: any) => callApi("updateProduct", data);
export const deleteProduct = (id: string) => callApi("deleteProduct", { id });
export const addProductMedia = (data: { product_id: string; type: "image" | "video"; url: string; position?: number }) =>
  callApi("addProductMedia", data);
export const deleteProductMedia = (id: string) => callApi("deleteProductMedia", { id });

// --- Project API keys / webhooks (passerelle) ---
export const getProjectIntegration = (project_id: string) => callApi("getProjectIntegration", { project_id });
export const createProjectApiKeys = (data: { project_id: string; mode?: "live" | "test"; webhook_url?: string }) =>
  callApi("createProjectApiKeys", data);
export const updateProjectWebhook = (data: { id: string; webhook_url: string | null }) =>
  callApi("updateProjectWebhook", data);
export const revokeProjectApiKeys = (id: string) => callApi("revokeProjectApiKeys", { id });
export const simulateProjectWebhook = (data: { project_id: string; event?: string; amount?: number }) =>
  callApi("simulateProjectWebhook", data);
export const listProjectWebhookDeliveries = (project_id: string) =>
  callApi("listProjectWebhookDeliveries", { project_id });
export const getProjectTransactions = (project_id: string) =>
  callApi("getProjectTransactions", { project_id });
export const listProductDownloads = (business_id: string) =>
  callApi("listProductDownloads", { business_id });
export const getGatewayFeeConfig = () => callApi("getGatewayFeeConfig");
export const adminUpdateGatewayFeeConfig = (data: { fee_bps?: number; fee_flat_xof?: number; min_xof?: number; enabled?: boolean; admin_notification_phone?: string }) =>
  callApi("adminUpdateGatewayFeeConfig", data);

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

// --- Chat PAY (WhatsApp worker) ---
export const getWhatsappSession = (business_id: string) =>
  callApi("getWhatsappSession", { business_id });
export const createWhatsappSession = (business_id: string) =>
  callApi("createWhatsappSession", { business_id });
export const resetWhatsappSession = (business_id: string) =>
  callApi("resetWhatsappSession", { business_id });
export const sendWhatsappMessage = (data: { business_id: string; to: string; body: string }) =>
  callApi("sendWhatsappMessage", data);
export const listWhatsappEvents = (business_id: string) =>
  callApi("listWhatsappEvents", { business_id });

// --- SMS Sender ID + credits ---
export const createSenderIdRequest = (data: { business_id?: string; company_name: string; sender_id: string; usage_note?: string }) =>
  callApi("createSenderIdRequest", data);
export const listMySenderIdRequests = (business_id?: string) =>
  callApi("listMySenderIdRequests", business_id ? { business_id } : {});
export const adminListSenderRequests = () => callApi("adminListSenderRequests");
export const adminUpdateSenderRequest = (data: { id: string; status?: "pending"|"approved"|"rejected"; admin_note?: string }) =>
  callApi("adminUpdateSenderRequest", data);
export const listSmsCredits = (business_id: string) =>
  callApi("listSmsCredits", { business_id });
export const purchaseSmsCredits = (data: { business_id: string; sender_id: string; quantity: number }) =>
  callApi("purchaseSmsCredits", data);

// --- Shop Templates (Public for users to list and apply) ---
export const listShopTemplates = () => callApi("listShopTemplates");
export const applyShopTemplate = (data: { business_id: string; template_id: string | null }) => 
  callApi("applyShopTemplate", data);

export const createPaydunyaPayment = (data: { business_id: string; amount: number; origin?: string }) =>
  callApi("createPaydunyaPayment", data);

export const verifyPaydunyaPayment = (token: string) =>
  callApi("verifyPaydunyaPayment", { token });

export const cashoutPaydunya = (data: { business_id: string; amount: number; phone: string; channel: string }) =>
  callApi("cashoutPaydunya", data);

