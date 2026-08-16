-- Disable existing policy if it exists and create a new one that allows the service role
-- to manage OTPs. Actually, RLS usually doesn't block the service role, but 
-- let's make sure the table has proper grants.

GRANT ALL ON public.user_otp TO authenticated;
GRANT ALL ON public.user_otp TO service_role;
GRANT ALL ON public.user_otp TO anon;

-- Ensure RLS is enabled but doesn't block the function (using SECURITY DEFINER usually bypasses)
ALTER TABLE public.user_otp ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only see their own OTPs" ON public.user_otp;
CREATE POLICY "Service role can manage all OTPs" ON public.user_otp
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users can manage their own OTPs" ON public.user_otp
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Also allow anon to read/insert if needed during registration
CREATE POLICY "Anon can insert OTPs" ON public.user_otp
  FOR INSERT TO anon WITH CHECK (true);
