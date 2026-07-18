import { callApi } from "./api-client";

export const getMomoTransferConfig = () => callApi("getMomoTransferConfig");
export const quoteMomoTransfer = (args: { data: { amount: number } }) => callApi("quoteMomoTransfer", args.data);
export const initMomoTransfer = (args: { data: any }) => callApi("initMomoTransfer", args.data);
export const verifyMomoTransfer = (args: { data: { reference: string } }) => callApi("verifyMomoTransfer", args.data);
export const listMyMomoTransfers = () => callApi("listMyMomoTransfers");

// Admin
export const adminListMomoTransfers = () => callApi("adminListMomoTransfers");
export const adminRetryMomoTransferPayout = (args: { data: { id: string } }) => callApi("adminRetryMomoTransferPayout", args.data);
export const adminUpdateMomoTransferConfig = (args: { data: any }) => callApi("adminUpdateMomoTransferConfig", args.data);

// ============ Transferts inter-comptes (P2P gratuit) ============
export const lookupInternalRecipient = (phone: string) =>
  callApi<{ found: boolean; name?: string | null }>("lookupInternalRecipient", { phone });
export const initInternalTransfer = (data: {
  recipient_phone: string; recipient_name?: string; amount: number; note?: string;
}) => callApi<{ ok: boolean; error?: string; transfer?: any; delivered?: boolean }>("initInternalTransfer", data);
export const listMyInternalTransfers = () =>
  callApi<{ sent: any[]; received: any[] }>("listMyInternalTransfers");
