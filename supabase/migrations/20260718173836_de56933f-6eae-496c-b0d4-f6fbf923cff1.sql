
CREATE OR REPLACE FUNCTION public.normalize_bf_phone(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE d text;
BEGIN
  IF input IS NULL THEN RETURN NULL; END IF;
  d := regexp_replace(input, '[^0-9]', '', 'g');
  IF d = '' THEN RETURN NULL; END IF;
  IF left(d,3) = '226' AND length(d) >= 11 THEN RETURN substring(d from 1 for 11); END IF;
  IF length(d) = 8 THEN RETURN '226' || d; END IF;
  IF length(d) BETWEEN 10 AND 15 THEN RETURN d; END IF;
  RETURN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.internal_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_phone text NOT NULL,
  recipient_name text,
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'XOF',
  note text,
  status text NOT NULL DEFAULT 'delivered' CHECK (status IN ('delivered','pending_claim','claimed','cancelled')),
  reference text UNIQUE,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS internal_transfers_sender_idx ON public.internal_transfers(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS internal_transfers_recipient_idx ON public.internal_transfers(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS internal_transfers_phone_idx ON public.internal_transfers(recipient_phone) WHERE status = 'pending_claim';

GRANT SELECT ON public.internal_transfers TO authenticated;
GRANT ALL ON public.internal_transfers TO service_role;
ALTER TABLE public.internal_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own transfers visible" ON public.internal_transfers;
CREATE POLICY "own transfers visible" ON public.internal_transfers
FOR SELECT TO authenticated
USING (sender_id = auth.uid() OR recipient_id = auth.uid());

-- Update handle_new_user to also claim pending transfers by phone
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  ref_input text;
  ref_user uuid;
  new_phone text;
  claimed_total numeric;
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

  -- Auto-claim pending internal transfers matching this phone
  new_phone := public.normalize_bf_phone(NEW.raw_user_meta_data->>'phone');
  IF new_phone IS NOT NULL THEN
    UPDATE public.internal_transfers
      SET status = 'claimed', claimed_at = now(), recipient_id = NEW.id
      WHERE recipient_phone = new_phone AND status = 'pending_claim';
    SELECT COALESCE(SUM(amount), 0) INTO claimed_total
      FROM public.internal_transfers
      WHERE recipient_id = NEW.id AND status = 'claimed' AND currency = 'XOF';
    IF claimed_total > 0 THEN
      UPDATE public.wallets SET balance = balance + claimed_total
        WHERE user_id = NEW.id AND currency = 'XOF';
      INSERT INTO public.transactions (user_id, type, status, amount, currency, provider, provider_ref, description)
      VALUES (NEW.id, 'transfer_in', 'success', claimed_total, 'XOF', 'internal', 'CLAIM-'||NEW.id::text,
              'Réception de transferts en attente');
    END IF;
  END IF;

  RETURN NEW;
END $$;
