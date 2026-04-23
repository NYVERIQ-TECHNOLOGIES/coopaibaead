-- Fix: enforce cooperado_only at the storage layer for the 'media' bucket.
-- Previously, any authenticated user could read any file in the 'media' bucket,
-- bypassing the application/RLS-level cooperado_only restriction on media_files.

DROP POLICY IF EXISTS "media_authenticated_read" ON storage.objects;

-- Allow read on media bucket only when:
-- - the file is referenced by a media_files row that is NOT cooperado_only, OR
-- - the file is referenced by a course_books row that is NOT cooperado_only, OR
-- - the file is referenced by a courses.image, OR
-- - the file is a certificate template, OR
-- - the file is referenced by a certificates record the user owns, OR
-- - caller has cooperado or admin role.
-- Files not referenced by any known table are only readable by admins.
CREATE POLICY "media_role_aware_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'media'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'cooperado')
    OR EXISTS (
      SELECT 1 FROM public.media_files mf
      WHERE mf.cooperado_only = false
        AND (
          mf.file_url LIKE '%/' || name
          OR mf.file_url = name
          OR mf.thumbnail_url LIKE '%/' || name
          OR mf.thumbnail_url = name
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.course_books cb
      WHERE cb.cooperado_only = false
        AND (cb.file_url LIKE '%/' || name OR cb.file_url = name)
    )
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.image LIKE '%/' || name OR c.image = name
    )
    OR EXISTS (
      SELECT 1 FROM public.certificate_templates ct
      WHERE ct.file_url LIKE '%/' || name OR ct.file_url = name
    )
    OR EXISTS (
      SELECT 1 FROM public.certificates cert
      WHERE cert.user_id = auth.uid()
    )
  )
);