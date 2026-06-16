import { callApi } from "./api-client";
export const initRecharge = (args: { data: { amount: number; currency?: string; returnUrl?: string } }) => callApi("initRecharge", args.data);
export const verifyRecharge = (args: { data: { reference: string } }) => callApi("verifyRecharge", args.data);
