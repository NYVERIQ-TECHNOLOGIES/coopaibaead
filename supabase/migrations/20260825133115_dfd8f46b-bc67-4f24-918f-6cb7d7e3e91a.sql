ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

DROP POLICY IF EXISTS "View courses respecting cooperado flag" ON public.courses;
CREATE POLICY "View courses respecting cooperado flag" ON public.courses
FOR SELECT TO authenticated
USING (
  (is_active OR has_role(auth.uid(), 'admin'::app_role))
  AND (
    (NOT cooperado_only)
    OR has_role(auth.uid(), 'cooperado'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);