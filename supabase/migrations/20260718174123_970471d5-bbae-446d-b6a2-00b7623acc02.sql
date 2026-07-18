
CREATE TABLE IF NOT EXISTS public.internal_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_phone text NOT NULL,
  recipient_name text,
  amount bigint NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'XOF',
  note text,
  status text NOT NULL DEFAULT 'delivered',
  reference text UNIQUE,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_internal_transfers_sender ON public.internal_transfers(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_internal_transfers_recipient ON public.internal_transfers(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_internal_transfers_phone ON public.internal_transfers(recipient_phone) WHERE status = 'pending_claim';

GRANT SELECT ON public.internal_transfers TO authenticated;
GRANT ALL ON public.internal_transfers TO service_role;

ALTER TABLE public.internal_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_internal_transfers" ON public.internal_transfers;
CREATE POLICY "own_internal_transfers" ON public.internal_transfers
  FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

DROP TRIGGER IF EXISTS trg_internal_transfers_updated ON public.internal_transfers;
CREATE TRIGGER trg_internal_transfers_updated
  BEFORE UPDATE ON public.internal_transfers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- On signup: claim any pending_claim transfers for this phone
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $function$
DECLARE
  ref_input text; ref_user uuid;
  new_phone text;
  pending record;
  w_id uuid; w_bal bigint;
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

  -- Auto-claim pending_claim internal transfers matching this phone
  new_phone := public.normalize_bf_phone(NEW.raw_user_meta_data->>'phone');
  IF new_phone IS NOT NULL THEN
    SELECT id, balance INTO w_id, w_bal FROM public.wallets
      WHERE user_id = NEW.id AND currency = 'XOF' LIMIT 1;
    FOR pending IN
      SELECT * FROM public.internal_transfers
      WHERE status = 'pending_claim'
        AND public.normalize_bf_phone(recipient_phone) = new_phone
    LOOP
      UPDATE public.wallets SET balance = COALESCE(balance,0) + pending.amount WHERE id = w_id;
      UPDATE public.internal_transfers
        SET status = 'claimed', recipient_id = NEW.id, claimed_at = now()
        WHERE id = pending.id;
      INSERT INTO public.transactions (user_id, type, status, amount, currency, provider, provider_ref, description)
      VALUES (NEW.id, 'transfer_in', 'success', pending.amount, pending.currency, 'internal', pending.reference,
              'Transfert reçu à l''inscription');
    END LOOP;
  END IF;

  RETURN NEW;
END $function$;
