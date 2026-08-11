ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'physical',
  ADD COLUMN IF NOT EXISTS short_description text,
  ADD COLUMN IF NOT EXISTS sale_price numeric,
  ADD COLUMN IF NOT EXISTS purchase_note text,
  ADD COLUMN IF NOT EXISTS access_instructions text,
  ADD COLUMN IF NOT EXISTS downloadable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS download_url text,
  ADD COLUMN IF NOT EXISTS download_name text,
  ADD COLUMN IF NOT EXISTS download_limit integer,
  ADD COLUMN IF NOT EXISTS download_expiry_days integer,
  ADD COLUMN IF NOT EXISTS manage_stock boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weight numeric;

CREATE TABLE IF NOT EXISTS public.product_downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES public.payment_link_payments(id) ON DELETE SET NULL,
  customer_email text,
  customer_name text,
  product_name text NOT NULL,
  file_url text NOT NULL,
  file_name text,
  access_token text NOT NULL UNIQUE,
  downloads_used integer NOT NULL DEFAULT 0,
  download_limit integer,
  expires_at timestamptz,
  last_downloaded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.product_downloads TO authenticated;
GRANT ALL ON public.product_downloads TO service_role;

ALTER TABLE public.product_downloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their product downloads"
ON public.product_downloads FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.businesses b
  WHERE b.id = product_downloads.business_id AND b.owner_id = auth.uid()
));

CREATE TRIGGER trg_product_downloads_updated
BEFORE UPDATE ON public.product_downloads
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_product_downloads_business ON public.product_downloads(business_id);
CREATE INDEX IF NOT EXISTS idx_product_downloads_email ON public.product_downloads(customer_email);