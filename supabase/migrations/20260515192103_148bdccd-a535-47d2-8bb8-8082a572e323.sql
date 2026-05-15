
-- 1. Revoke column-level SELECT on sensitive columns
REVOKE SELECT (correct_option) ON public.evaluation_questions FROM authenticated, anon;
REVOKE SELECT (password_hash) ON public.cooperado_pending_registrations FROM authenticated, anon;

-- 2. Forum topics: enforce course access on INSERT when course_id present
DROP POLICY IF EXISTS "Users can create topics" ON public.forum_topics;
CREATE POLICY "Users can create topics"
ON public.forum_topics
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    course_id IS NULL
    OR public.can_access_course(auth.uid(), course_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- 3. Forum replies: enforce course access on INSERT when topic is course-gated
DROP POLICY IF EXISTS "Users can create replies" ON public.forum_replies;
CREATE POLICY "Users can create replies"
ON public.forum_replies
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.forum_topics ft
    WHERE ft.id = forum_replies.topic_id
      AND (
        ft.course_id IS NULL
        OR public.can_access_course(auth.uid(), ft.course_id)
        OR public.has_role(auth.uid(), 'admin'::app_role)
      )
      AND ft.closed = false
  )
);

-- 4. exam_attempts: hide the answers column from non-admin users
REVOKE SELECT (answers) ON public.exam_attempts FROM authenticated, anon;
