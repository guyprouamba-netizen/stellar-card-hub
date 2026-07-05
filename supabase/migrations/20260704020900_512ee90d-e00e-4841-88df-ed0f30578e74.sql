
-- 1) New enum value for referral reward transactions
ALTER TYPE tx_type ADD VALUE IF NOT EXISTS 'referral_reward';

-- 2) Referrals table
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  cards_rewarded INT NOT NULL DEFAULT 0,
  total_reward_xof NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON public.referrals(referrer_id);

GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_reads_own_referrals" ON public.referrals;
CREATE POLICY "user_reads_own_referrals" ON public.referrals
  FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referred_id = auth.uid());

DROP POLICY IF EXISTS "admins_read_all_referrals" ON public.referrals;
CREATE POLICY "admins_read_all_referrals" ON public.referrals
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3) Update handle_new_user to create referral row when referrer_code matches
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE ref_input text; ref_user uuid;
BEGIN
  ref_input := NULLIF(trim(NEW.raw_user_meta_data->>'referrer_code'), '');
  IF ref_input IS NOT NULL THEN ref_input := upper(ref_input); END IF;
  INSERT INTO public.profiles (id, email, full_name, phone, referrer_code, referral_code)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone',
          ref_input, public.generate_referral_code());
  IF lower(NEW.email) = 'ilboudoibonydo@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  INSERT INTO public.wallets (user_id, currency) VALUES (NEW.id, 'XOF'), (NEW.id, 'USD');
  IF ref_input IS NOT NULL THEN
    SELECT id INTO ref_user FROM public.profiles WHERE upper(referral_code) = ref_input LIMIT 1;
    IF ref_user IS NOT NULL AND ref_user <> NEW.id THEN
      INSERT INTO public.referrals (referrer_id, referred_id, referral_code)
      VALUES (ref_user, NEW.id, ref_input)
      ON CONFLICT (referred_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- 4) Seed platform_config with WhatsApp URL & referral reward amount
INSERT INTO public.platform_config (key, value) VALUES
  ('whatsapp_group_url', '"https://chat.whatsapp.com/KIgzIr6oVVfEnGGyiVaSUq"'::jsonb),
  ('referral_reward_xof', '1000'::jsonb)
ON CONFLICT (key) DO NOTHING;
