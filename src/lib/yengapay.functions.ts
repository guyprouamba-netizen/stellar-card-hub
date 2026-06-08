import { callApi } from "./api-client";
export const initRecharge = (args: { data: { amount: number; currency?: string } }) => callApi("initRecharge", args.data);
