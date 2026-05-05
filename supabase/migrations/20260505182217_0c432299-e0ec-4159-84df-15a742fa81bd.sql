
-- 1. Hide correct_option from clients. Replace SELECT policy with admin-only.
DROP POLICY IF EXISTS "Enrolled users can view questions" ON public.evaluation_questions;
-- Admins keep their existing "Admins can manage questions" (ALL) and "Admins can view questions with answers" policies.
-- Enrolled students must use the public.evaluation_questions_safe view (which omits correct_option).

-- Make sure the safe view is usable by authenticated users (security_invoker view checks RLS on base table,
-- so we add a permissive policy that only exposes rows but never the correct_option column via the view).
-- Re-create a SELECT policy that allows enrolled users to read rows (column-level safety enforced by the view).
CREATE POLICY "Enrolled users can view questions via safe view"
ON public.evaluation_questions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.course_evaluations ce
    WHERE ce.id = evaluation_questions.evaluation_id
      AND public.can_access_course(auth.uid(), ce.course_id)
  )
);

-- Revoke direct column access to correct_option for non-admins via column privileges.
REVOKE SELECT ON public.evaluation_questions FROM authenticated, anon;
GRANT SELECT (id, evaluation_id, question_text, option_a, option_b, option_c, option_d, sort_order, created_at, updated_at)
  ON public.evaluation_questions TO authenticated;

-- 2. Tighten course_books SELECT to require enrollment.
DROP POLICY IF EXISTS "View books respecting cooperado flag" ON public.course_books;
CREATE POLICY "View books respecting enrollment and cooperado flag"
ON public.course_books
FOR SELECT
TO authenticated
USING (
  ((NOT cooperado_only) OR public.has_role(auth.uid(), 'cooperado'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))
  AND public.can_access_course(auth.uid(), course_id)
);

-- 3. Tighten realtime forum reply INSERT: drop topic-author shortcut for course-linked topics.
DROP POLICY IF EXISTS realtime_forum_reply_insert ON realtime.messages;
CREATE POLICY realtime_forum_reply_insert
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  (realtime.topic() LIKE 'forum:reply:%')
  AND EXISTS (
    SELECT 1 FROM public.forum_topics ft
    WHERE ft.id::text = split_part(realtime.topic(), ':', 3)
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR ft.course_id IS NULL
        OR public.can_access_course(auth.uid(), ft.course_id)
      )
  )
);
