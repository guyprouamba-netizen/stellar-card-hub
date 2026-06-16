
-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.business_status AS ENUM ('pending','active','suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_link_status AS ENUM ('active','paused','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_link_payment_status AS ENUM ('pending','success','failed','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ BUSINESSES ============
CREATE TABLE public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  logo_url text,
  contact_email text,
  contact_phone text,
  country text NOT NULL DEFAULT 'BF',
  status public.business_status NOT NULL DEFAULT 'pending',
  fee_bps integer NOT NULL DEFAULT 150,
  balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX businesses_owner_idx ON public.businesses(owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.businesses TO authenticated;
GRANT SELECT ON public.businesses TO anon;
GRANT ALL ON public.businesses TO service_role;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner reads own businesses" ON public.businesses FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "owner creates own business" ON public.businesses FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner updates own business" ON public.businesses FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin deletes business" ON public.businesses FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "public reads active business by slug" ON public.businesses FOR SELECT TO anon
  USING (status = 'active');

CREATE TRIGGER businesses_set_updated_at BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ BUSINESS API KEYS ============
CREATE TABLE public.business_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'default',
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  mode text NOT NULL DEFAULT 'live',
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX business_api_keys_business_idx ON public.business_api_keys(business_id);
-- API keys never readable from client → service_role only
GRANT ALL ON public.business_api_keys TO service_role;
ALTER TABLE public.business_api_keys ENABLE ROW LEVEL SECURITY;
-- No policies = no client access. Edge function uses service_role.

-- ============ PAYMENT LINKS ============
CREATE TABLE public.payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  amount numeric,
  min_amount numeric,
  max_amount numeric,
  currency text NOT NULL DEFAULT 'XOF',
  redirect_url text,
  callback_url text,
  status public.payment_link_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payment_links_business_idx ON public.payment_links(business_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_links TO authenticated;
GRANT SELECT ON public.payment_links TO anon;
GRANT ALL ON public.payment_links TO service_role;
ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages own links" ON public.payment_links FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND (b.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND (b.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "public reads active links by slug" ON public.payment_links FOR SELECT TO anon
  USING (status = 'active');

CREATE TRIGGER payment_links_set_updated_at BEFORE UPDATE ON public.payment_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PAYMENT LINK PAYMENTS ============
CREATE TABLE public.payment_link_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.payment_links(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  reference text NOT NULL UNIQUE,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'XOF',
  customer_name text,
  customer_phone text,
  customer_email text,
  status public.payment_link_payment_status NOT NULL DEFAULT 'pending',
  provider text NOT NULL DEFAULT 'yengapay',
  provider_ref text,
  payment_intent_id text,
  fee_amount numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL DEFAULT 0,
  metadata jsonb,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payment_link_payments_business_idx ON public.payment_link_payments(business_id);
CREATE INDEX payment_link_payments_link_idx ON public.payment_link_payments(link_id);
CREATE INDEX payment_link_payments_status_idx ON public.payment_link_payments(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_link_payments TO authenticated;
GRANT ALL ON public.payment_link_payments TO service_role;
ALTER TABLE public.payment_link_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner reads own link payments" ON public.payment_link_payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND (b.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

CREATE TRIGGER payment_link_payments_set_updated_at BEFORE UPDATE ON public.payment_link_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ Index sur withdrawals pour le job de réconciliation ============
CREATE INDEX IF NOT EXISTS withdrawals_status_created_idx ON public.withdrawals(status, created_at);
