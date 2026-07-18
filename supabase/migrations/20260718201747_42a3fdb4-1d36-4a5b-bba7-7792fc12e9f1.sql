
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS description text;

CREATE TABLE IF NOT EXISTS public.sms_sender_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  sender_id text NOT NULL,
  usage_note text,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_sender_requests TO authenticated;
GRANT ALL ON public.sms_sender_requests TO service_role;
ALTER TABLE public.sms_sender_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own sender requests" ON public.sms_sender_requests;
CREATE POLICY "own sender requests" ON public.sms_sender_requests
  FOR ALL USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.sms_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  sender_id text NOT NULL,
  balance integer NOT NULL DEFAULT 0,
  total_purchased integer NOT NULL DEFAULT 0,
  total_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(business_id, sender_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_credits TO authenticated;
GRANT ALL ON public.sms_credits TO service_role;
ALTER TABLE public.sms_credits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "business sms credits" ON public.sms_credits;
CREATE POLICY "business sms credits" ON public.sms_credits
  FOR ALL USING (
    EXISTS(SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_id = auth.uid())
    OR public.has_role(auth.uid(),'admin')
  ) WITH CHECK (
    EXISTS(SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_id = auth.uid())
    OR public.has_role(auth.uid(),'admin')
  );

-- Storage policies pour shop-media (bucket privé mais lecture ouverte)
DROP POLICY IF EXISTS "shop-media read" ON storage.objects;
CREATE POLICY "shop-media read" ON storage.objects FOR SELECT USING (bucket_id = 'shop-media');
DROP POLICY IF EXISTS "shop-media owner insert" ON storage.objects;
CREATE POLICY "shop-media owner insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'shop-media' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "shop-media owner update" ON storage.objects;
CREATE POLICY "shop-media owner update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'shop-media' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "shop-media owner delete" ON storage.objects;
CREATE POLICY "shop-media owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'shop-media' AND (storage.foldername(name))[1] = auth.uid()::text);
