
-- Restore missing table grants (RLS enforces per-row rules; grants enable table access)
DO $$
DECLARE t text;
DECLARE tables text[] := ARRAY[
  'action_plans','api_key_usage','business_api_keys','business_audit_log','businesses',
  'cards','coach_messages','invoices','kyc_submissions','payment_link_payments',
  'payment_links','platform_config','product_media','products','profiles','projects',
  'push_subscriptions','rate_limit_hits','referrals','security_events','transactions',
  'user_roles','wallets','withdrawals'
];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

-- Public read for the public business view / payment_links minimally handled by edge functions.
-- Anon read allowed only where explicitly needed (public payment pages use pay edge function with service role).
GRANT USAGE ON SCHEMA public TO authenticated, service_role, anon;
