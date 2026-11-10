REVOKE ALL ON public.influencers FROM anon;

DROP POLICY IF EXISTS "Guests manage unowned influencers" ON public.influencers;
DROP POLICY IF EXISTS "Owners manage their influencers" ON public.influencers;
DROP POLICY IF EXISTS "Admins read influencers" ON public.influencers;

CREATE POLICY "Owners manage their influencers"
  ON public.influencers
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins read influencers"
  ON public.influencers
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Read influencer images" ON storage.objects;
DROP POLICY IF EXISTS "Upload influencer images" ON storage.objects;
DROP POLICY IF EXISTS "Users read own influencer images" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own influencer images" ON storage.objects;
DROP POLICY IF EXISTS "Users update own influencer images" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own influencer images" ON storage.objects;

CREATE POLICY "Users read own influencer images"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'influencers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users upload own influencer images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'influencers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users update own influencer images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'influencers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'influencers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users delete own influencer images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'influencers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );