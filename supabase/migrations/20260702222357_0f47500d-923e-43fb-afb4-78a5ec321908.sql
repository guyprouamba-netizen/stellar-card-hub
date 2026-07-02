
-- 1) Anonymous access hardening
DROP POLICY IF EXISTS "public reads active business by slug" ON public.businesses;
DROP POLICY IF EXISTS "public reads active links by slug" ON public.payment_links;
DROP POLICY IF EXISTS "public read active products" ON public.products;
DROP POLICY IF EXISTS "public read active projects" ON public.projects;
DROP POLICY IF EXISTS "public read media" ON public.product_media;

-- Safe public projection (no PII)
CREATE OR REPLACE VIEW public.public_business_view
WITH (security_invoker = true) AS
SELECT id, name, slug, description, logo_url, country, status
FROM public.businesses
WHERE status = 'active';
GRANT SELECT ON public.public_business_view TO anon, authenticated;

-- 2) Avatars: owner-only reads
DROP POLICY IF EXISTS "avatars_read_authenticated" ON storage.objects;
CREATE POLICY "avatars_read_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3) Remove residual auto-confirm trigger + function
DROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm ON auth.users;
DROP FUNCTION IF EXISTS public.auto_confirm_email() CASCADE;

-- 4) Harden SECURITY DEFINER functions (freeze search_path)
ALTER FUNCTION public.has_role(uuid, public.app_role) SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname='public' AND p.proname='generate_referral_code') THEN
    EXECUTE 'ALTER FUNCTION public.generate_referral_code() SET search_path = public, extensions, pg_temp';
  END IF;
END $$;

-- Revoke direct execute; RLS internal calls still work as postgres/service_role
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

-- 5) Rate-limit + security event tables
CREATE TABLE IF NOT EXISTS public.rate_limit_hits (
  id BIGSERIAL PRIMARY KEY,
  bucket TEXT NOT NULL,          -- e.g. 'pay:initCheckout'
  ip TEXT NOT NULL,
  hit_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rl_bucket_ip_time ON public.rate_limit_hits (bucket, ip, hit_at DESC);
ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.rate_limit_hits TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.rate_limit_hits_id_seq TO service_role;

CREATE TABLE IF NOT EXISTS public.security_events (
  id BIGSERIAL PRIMARY KEY,
  kind TEXT NOT NULL,            -- 'api_key_invalid','rate_limited','ip_blocked','auth_fail'
  ip TEXT,
  user_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sec_events_time ON public.security_events (created_at DESC);
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.security_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.security_events_id_seq TO service_role;

-- Admin visibility on both
CREATE POLICY "admin reads rate limits"
  ON public.rate_limit_hits FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admin reads security events"
  ON public.security_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 6) Auto-purge old rate limit rows (keep 24h)
CREATE OR REPLACE FUNCTION public.purge_rate_limit_hits() RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  DELETE FROM public.rate_limit_hits WHERE hit_at < now() - interval '24 hours';
$$;
REVOKE EXECUTE ON FUNCTION public.purge_rate_limit_hits() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_rate_limit_hits() TO service_role;
