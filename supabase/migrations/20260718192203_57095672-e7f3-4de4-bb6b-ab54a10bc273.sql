
ALTER TABLE public.internal_transfers ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Régularisation Averibou / KABRE
UPDATE public.wallets SET balance = balance + 500
 WHERE user_id = '80af4d13-a7bb-42e9-babb-8b13707ec9a7' AND currency = 'XOF';
UPDATE public.wallets SET balance = 0
 WHERE user_id = 'f712627b-ad61-4e64-bca8-b44d3ac2196b' AND currency = 'XOF';
INSERT INTO public.transactions (user_id, type, status, amount, currency, provider, description)
VALUES ('80af4d13-a7bb-42e9-babb-8b13707ec9a7', 'transfer', 'success', 500, 'XOF', 'internal',
        'Fusion compte doublon Averibou (aohdigitalservices)');
UPDATE public.internal_transfers
   SET recipient_id = '80af4d13-a7bb-42e9-babb-8b13707ec9a7'
 WHERE recipient_id = 'f712627b-ad61-4e64-bca8-b44d3ac2196b';
DELETE FROM auth.users WHERE id IN (
  'f712627b-ad61-4e64-bca8-b44d3ac2196b',
  '0d30e5d4-c7ce-4d07-a982-2ac3fd1d97fc'
);

-- Vérification téléphone
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;

-- Nettoyer les doublons restants : garder le plus ancien, vider le téléphone des autres
WITH ranked AS (
  SELECT id, phone, row_number() OVER (
    PARTITION BY public.normalize_bf_phone(phone)
    ORDER BY created_at ASC
  ) AS rn
  FROM public.profiles
  WHERE phone IS NOT NULL AND phone <> ''
)
UPDATE public.profiles p SET phone = NULL, phone_verified = false
  FROM ranked r WHERE p.id = r.id AND r.rn > 1;

UPDATE public.profiles SET phone_verified = true, phone_verified_at = now()
 WHERE phone IS NOT NULL AND phone <> '' AND phone_verified = false;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_normalized_uniq
  ON public.profiles ((public.normalize_bf_phone(phone)))
  WHERE phone IS NOT NULL AND phone <> '';

-- OTP
CREATE TABLE IF NOT EXISTS public.phone_otp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text NOT NULL,
  code_hash text NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS phone_otp_phone_idx ON public.phone_otp (phone, created_at DESC);
CREATE INDEX IF NOT EXISTS phone_otp_user_idx ON public.phone_otp (user_id, created_at DESC);
GRANT ALL ON public.phone_otp TO service_role;
ALTER TABLE public.phone_otp ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no direct access" ON public.phone_otp FOR ALL USING (false) WITH CHECK (false);
