DROP POLICY IF EXISTS "users insert own role" ON public.user_roles;
DROP POLICY IF EXISTS "users update own role" ON public.user_roles;
DROP POLICY IF EXISTS "users delete own role" ON public.user_roles;
DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;
CREATE POLICY "admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "anyone authed reads config" ON public.platform_config;
DROP POLICY IF EXISTS "admins read config" ON public.platform_config;
CREATE POLICY "admins read config" ON public.platform_config
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "kyc users update own" ON storage.objects;
CREATE POLICY "kyc users update own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'kyc' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'kyc' AND (storage.foldername(name))[1] = auth.uid()::text);