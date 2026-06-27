
-- 1) Withdrawals: failure reason + paid_at
ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- 2) Profiles: referral system
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referrer_code text,
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;

CREATE INDEX IF NOT EXISTS profiles_referrer_code_idx ON public.profiles(referrer_code);

-- 3) Generate referral_code helper
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE code text; tries int := 0;
BEGIN
  LOOP
    code := upper(substr(replace(encode(gen_random_bytes(6),'base64'),'/',''),1,8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = code);
    tries := tries + 1;
    IF tries > 5 THEN RETURN code || floor(random()*1000)::text; END IF;
  END LOOP;
  RETURN code;
END $$;

-- Backfill referral codes
UPDATE public.profiles SET referral_code = public.generate_referral_code() WHERE referral_code IS NULL;

-- 4) Update handle_new_user to capture referrer + generate code
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE ref_input text;
BEGIN
  ref_input := NULLIF(trim(NEW.raw_user_meta_data->>'referrer_code'), '');
  INSERT INTO public.profiles (id, email, full_name, phone, referrer_code, referral_code)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone',
          ref_input, public.generate_referral_code());
  IF lower(NEW.email) = 'ilboudoibonydo@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  INSERT INTO public.wallets (user_id, currency) VALUES (NEW.id, 'XOF'), (NEW.id, 'USD');
  RETURN NEW;
END $$;

-- 5) Schedule reconciliation cron (every 2 minutes)
DO $$
DECLARE existing_id int;
BEGIN
  SELECT jobid INTO existing_id FROM cron.job WHERE jobname = 'reconcile-withdrawals-2min';
  IF existing_id IS NOT NULL THEN PERFORM cron.unschedule(existing_id); END IF;
  PERFORM cron.schedule(
    'reconcile-withdrawals-2min',
    '*/2 * * * *',
    $cron$
      SELECT net.http_post(
        url := 'https://bbepprxkkwdfzmiycqqi.supabase.co/functions/v1/reconcile-withdrawals',
        headers := jsonb_build_object('Content-Type','application/json')
      );
    $cron$
  );
END $$;
