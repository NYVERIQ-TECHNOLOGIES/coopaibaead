
-- 1) BUCKET DE MÍDIA: tornar privado
UPDATE storage.buckets SET public = false WHERE id = 'media';

DROP POLICY IF EXISTS "Public read media" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload media" ON storage.objects;
DROP POLICY IF EXISTS "Anyone authenticated can upload media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete media" ON storage.objects;
DROP POLICY IF EXISTS "media_select" ON storage.objects;
DROP POLICY IF EXISTS "media_insert" ON storage.objects;
DROP POLICY IF EXISTS "media_update" ON storage.objects;
DROP POLICY IF EXISTS "media_delete" ON storage.objects;
DROP POLICY IF EXISTS "media_authenticated_read" ON storage.objects;
DROP POLICY IF EXISTS "media_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "media_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "media_admin_delete" ON storage.objects;

CREATE POLICY "media_authenticated_read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'media');

CREATE POLICY "media_admin_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "media_admin_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "media_admin_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'media' AND public.has_role(auth.uid(), 'admin'));

-- 2) AVATARS
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
DROP POLICY IF EXISTS "avatars_user_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_user_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_user_delete" ON storage.objects;
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;

CREATE POLICY "avatars_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "avatars_user_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

CREATE POLICY "avatars_user_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

CREATE POLICY "avatars_user_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

-- 3) ENROLLMENTS
DROP POLICY IF EXISTS "Users can self-enroll" ON public.enrollments;
DROP POLICY IF EXISTS "Users can update own enrollment progress" ON public.enrollments;

CREATE POLICY "Users can self-enroll"
ON public.enrollments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own enrollment progress"
ON public.enrollments FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS enrollments_user_course_unique
ON public.enrollments (user_id, course_id);

-- 4) MFA
CREATE TABLE IF NOT EXISTS public.user_mfa_factors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  factor_id uuid NOT NULL,
  friendly_name text,
  factor_type text NOT NULL DEFAULT 'totp',
  verified_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, factor_id)
);

ALTER TABLE public.user_mfa_factors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own mfa" ON public.user_mfa_factors;
DROP POLICY IF EXISTS "Users insert own mfa" ON public.user_mfa_factors;
DROP POLICY IF EXISTS "Users delete own mfa" ON public.user_mfa_factors;
DROP POLICY IF EXISTS "Admins view all mfa" ON public.user_mfa_factors;

CREATE POLICY "Users view own mfa"
ON public.user_mfa_factors FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own mfa"
ON public.user_mfa_factors FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own mfa"
ON public.user_mfa_factors FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all mfa"
ON public.user_mfa_factors FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
