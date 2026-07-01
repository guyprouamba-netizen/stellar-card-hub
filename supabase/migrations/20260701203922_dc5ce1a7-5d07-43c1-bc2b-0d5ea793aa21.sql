-- Ajout de la photo de profil
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Suivi du financement cumulé USD par carte (pour déblocage des infos à partir de 5$)
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS total_funded_usd numeric NOT NULL DEFAULT 0;
