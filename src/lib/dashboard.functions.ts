import { callApi } from "./api-client";
// Client shims — proxy to the Supabase edge function `api`.
// Calling convention preserved: fn() or fn({ data: {...} })
export const getDashboardData = (_args?: any) => callApi("getDashboardData");
export const computePricingPreview = (args: { data: { amountUsd: number } }) =>
  callApi("computePricingPreview", args.data);