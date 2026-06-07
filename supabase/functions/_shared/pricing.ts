export type PricingConfig = {
  card_issue_fee_xof: number;
  usd_rate_xof: number;
  strowallet_fixed_fee_usd: number;
  strowallet_pct_fee: number;
};

export const DEFAULT_PRICING: PricingConfig = {
  card_issue_fee_xof: 4500,
  usd_rate_xof: 869,
  strowallet_fixed_fee_usd: 1.9,
  strowallet_pct_fee: 0.01,
};

export function computeCardCost(amountUsd: number, cfg: PricingConfig = DEFAULT_PRICING) {
  const strowalletPctUsd = +(amountUsd * cfg.strowallet_pct_fee).toFixed(4);
  const loadedToStrowalletUsd = +(amountUsd + cfg.strowallet_fixed_fee_usd + strowalletPctUsd).toFixed(4);
  const loadedToStrowalletXof = Math.ceil(loadedToStrowalletUsd * cfg.usd_rate_xof);
  const totalXof = cfg.card_issue_fee_xof + loadedToStrowalletXof;
  return { amountUsd, feeXof: cfg.card_issue_fee_xof, strowalletFixedUsd: cfg.strowallet_fixed_fee_usd, strowalletPctUsd, rateXof: cfg.usd_rate_xof, loadedToStrowalletUsd, loadedToStrowalletXof, totalXof };
}

export function computeFundCost(amountUsd: number, cfg: PricingConfig = DEFAULT_PRICING) {
  const strowalletPctUsd = +(amountUsd * cfg.strowallet_pct_fee).toFixed(4);
  const loadedUsd = +(amountUsd + cfg.strowallet_fixed_fee_usd + strowalletPctUsd).toFixed(4);
  const totalXof = Math.ceil(loadedUsd * cfg.usd_rate_xof);
  return { amountUsd, strowalletFixedUsd: cfg.strowallet_fixed_fee_usd, strowalletPctUsd, rateXof: cfg.usd_rate_xof, loadedUsd, totalXof };
}

export async function loadPricingConfig(admin: any): Promise<PricingConfig> {
  const { data } = await admin.from("platform_config").select("key,value");
  const cfg = { ...DEFAULT_PRICING };
  for (const row of data ?? []) {
    const k = row.key as keyof PricingConfig;
    if (k in cfg) (cfg as any)[k] = Number(row.value);
  }
  return cfg;
}