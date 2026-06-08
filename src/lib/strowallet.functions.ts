import { callApi } from "./api-client";

export const diagnoseStrowallet = (_args?: any) => callApi("diagnoseStrowallet");
export const syncKycStatus = (_args?: any) => callApi("syncKycStatus");
export const fetchStrowalletBalance = (_args?: any) => callApi("fetchStrowalletBalance");
export const submitKyc = (args: { data: any }) => callApi("submitKyc", args.data);
export const issueCard = (args: { data: any }) => callApi("issueCard", args.data);
export const cardDetails = (args: { data: { card_id: string } }) => callApi("cardDetails", args.data);
export const refreshCard = (args: { data: { card_id: string } }) => callApi("refreshCard", args.data);
export const cardAction = (args: { data: { card_id: string; action: "freeze" | "unfreeze" | "terminate" } }) => callApi("cardAction", args.data);
export const listCardTransactions = (args: { data: { card_id: string } }) => callApi("listCardTransactions", args.data);
export const fundCard = (args: { data: { card_id: string; amountUsd: number } }) => callApi("fundCard", args.data);
export const listMyCards = (_args?: any) => callApi("listMyCards");