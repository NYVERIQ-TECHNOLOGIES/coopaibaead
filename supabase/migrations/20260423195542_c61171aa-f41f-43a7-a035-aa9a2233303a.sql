-- =====================================================================
-- Restringir SELECT em course_modules / course_lessons / course_evaluations
-- ao acesso real ao curso (respeitando cooperado_only)
-- =====================================================================

-- MODULES
DROP POLICY IF EXISTS "Anyone authenticated can view modules" ON public.course_modules;
CREATE POLICY "View modules respecting course access"
ON public.course_modules
FOR SELECT
TO authenticated
USING (public.can_access_course(auth.uid(), course_id));

-- LESSONS (joined via module -> course)
DROP POLICY IF EXISTS "Anyone authenticated can view lessons" ON public.course_lessons;
CREATE POLICY "View lessons respecting course access"
ON public.course_lessons
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.course_modules m
    WHERE m.id = course_lessons.module_id
      AND public.can_access_course(auth.uid(), m.course_id)
  )
);

-- EVALUATIONS
DROP POLICY IF EXISTS "Anyone authenticated can view evaluations" ON public.course_evaluations;
CREATE POLICY "View evaluations respecting course access"
ON public.course_evaluations
FOR SELECT
TO authenticated
USING (public.can_access_course(auth.uid(), course_id));