CREATE POLICY "Admins can read catalog media for signing"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'product-media'
  AND public.is_admin(auth.uid())
);