DROP POLICY IF EXISTS "media_role_aware_read" ON storage.objects;

CREATE POLICY "media_role_aware_read"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'media'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.media_files mf
      WHERE ((mf.file_url LIKE ('%/' || objects.name))
             OR (mf.file_url = objects.name)
             OR (mf.thumbnail_url LIKE ('%/' || objects.name))
             OR (mf.thumbnail_url = objects.name))
        AND ((NOT mf.cooperado_only) OR public.has_role(auth.uid(), 'cooperado'::public.app_role))
    )
    OR EXISTS (
      SELECT 1 FROM public.course_books cb
      WHERE ((cb.file_url LIKE ('%/' || objects.name))
             OR (cb.file_url = objects.name))
        AND public.can_access_course(auth.uid(), cb.course_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE ((c.image LIKE ('%/' || objects.name))
             OR (c.image = objects.name))
        AND ((NOT c.cooperado_only) OR public.has_role(auth.uid(), 'cooperado'::public.app_role))
    )
    OR EXISTS (
      SELECT 1 FROM public.certificate_templates ct
      WHERE ct.active = true
        AND ((ct.file_url LIKE ('%/' || objects.name))
             OR (ct.file_url = objects.name))
    )
    OR EXISTS (
      SELECT 1
      FROM public.course_lessons cl
      JOIN public.course_modules cm ON cm.id = cl.module_id
      WHERE ((cl.content_url LIKE ('%/' || objects.name))
             OR (cl.content_url = objects.name))
        AND public.can_access_course(auth.uid(), cm.course_id)
    )
  )
);