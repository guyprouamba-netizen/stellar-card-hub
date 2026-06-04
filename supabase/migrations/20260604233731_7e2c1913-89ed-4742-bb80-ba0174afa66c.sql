
-- 1. Cards: anti-fraude
ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS failed_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_frozen_at timestamptz;

-- 2. Étendre l'enum tx_type (si l'enum existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tx_type') THEN
    BEGIN ALTER TYPE tx_type ADD VALUE IF NOT EXISTS 'withdrawal'; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE tx_type ADD VALUE IF NOT EXISTS 'withdrawal_refund'; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE tx_type ADD VALUE IF NOT EXISTS 'card_auto_freeze'; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE tx_type ADD VALUE IF NOT EXISTS 'card_fee'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;

-- 3. Table retraits
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'XOF',
  method text NOT NULL,                  -- 'mobile_money' | 'bank'
  destination jsonb NOT NULL DEFAULT '{}'::jsonb,  -- {operator, phone, account, ...}
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected | paid
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.withdrawals TO authenticated;
GRANT ALL ON public.withdrawals TO service_role;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own withdrawals" ON public.withdrawals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users create own withdrawals" ON public.withdrawals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "admins read all withdrawals" ON public.withdrawals FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update all withdrawals" ON public.withdrawals FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_withdrawals_updated_at BEFORE UPDATE ON public.withdrawals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Table config plateforme
CREATE TABLE IF NOT EXISTS public.platform_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_config TO authenticated;
GRANT ALL ON public.platform_config TO service_role;
ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone authed reads config" ON public.platform_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins write config" ON public.platform_config FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

INSERT INTO public.platform_config (key, value) VALUES
  ('card_issue_fee_xof', '4500'::jsonb),
  ('usd_rate_xof', '869'::jsonb),
  ('strowallet_fixed_fee_usd', '1.9'::jsonb),
  ('strowallet_pct_fee', '0.01'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 5. Trigger d'inscription : promouvoir le super-admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone');
  IF lower(NEW.email) = 'ilboudoibonydo@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  INSERT INTO public.wallets (user_id, currency) VALUES (NEW.id, 'XOF'), (NEW.id, 'USD'), (NEW.id, 'EUR');
  RETURN NEW;
END $$;

-- (re)attach trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Si le super-admin existe déjà, le promouvoir maintenant
DO $$
DECLARE uid uuid;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE lower(email) = 'ilboudoibonydo@gmail.com' LIMIT 1;
  IF uid IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'admin') ON CONFLICT DO NOTHING;
  END IF;
END $$;
