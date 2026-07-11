import { callApi } from "./api-client";

export const getBotConfig = (business_id: string) => callApi("getBotConfig", { business_id });
export const updateBotConfig = (business_id: string, patch: any) =>
  callApi("updateBotConfig", { business_id, ...patch });

export const listBotGroups = (business_id: string) => callApi("listBotGroups", { business_id });
export const updateBotGroup = (business_id: string, id: string, patch: any) =>
  callApi("updateBotGroup", { business_id, id, patch });

export const listBotWarnings = (business_id: string) => callApi("listBotWarnings", { business_id });
export const listBotLogs = (business_id: string) => callApi("listBotLogs", { business_id });

export const listBotFaq = (business_id: string) => callApi("listBotFaq", { business_id });
export const upsertBotFaq = (business_id: string, data: { id?: string; question: string; answer: string; active?: boolean }) =>
  callApi("upsertBotFaq", { business_id, ...data });
export const deleteBotFaq = (id: string) => callApi("deleteBotFaq", { id });

export const listBotConversations = (business_id: string) => callApi("listBotConversations", { business_id });
export const getBotConversation = (business_id: string, id: string) => callApi("getBotConversation", { business_id, id });
export const toggleBotHandoff = (business_id: string, id: string) => callApi("toggleBotHandoff", { business_id, id });
export const sendBotHumanReply = (business_id: string, id: string, body: string) =>
  callApi("sendBotHumanReply", { business_id, id, body });