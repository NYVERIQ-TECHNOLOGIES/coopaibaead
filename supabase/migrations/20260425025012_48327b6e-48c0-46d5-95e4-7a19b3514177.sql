-- =========================================================
-- 1) evaluation_questions: allow enrolled users to SELECT questions,
--    but hide the `correct_option` column from non-admins.
-- =========================================================

-- Add SELECT policy for enrolled (course-access) users
DROP POLICY IF EXISTS "Enrolled users can view questions" ON public.evaluation_questions;
CREATE POLICY "Enrolled users can view questions"
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

-- Revoke column-level access to correct_option from authenticated users.
-- Admins use the existing "Admins can view questions with answers" SELECT
-- policy and read correct_option via SECURITY DEFINER RPCs / has_role checks.
REVOKE SELECT (correct_option) ON public.evaluation_questions FROM authenticated;
REVOKE SELECT (correct_option) ON public.evaluation_questions FROM anon;

-- Provide a safe view that excludes correct_option (idempotent recreate)
DROP VIEW IF EXISTS public.public_evaluation_questions;
CREATE VIEW public.public_evaluation_questions
WITH (security_invoker = true)
AS
SELECT
  id,
  evaluation_id,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  sort_order,
  created_at,
  updated_at
FROM public.evaluation_questions;

GRANT SELECT ON public.public_evaluation_questions TO authenticated;

-- =========================================================
-- 2) Realtime forum:topic:<id> channel — require admin, topic author,
--    or active course enrollment. Removes the open "course_id IS NULL"
--    path that broadcast all general forum activity to every user.
-- =========================================================

DROP POLICY IF EXISTS "realtime_forum_topic_select" ON realtime.messages;

CREATE POLICY "realtime_forum_topic_select"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (realtime.topic() LIKE 'forum:topic:%')
  AND EXISTS (
    SELECT 1 FROM public.forum_topics ft
    WHERE ft.id::text = split_part(realtime.topic(), ':', 3)
      AND (
        public.has_role(auth.uid(), 'admin')
        OR ft.user_id = auth.uid()
        OR (ft.course_id IS NOT NULL AND public.can_access_course(auth.uid(), ft.course_id))
      )
  )
);