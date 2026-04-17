DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Avatar images are publicly accessible'
  ) THEN
    DROP POLICY "Avatar images are publicly accessible" ON storage.objects;
  END IF;

  CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'avatars'
    AND (
      auth.role() = 'authenticated'
      OR auth.role() = 'anon'
    )
  );
END $$;