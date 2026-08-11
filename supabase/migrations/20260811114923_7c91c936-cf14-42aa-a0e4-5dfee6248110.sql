ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS theme jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tagline text;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS show_in_shop boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.autolog_link_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'success' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'success') AND NEW.business_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.accounting_entries
      WHERE business_id = NEW.business_id AND notes = 'ref:' || COALESCE(NEW.reference, NEW.id::text)
    ) THEN
      INSERT INTO public.accounting_entries (business_id, kind, label, amount, currency, entry_date, auto_generated, notes, counterparty)
      VALUES (NEW.business_id, 'income',
        'Paiement boutique ' || COALESCE(NEW.reference, ''),
        COALESCE(NEW.net_amount, NEW.amount, 0), COALESCE(NEW.currency, 'XOF'),
        CURRENT_DATE, true, 'ref:' || COALESCE(NEW.reference, NEW.id::text),
        NULLIF(COALESCE(NEW.customer_name, NEW.customer_phone, NEW.customer_email), ''));
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_autolog_link_payment ON public.payment_link_payments;
CREATE TRIGGER trg_autolog_link_payment
AFTER INSERT OR UPDATE ON public.payment_link_payments
FOR EACH ROW EXECUTE FUNCTION public.autolog_link_payment();