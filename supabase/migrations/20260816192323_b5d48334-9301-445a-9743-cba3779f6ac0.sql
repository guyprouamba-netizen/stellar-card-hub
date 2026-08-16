ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS template_slug text DEFAULT 'stripe-modern';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0;

COMMENT ON COLUMN public.invoices.template_slug IS 'Slug du template visuel utilisé pour cette facture';
