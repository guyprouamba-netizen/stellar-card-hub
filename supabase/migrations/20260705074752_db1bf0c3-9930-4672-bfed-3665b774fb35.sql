-- Remove unsafe anonymous Data API privileges from all public base tables.
DO $$
DECLARE
  tbl record;
BEGIN
  FOR tbl IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', tbl.table_name);
  END LOOP;
END $$;

-- Public visitors may only access the sanitized public business view.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'public_business_view'
  ) THEN
    GRANT SELECT ON public.public_business_view TO anon, authenticated, service_role;
  END IF;
END $$;

-- Silence/secure internal API-key tables: no direct client access; backend service role still bypasses RLS.
DROP POLICY IF EXISTS "no direct client access to api key usage" ON public.api_key_usage;
CREATE POLICY "no direct client access to api key usage"
ON public.api_key_usage
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "no direct client access to business api keys" ON public.business_api_keys;
CREATE POLICY "no direct client access to business api keys"
ON public.business_api_keys
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);