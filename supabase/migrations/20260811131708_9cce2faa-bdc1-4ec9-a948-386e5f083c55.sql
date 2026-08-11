ALTER TABLE public.products ALTER COLUMN project_id DROP NOT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS show_in_shop boolean NOT NULL DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url text;

CREATE TABLE IF NOT EXISTS public.project_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'live',
  public_key text NOT NULL UNIQUE,
  secret_prefix text NOT NULL,
  secret_hash text NOT NULL UNIQUE,
  webhook_url text,
  webhook_secret text NOT NULL,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_api_keys_project_idx ON public.project_api_keys(project_id);
GRANT ALL ON public.project_api_keys TO service_role;
ALTER TABLE public.project_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no direct client access to project api keys"
ON public.project_api_keys FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE TRIGGER trg_project_api_keys_upd BEFORE UPDATE ON public.project_api_keys
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.project_webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  event text NOT NULL,
  url text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status_code integer,
  response_body text,
  success boolean NOT NULL DEFAULT false,
  simulated boolean NOT NULL DEFAULT false,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_webhook_deliveries_project_idx ON public.project_webhook_deliveries(project_id, created_at DESC);
GRANT ALL ON public.project_webhook_deliveries TO service_role;
ALTER TABLE public.project_webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads project webhook deliveries"
ON public.project_webhook_deliveries FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = project_webhook_deliveries.business_id AND b.owner_id = auth.uid()));
GRANT SELECT ON public.project_webhook_deliveries TO authenticated;