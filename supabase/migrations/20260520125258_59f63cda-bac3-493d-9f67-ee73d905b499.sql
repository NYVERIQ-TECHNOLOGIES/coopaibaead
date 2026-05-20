-- 1) Remove permissive INSERT policy on signatures storage bucket.
-- Uploads to the 'assinaturas' bucket now happen exclusively via the
-- 'registrar-presenca' edge function using the service role key.
DROP POLICY IF EXISTS "Public can upload signatures" ON storage.objects;

-- 2) Restrict certificate_templates read access to admins only.
DROP POLICY IF EXISTS "Anyone authenticated can view active templates" ON public.certificate_templates;

CREATE POLICY "Admins can view templates"
ON public.certificate_templates
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));