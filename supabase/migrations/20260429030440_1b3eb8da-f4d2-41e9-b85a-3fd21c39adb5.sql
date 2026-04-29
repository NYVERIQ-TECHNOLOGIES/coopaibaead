CREATE POLICY "Moderators can view all certificates"
ON public.certificates FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'moderador'));

CREATE POLICY "Moderators can view all enrollments"
ON public.enrollments FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'moderador'));

CREATE POLICY "Moderators view all courses"
ON public.courses FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'moderador'));