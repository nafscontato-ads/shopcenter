ALTER TABLE public.shopee_listings
ADD COLUMN IF NOT EXISTS video_url text;

COMMENT ON COLUMN public.shopee_listings.video_url IS 'Optional private signed URL for a customer-uploaded MP4 product video.';

CREATE POLICY "Users read own Shopee media"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'shopee-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users upload own Shopee media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'shopee-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users update own Shopee media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'shopee-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'shopee-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users delete own Shopee media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'shopee-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);