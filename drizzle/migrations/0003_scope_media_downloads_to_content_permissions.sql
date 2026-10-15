CREATE OR REPLACE FUNCTION public.media_storage_path(_reference text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = public
AS $function$
  SELECT CASE
    WHEN _reference ~ '^https?://' THEN
      CASE WHEN _reference ~ '^https?://[^/]+/storage/v1/object/(public|sign)/media/'
        THEN split_part(regexp_replace(_reference, '^https?://[^/]+/storage/v1/object/(public|sign)/media/', ''), '?', 1)
        ELSE NULL
      END
    ELSE _reference
  END
$function$;
REVOKE ALL ON FUNCTION public.media_storage_path(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.media_storage_path(text) TO authenticated, service_role;

ALTER POLICY media_role_aware_read ON storage.objects
TO authenticated
USING (
  bucket_id = 'media'
  AND (SELECT auth.uid()) IS NOT NULL
  AND (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.media_files mf
      WHERE (
        public.media_storage_path(mf.file_url) = objects.name
        OR public.media_storage_path(mf.thumbnail_url) = objects.name
      )
      AND (NOT mf.cooperado_only OR public.has_role((SELECT auth.uid()), 'cooperado'::public.app_role))
      AND (
        mf.uploaded_by = (SELECT auth.uid())
        OR CASE
          WHEN mf.course_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            THEN public.can_access_course((SELECT auth.uid()), mf.course_id::uuid)
          ELSE true
        END
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.course_books cb
      WHERE public.media_storage_path(cb.file_url) = objects.name
        AND (NOT cb.cooperado_only OR public.has_role((SELECT auth.uid()), 'cooperado'::public.app_role))
        AND (public.can_access_course((SELECT auth.uid()), cb.course_id)
          OR public.owns_course((SELECT auth.uid()), cb.course_id))
    )
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE public.media_storage_path(c.image) = objects.name
    )
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE public.media_storage_path(c.intro_video_url) = objects.name
    )
    OR EXISTS (
      SELECT 1 FROM public.course_lessons cl
      JOIN public.course_modules cm ON cm.id = cl.module_id
      WHERE public.media_storage_path(cl.content_url) = objects.name
        AND (public.can_access_course((SELECT auth.uid()), cm.course_id)
          OR public.owns_course((SELECT auth.uid()), cm.course_id))
    )
  )
);
COMMENT ON POLICY media_role_aware_read ON storage.objects IS 'Downloads require an exact reference to content visible through its RLS policies and caller-specific course/cooperative permissions. Catalog covers and introductory videos remain shared. Certificate templates and unreferenced objects are admin-only.';
COMMENT ON FUNCTION public.media_storage_path(text) IS 'Exact media object reference normalization; no wildcard suffix matching and no authorization bypass.';