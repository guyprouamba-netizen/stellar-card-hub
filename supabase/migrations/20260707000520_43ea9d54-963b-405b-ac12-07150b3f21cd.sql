DO $$
DECLARE
  rate numeric := 869;
  cfg_val text;
BEGIN
  SELECT value INTO cfg_val FROM public.platform_config WHERE key = 'usd_rate_xof' LIMIT 1;
  IF cfg_val IS NOT NULL AND cfg_val ~ '^[0-9]+(\.[0-9]+)?$' THEN
    rate := cfg_val::numeric;
  END IF;

  WITH funded AS (
    SELECT
      c.id AS card_id,
      COALESCE(SUM(
        CASE
          WHEN (t.metadata->'pricing'->>'usd') IS NOT NULL
            THEN (t.metadata->'pricing'->>'usd')::numeric
          ELSE t.amount / NULLIF(rate, 0)
        END
      ), 0) AS total_usd
    FROM public.cards c
    LEFT JOIN public.transactions t
      ON t.provider_ref = c.provider_card_id
     AND t.type = 'card_fund'
     AND t.status = 'success'
    GROUP BY c.id
  )
  UPDATE public.cards c
     SET total_funded_usd = GREATEST(COALESCE(c.total_funded_usd,0), ROUND(f.total_usd::numeric, 2))
    FROM funded f
   WHERE f.card_id = c.id
     AND ROUND(f.total_usd::numeric, 2) > COALESCE(c.total_funded_usd, 0);
END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_created_at_desc ON public.transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_businesses_created_at_desc ON public.businesses (created_at DESC);