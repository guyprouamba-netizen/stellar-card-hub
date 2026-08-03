import { callApi } from "./api-client";

export type DepositOperator = { code: string; label: string; flow: "otp" | "push" };
export type DepositStatus = "success" | "pending" | "failed";

export const listDepositOperators = () =>
  callApi<{ ok: boolean; operators: DepositOperator[] }>("listDepositOperators", {});

export const initDeposit = (data: { amount: number; operator: string; phone: string }) =>
  callApi<{ ok: boolean; reference: string; requiresOtp: boolean; status: DepositStatus; message?: string; error?: string }>("initDeposit", data);

export const sendDepositOtp = (data: { reference: string }) =>
  callApi<{ ok: boolean; message?: string; error?: string }>("sendDepositOtp", data);

export const payDeposit = (data: { reference: string; otp?: string }) =>
  callApi<{ ok: boolean; status: DepositStatus; message?: string; error?: string }>("payDeposit", data);

export const depositStatus = (data: { reference: string }) =>
  callApi<{ ok: boolean; status: DepositStatus; credited: boolean }>("depositStatus", data);

export const FALLBACK_OPERATORS: DepositOperator[] = [
  { code: "ORANGE_MONEY_BF", label: "Orange Money", flow: "otp" },
  { code: "MOOV_MONEY_BF", label: "Moov Money", flow: "push" },
  { code: "TELECEL_BF", label: "Telecel Money", flow: "push" },
  { code: "SANK_MONEY", label: "Sank Money", flow: "push" },
  { code: "CORIS_MONEY", label: "Coris Money", flow: "push" },
];
