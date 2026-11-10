ALTER TABLE public.products ADD COLUMN IF NOT EXISTS video_url text;

DROP POLICY IF EXISTS "Admins can upload product media" ON storage.objects;
CREATE POLICY "Admins can upload product media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-media'
  AND public.is_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can update product media" ON storage.objects;
CREATE POLICY "Admins can update product media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-media'
  AND public.is_admin(auth.uid())
)
WITH CHECK (
  bucket_id = 'product-media'
  AND public.is_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete product media" ON storage.objects;
CREATE POLICY "Admins can delete product media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-media'
  AND public.is_admin(auth.uid())
);