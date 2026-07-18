
-- Settings entreprise
CREATE TABLE IF NOT EXISTS public.accounting_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
  legal_name text,
  ifu text,
  rccm text,
  address text,
  phone text,
  email text,
  logo_url text,
  currency text NOT NULL DEFAULT 'XOF',
  tva_enabled boolean NOT NULL DEFAULT false,
  tva_rate numeric(5,2) NOT NULL DEFAULT 18,
  fiscal_year_start text NOT NULL DEFAULT '01-01',
  regime text NOT NULL DEFAULT 'reel_simplifie',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_settings TO authenticated;
GRANT ALL ON public.accounting_settings TO service_role;
ALTER TABLE public.accounting_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own accounting_settings" ON public.accounting_settings
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND (b.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND (b.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE TRIGGER trg_accounting_settings_updated BEFORE UPDATE ON public.accounting_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Comptes de trésorerie
CREATE TABLE IF NOT EXISTS public.accounting_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'cash',
  currency text NOT NULL DEFAULT 'XOF',
  opening_balance numeric(14,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_accounts TO authenticated;
GRANT ALL ON public.accounting_accounts TO service_role;
ALTER TABLE public.accounting_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own accounting_accounts" ON public.accounting_accounts
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND (b.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND (b.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE INDEX IF NOT EXISTS accounting_accounts_business_idx ON public.accounting_accounts(business_id);
CREATE TRIGGER trg_accounting_accounts_updated BEFORE UPDATE ON public.accounting_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Stock
CREATE TABLE IF NOT EXISTS public.stock_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  sku text,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'unité',
  purchase_price numeric(14,2) NOT NULL DEFAULT 0,
  sale_price numeric(14,2) NOT NULL DEFAULT 0,
  stock_qty numeric(14,3) NOT NULL DEFAULT 0,
  alert_threshold numeric(14,3) NOT NULL DEFAULT 0,
  linked_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_items TO authenticated;
GRANT ALL ON public.stock_items TO service_role;
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own stock_items" ON public.stock_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND (b.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND (b.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE INDEX IF NOT EXISTS stock_items_business_idx ON public.stock_items(business_id);
CREATE TRIGGER trg_stock_items_updated BEFORE UPDATE ON public.stock_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  kind text NOT NULL,
  qty numeric(14,3) NOT NULL,
  unit_cost numeric(14,2),
  related_entry_id uuid REFERENCES public.accounting_entries(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own stock_movements" ON public.stock_movements
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND (b.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND (b.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE INDEX IF NOT EXISTS stock_movements_item_idx ON public.stock_movements(item_id, created_at DESC);

-- Enrichir accounting_entries
ALTER TABLE public.accounting_entries ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounting_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.accounting_entries ADD COLUMN IF NOT EXISTS tva_rate numeric(5,2) NOT NULL DEFAULT 0;
ALTER TABLE public.accounting_entries ADD COLUMN IF NOT EXISTS tva_amount numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE public.accounting_entries ADD COLUMN IF NOT EXISTS attachment_url text;
ALTER TABLE public.accounting_entries ADD COLUMN IF NOT EXISTS syscohada_code text;
ALTER TABLE public.accounting_entries ADD COLUMN IF NOT EXISTS counterparty text;
