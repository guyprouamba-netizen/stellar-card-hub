// Thin compatibility layer for legacy components (RechargeSheet, IssueCardSheet).
// Routes through the same `api` edge function.
import { callApi } from "./api-client";

export const walletApi = {
  rechargeYengapay: async (amount: number, _currency = "XOF") => {
    const r: any = await callApi("initRecharge", { amount });
    return { data: { checkout_url: r.checkout_url, reference: r.reference } };
  },
  canAffordCard: async (amount: number, currency = "USD") => {
    // Use computePricingPreview for USD cards; for XOF assume amount itself.
    if (currency === "USD") {
      const r: any = await callApi("computePricingPreview", { amountUsd: amount });
      return { data: { can_afford: !!r.canAfford, required: r.totalXof, available: r.available } };
    }
    return { data: { can_afford: true, required: amount, available: amount } };
  },
};

export const cardApi = {
  buy: async (payload: {
    amount: number; currency?: string; brand?: string;
    firstName: string; lastName: string; dob: string;
    idType: string; idNumber: string; phone: string;
    line1: string; city: string; state: string; postalCode: string; country: string;
    nameOnCard?: string;
  }) => {
    return callApi("issueCard", {
      amountUsd: payload.amount,
      brand: payload.brand || "Visa",
      firstName: payload.firstName,
      lastName: payload.lastName,
      dob: payload.dob,
      idType: payload.idType,
      idNumber: payload.idNumber,
      phone: payload.phone,
      line1: payload.line1,
      city: payload.city,
      state: payload.state,
      postalCode: payload.postalCode,
      country: payload.country,
      nameOnCard: payload.nameOnCard,
    });
  },
};
