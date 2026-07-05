-- Emergency recovery: restore authenticated/service access required by the Data API.
-- RLS policies still enforce per-user/admin visibility.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

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
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', tbl.table_name);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', tbl.table_name);
  END LOOP;
END $$;

-- Keep public reads limited to views/tables that already have public RLS or are safe public surfaces.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'public_business_view'
  ) THEN
    GRANT SELECT ON public.public_business_view TO anon, authenticated, service_role;
  END IF;
END $$;

-- Ensure new signups are provisioned correctly. No email auto-confirm is enabled here.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Performance indexes for the pages that were spinning/slow.
CREATE INDEX IF NOT EXISTS idx_profiles_id_active ON public.profiles (id, is_active);
CREATE INDEX IF NOT EXISTS idx_wallets_user_currency ON public.wallets (user_id, currency);
CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON public.transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cards_user_created ON public.cards (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role ON public.user_roles (user_id, role);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_created ON public.referrals (referrer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON public.referrals (referred_id);