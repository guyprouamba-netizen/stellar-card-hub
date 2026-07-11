
-- Accounting
CREATE TABLE public.accounting_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('income','expense')),
  name text NOT NULL,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(business_id, kind, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_categories TO authenticated;
GRANT ALL ON public.accounting_categories TO service_role;
ALTER TABLE public.accounting_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manage acct_categories" ON public.accounting_categories FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id=accounting_categories.business_id AND b.owner_id=auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id=accounting_categories.business_id AND b.owner_id=auth.uid()));

CREATE TABLE public.accounting_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('income','expense')),
  category_id uuid REFERENCES public.accounting_categories(id) ON DELETE SET NULL,
  label text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'XOF',
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  related_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  related_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  notes text,
  attachment_url text,
  auto_generated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX acct_entries_business_date ON public.accounting_entries(business_id, entry_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_entries TO authenticated;
GRANT ALL ON public.accounting_entries TO service_role;
ALTER TABLE public.accounting_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manage acct_entries" ON public.accounting_entries FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id=accounting_entries.business_id AND b.owner_id=auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id=accounting_entries.business_id AND b.owner_id=auth.uid()));
CREATE TRIGGER acct_entries_updated_at BEFORE UPDATE ON public.accounting_entries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Contract templates & contracts
CREATE TABLE public.contract_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'contract' CHECK (kind IN ('contract','invoice','quote','other')),
  content text NOT NULL,
  variables text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_templates TO authenticated;
GRANT ALL ON public.contract_templates TO service_role;
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manage contract_templates" ON public.contract_templates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id=contract_templates.business_id AND b.owner_id=auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id=contract_templates.business_id AND b.owner_id=auth.uid()));
CREATE TRIGGER contract_templates_updated_at BEFORE UPDATE ON public.contract_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.contract_templates(id) ON DELETE SET NULL,
  number text NOT NULL,
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'contract',
  client_name text,
  client_email text,
  client_phone text,
  variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  content text NOT NULL,
  amount numeric,
  currency text DEFAULT 'XOF',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','signed','cancelled')),
  sent_at timestamptz,
  signed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contracts_business ON public.contracts(business_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts TO authenticated;
GRANT ALL ON public.contracts TO service_role;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manage contracts" ON public.contracts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id=contracts.business_id AND b.owner_id=auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id=contracts.business_id AND b.owner_id=auth.uid()));
CREATE TRIGGER contracts_updated_at BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE SEQUENCE IF NOT EXISTS public.contracts_number_seq;
CREATE OR REPLACE FUNCTION public.generate_contract_number()
RETURNS text LANGUAGE sql SET search_path TO 'public' AS
$$ SELECT 'DOC-' || to_char(now(),'YYMMDD') || '-' || lpad(nextval('public.contracts_number_seq')::text, 5, '0') $$;

-- Facebook / Meta
CREATE TABLE public.facebook_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
  meta_user_id text,
  access_token text NOT NULL,
  ad_account_id text,
  page_id text,
  page_name text,
  scopes text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.facebook_integrations TO authenticated;
GRANT ALL ON public.facebook_integrations TO service_role;
ALTER TABLE public.facebook_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manage fb_integrations" ON public.facebook_integrations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id=facebook_integrations.business_id AND b.owner_id=auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id=facebook_integrations.business_id AND b.owner_id=auth.uid()));
CREATE TRIGGER fb_integrations_updated_at BEFORE UPDATE ON public.facebook_integrations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.facebook_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  integration_id uuid REFERENCES public.facebook_integrations(id) ON DELETE CASCADE,
  meta_campaign_id text,
  name text NOT NULL,
  objective text,
  status text,
  daily_budget numeric,
  currency text DEFAULT 'USD',
  insights jsonb DEFAULT '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fb_campaigns_business ON public.facebook_campaigns(business_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.facebook_campaigns TO authenticated;
GRANT ALL ON public.facebook_campaigns TO service_role;
ALTER TABLE public.facebook_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manage fb_campaigns" ON public.facebook_campaigns FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id=facebook_campaigns.business_id AND b.owner_id=auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id=facebook_campaigns.business_id AND b.owner_id=auth.uid()));
CREATE TRIGGER fb_campaigns_updated_at BEFORE UPDATE ON public.facebook_campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger : chaque commande payée crée une écriture comptable "income"
CREATE OR REPLACE FUNCTION public.autolog_paid_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') AND NEW.business_id IS NOT NULL THEN
    INSERT INTO public.accounting_entries (business_id, kind, label, amount, currency, entry_date, related_order_id, auto_generated, notes)
    VALUES (NEW.business_id, 'income',
      COALESCE('Commande ' || NEW.number, 'Vente en ligne'),
      COALESCE(NEW.total, 0), COALESCE(NEW.currency, 'XOF'),
      CURRENT_DATE, NEW.id, true, 'Enregistré automatiquement');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER orders_autolog_income
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.autolog_paid_order();
