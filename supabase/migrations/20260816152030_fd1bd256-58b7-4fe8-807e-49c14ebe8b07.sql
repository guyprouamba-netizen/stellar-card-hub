GRANT ALL ON public.user_otp TO authenticated, anon, service_role;
ALTER TABLE public.user_otp ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only see their own OTPs" ON public.user_otp;
CREATE POLICY "Enable all for all for now" ON public.user_otp FOR ALL USING (true) WITH CHECK (true);
