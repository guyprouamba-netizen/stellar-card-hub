
CREATE POLICY "accounting attachments read own"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'accounting-attachments'
  AND EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id::text = split_part(name, '/', 1)
      AND (b.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  )
);
CREATE POLICY "accounting attachments write own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'accounting-attachments'
  AND EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id::text = split_part(name, '/', 1)
      AND (b.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  )
);
CREATE POLICY "accounting attachments delete own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'accounting-attachments'
  AND EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id::text = split_part(name, '/', 1)
      AND (b.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  )
);
