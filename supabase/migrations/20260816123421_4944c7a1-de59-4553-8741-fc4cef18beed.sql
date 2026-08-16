CREATE TABLE IF NOT EXISTS public.sms_sender_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    company_name TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    admin_note TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_sender_requests TO authenticated;
GRANT ALL ON public.sms_sender_requests TO service_role;

ALTER TABLE public.sms_sender_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sender requests" 
ON public.sms_sender_requests FOR SELECT 
TO authenticated 
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create their own sender requests" 
ON public.sms_sender_requests FOR INSERT 
TO authenticated 
WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.sms_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL,
    balance INTEGER DEFAULT 0,
    total_purchased INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(business_id, sender_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_credits TO authenticated;
GRANT ALL ON public.sms_credits TO service_role;

ALTER TABLE public.sms_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owners can view their SMS credits" 
ON public.sms_credits FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.businesses 
    WHERE id = sms_credits.business_id AND owner_id = auth.uid()
  ) OR public.has_role(auth.uid(), 'admin')
);
