
-- ===== Roles enum & table =====
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "users read own role" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins read all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ===== Profiles =====
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  phone text,
  country text DEFAULT 'BF',
  is_active boolean NOT NULL DEFAULT true,
  strowallet_customer_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "admins read all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update all profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ===== Wallets (multi-currency) =====
CREATE TABLE public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  currency text NOT NULL DEFAULT 'XOF',
  balance numeric(18,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, currency)
);
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own wallets" ON public.wallets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins read all wallets" ON public.wallets FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ===== Transactions =====
CREATE TYPE public.tx_type AS ENUM ('deposit','withdrawal','card_issue','card_fund','fee','refund','transfer');
CREATE TYPE public.tx_status AS ENUM ('pending','success','failed','cancelled');

CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.tx_type NOT NULL,
  status public.tx_status NOT NULL DEFAULT 'pending',
  amount numeric(18,2) NOT NULL,
  currency text NOT NULL DEFAULT 'XOF',
  provider text,
  provider_ref text,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own tx" ON public.transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins read all tx" ON public.transactions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_tx_user_created ON public.transactions(user_id, created_at DESC);

-- ===== Cards =====
CREATE TABLE public.cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'strowallet',
  provider_card_id text,
  brand text DEFAULT 'visa',
  last4 text,
  currency text NOT NULL DEFAULT 'USD',
  balance numeric(18,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cards TO authenticated;
GRANT ALL ON public.cards TO service_role;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own cards" ON public.cards FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins read all cards" ON public.cards FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ===== KYC =====
CREATE TABLE public.kyc_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  provider_status text,
  first_name text,
  last_name text,
  date_of_birth date,
  id_type text,
  id_number text,
  id_image_url text,
  selfie_url text,
  address text,
  city text,
  country text DEFAULT 'BF',
  provider_response jsonb DEFAULT '{}'::jsonb,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.kyc_submissions TO authenticated;
GRANT ALL ON public.kyc_submissions TO service_role;
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own kyc" ON public.kyc_submissions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins read all kyc" ON public.kyc_submissions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update all kyc" ON public.kyc_submissions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ===== updated_at trigger =====
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_wallets_updated BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_tx_updated BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_cards_updated BEFORE UPDATE ON public.cards FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_kyc_updated BEFORE UPDATE ON public.kyc_submissions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== Profile + wallets auto-creation on signup =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  INSERT INTO public.wallets (user_id, currency) VALUES (NEW.id, 'XOF'), (NEW.id, 'USD'), (NEW.id, 'EUR');
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
