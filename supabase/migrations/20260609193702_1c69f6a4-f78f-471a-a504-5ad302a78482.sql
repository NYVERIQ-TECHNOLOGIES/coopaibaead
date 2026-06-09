
-- 1. Lock down evaluation answer keys: make safe view bypass RLS with built-in access check, then drop student SELECT on base table
CREATE OR REPLACE VIEW public.evaluation_questions_safe
WITH (security_invoker = false) AS
SELECT eq.id, eq.evaluation_id, eq.question_text,
       eq.option_a, eq.option_b, eq.option_c, eq.option_d,
       eq.sort_order, eq.created_at, eq.updated_at
FROM public.evaluation_questions eq
WHERE public.has_role(auth.uid(), 'admin'::public.app_role)
   OR EXISTS (
        SELECT 1 FROM public.course_evaluations ce
        WHERE ce.id = eq.evaluation_id
          AND public.can_access_course(auth.uid(), ce.course_id)
      );

GRANT SELECT ON public.evaluation_questions_safe TO authenticated;

DROP POLICY IF EXISTS "Enrolled users can view questions via safe view" ON public.evaluation_questions;

-- 2. Remove password_hash from pending registrations (no longer used; temp password generated at approval)
ALTER TABLE public.cooperado_pending_registrations DROP COLUMN IF EXISTS password_hash;

-- 3. Make intent explicit: block any client INSERT on pending registrations (service role bypasses RLS)
CREATE POLICY "No client inserts on pending registrations"
  ON public.cooperado_pending_registrations
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (false);
