
-- Storage policies for business-media bucket (private bucket, served via signed URLs)
CREATE POLICY "biz media read all" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'business-media');
CREATE POLICY "biz media insert own folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'business-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "biz media update own folder" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'business-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "biz media delete own folder" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'business-media' AND (storage.foldername(name))[1] = auth.uid()::text);
