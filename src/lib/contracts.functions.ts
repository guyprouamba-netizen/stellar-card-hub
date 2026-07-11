import { callApi } from "./api-client";

export const listContractTemplates = (business_id: string) =>
  callApi("listContractTemplates", { business_id });
export const upsertContractTemplate = (business_id: string, data: { id?: string; name: string; kind?: string; content: string }) =>
  callApi("upsertContractTemplate", { business_id, ...data });
export const deleteContractTemplate = (id: string) =>
  callApi("deleteContractTemplate", { id });

export const listContracts = (business_id: string) => callApi("listContracts", { business_id });
export const generateContract = (business_id: string, data: any) =>
  callApi("generateContract", { business_id, ...data });
export const updateContractStatus = (id: string, status: string) =>
  callApi("updateContractStatus", { id, status });
export const deleteContract = (id: string) => callApi("deleteContract", { id });