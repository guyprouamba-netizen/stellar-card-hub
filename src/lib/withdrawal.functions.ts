import { callApi } from "./api-client";
export const requestWithdrawal = (args: { data: any }) => callApi("requestWithdrawal", args.data);
