
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  ref_input text; ref_user uuid;
  new_phone text;
  pending record;
  w_id uuid;
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
    SELECT id INTO w_id FROM public.wallets
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
      VALUES (NEW.id, 'transfer', 'success', pending.amount, pending.currency, 'internal', pending.reference,
              'Transfert reçu à l''inscription');
    END LOOP;
  END IF;

  RETURN NEW;
END $function$;
