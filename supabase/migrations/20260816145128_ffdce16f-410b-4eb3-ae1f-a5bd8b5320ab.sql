CREATE TABLE IF NOT EXISTS public.user_otp (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    phone text NOT NULL,
    code text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    purpose text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

GRANT ALL ON public.user_otp TO authenticated;
GRANT ALL ON public.user_otp TO service_role;
ALTER TABLE public.user_otp ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only see their own OTPs" ON public.user_otp FOR SELECT USING (auth.uid() = user_id);
