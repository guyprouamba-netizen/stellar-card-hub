-- Ajout du support PIN à 6 chiffres pour les profils utilisateurs
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pin_hash text,
  ADD COLUMN IF NOT EXISTS pin_set_at timestamptz,
  ADD COLUMN IF NOT EXISTS pin_failed_attempts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pin_locked_until timestamptz;

COMMENT ON COLUMN public.profiles.pin_hash IS 'Hash salé du code PIN (format sha256$salt$hash) - ne jamais exposer côté client';
