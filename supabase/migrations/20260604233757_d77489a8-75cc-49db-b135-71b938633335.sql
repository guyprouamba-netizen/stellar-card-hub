
-- Storage policies for the private 'kyc' bucket
CREATE POLICY "kyc users upload own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kyc' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "kyc users read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'kyc' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "kyc users delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'kyc' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "kyc admins read all" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'kyc' AND public.has_role(auth.uid(), 'admin'));
