
CREATE TABLE public.momo_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_operator TEXT NOT NULL,
  source_phone TEXT NOT NULL,
  dest_operator TEXT NOT NULL,
  dest_phone TEXT NOT NULL,
  dest_holder TEXT,
  amount_send NUMERIC(14,2) NOT NULL,
  fees_xof NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_charged_xof NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XOF',
  status TEXT NOT NULL DEFAULT 'awaiting_payment',
  payment_reference TEXT UNIQUE,
  payment_intent_id TEXT,
  checkout_url TEXT,
  cashout_ref TEXT,
  cashout_response JSONB,
  paid_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  admin_note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.momo_transfers TO authenticated;
GRANT ALL ON public.momo_transfers TO service_role;
ALTER TABLE public.momo_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own transfers r" ON public.momo_transfers FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own transfers i" ON public.momo_transfers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin transfers u" ON public.momo_transfers FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER momo_transfers_updated_at BEFORE UPDATE ON public.momo_transfers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX momo_transfers_user_idx ON public.momo_transfers(user_id, created_at DESC);
CREATE INDEX momo_transfers_status_idx ON public.momo_transfers(status);

INSERT INTO public.platform_config(key, value) VALUES
  ('momo_transfer_fee_bps', to_jsonb(150)),
  ('momo_transfer_fee_flat_xof', to_jsonb(100)),
  ('momo_transfer_min_xof', to_jsonb(500)),
  ('momo_transfer_max_xof', to_jsonb(500000)),
  ('momo_transfer_enabled', to_jsonb(true))
ON CONFLICT (key) DO NOTHING;
