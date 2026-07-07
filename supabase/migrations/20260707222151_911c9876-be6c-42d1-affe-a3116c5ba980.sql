
-- Restaure les GRANTs Data API sur toutes les tables publiques (protège RLS derrière).
DO $$
DECLARE tbl record;
BEGIN
  FOR tbl IN
    SELECT c.relname AS table_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relkind = 'r' AND n.nspname = 'public'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', tbl.table_name);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', tbl.table_name);
  END LOOP;
END $$;

-- Sécurité renforcée du lien de parrainage : blocage de l'auto-parrainage & unicité du code.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_uidx ON public.profiles(referral_code) WHERE referral_code IS NOT NULL;

-- Bloque l'auto-parrainage (defense in depth)
CREATE OR REPLACE FUNCTION public.prevent_self_referral()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.referrer_id = NEW.referred_id THEN
    RAISE EXCEPTION 'Auto-parrainage interdit';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_prevent_self_referral ON public.referrals;
CREATE TRIGGER trg_prevent_self_referral BEFORE INSERT OR UPDATE ON public.referrals
FOR EACH ROW EXECUTE FUNCTION public.prevent_self_referral();

-- Index utile pour la lecture du tableau parrainage
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_created ON public.referrals(referrer_id, created_at DESC);
