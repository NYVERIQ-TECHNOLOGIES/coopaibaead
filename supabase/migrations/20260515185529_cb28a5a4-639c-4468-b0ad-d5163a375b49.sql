
-- 1) evaluation_questions: drop the policy that exposed correct_option to enrolled users.
-- Students must use evaluation_questions_safe view (security_invoker=true) which selects only safe columns.
-- Since the view is security_invoker, it runs under the caller's policies. We need a SELECT policy
-- that allows access but the view does not select correct_option. However, RLS applies to the table,
-- not view columns. So enrolled users still get rows via the view; we just hide the column at the view
-- level. To prevent direct SELECT of correct_option, we keep the existing policy but force usage via view
-- by revoking column-level SELECT on correct_option from authenticated.
DROP POLICY IF EXISTS "Enrolled users can view questions via safe view" ON public.evaluation_questions;

-- Recreate policy but it remains needed for the view to read rows under security_invoker
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

-- Revoke direct column SELECT on correct_option for authenticated; admins still get it via the
-- "Admins can view questions with answers" policy + table-level grants.
REVOKE SELECT (correct_option) ON public.evaluation_questions FROM authenticated;

-- 2) submit_exam_answers: enforce 3-attempt cap server-side for "prova"
CREATE OR REPLACE FUNCTION public.submit_exam_answers(_evaluation_id uuid, _answers jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _total integer := 0;
  _correct integer := 0;
  _score numeric(5,2);
  _attempt_id uuid;
  _q record;
  _given text;
  _course_id uuid;
  _eval_type text;
  _attempt_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT ce.course_id, ce.type INTO _course_id, _eval_type
  FROM public.course_evaluations ce
  WHERE ce.id = _evaluation_id;

  IF _course_id IS NULL THEN
    RAISE EXCEPTION 'Evaluation not found';
  END IF;

  IF NOT public.can_access_course(auth.uid(), _course_id) THEN
    RAISE EXCEPTION 'Not enrolled in course';
  END IF;

  IF _eval_type = 'prova' THEN
    SELECT COUNT(*) INTO _attempt_count
    FROM public.exam_attempts
    WHERE user_id = auth.uid() AND evaluation_id = _evaluation_id;
    IF _attempt_count >= 3 THEN
      RAISE EXCEPTION 'Maximum attempts exceeded';
    END IF;
  END IF;

  FOR _q IN
    SELECT id, correct_option FROM public.evaluation_questions
    WHERE evaluation_id = _evaluation_id
  LOOP
    _total := _total + 1;
    _given := lower(coalesce(_answers->>(_q.id::text), ''));
    IF _given = lower(_q.correct_option) THEN
      _correct := _correct + 1;
    END IF;
  END LOOP;

  IF _total = 0 THEN
    _score := 0;
  ELSE
    _score := round((_correct::numeric / _total::numeric) * 100, 2);
  END IF;

  INSERT INTO public.exam_attempts
    (user_id, evaluation_id, score, total_questions, correct_count, answers)
  VALUES
    (auth.uid(), _evaluation_id, _score, _total, _correct, _answers)
  RETURNING id INTO _attempt_id;

  RETURN jsonb_build_object(
    'attempt_id', _attempt_id,
    'score', _score,
    'total', _total,
    'correct', _correct
  );
END;
$function$;

-- 3) cooperado_pending_registrations: revoke column-level SELECT/UPDATE on password_hash for authenticated
REVOKE SELECT (password_hash), UPDATE (password_hash) ON public.cooperado_pending_registrations FROM authenticated;

-- 5) forum_topics & forum_replies: restrict reads on course-linked content to users with course access
DROP POLICY IF EXISTS "Anyone can read topics" ON public.forum_topics;
CREATE POLICY "Read topics respecting course access"
ON public.forum_topics
FOR SELECT
TO authenticated
USING (
  course_id IS NULL
  OR public.can_access_course(auth.uid(), course_id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Anyone can read replies" ON public.forum_replies;
CREATE POLICY "Read replies respecting topic course access"
ON public.forum_replies
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.forum_topics ft
    WHERE ft.id = forum_replies.topic_id
      AND (
        ft.course_id IS NULL
        OR public.can_access_course(auth.uid(), ft.course_id)
        OR public.has_role(auth.uid(), 'admin'::app_role)
      )
  )
);

-- 6) realtime_forum_reply_insert: tighten authorship — only topic owner or admins may broadcast
DROP POLICY IF EXISTS "realtime_forum_reply_insert" ON realtime.messages;
CREATE POLICY "realtime_forum_reply_insert"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.forum_topics ft
    WHERE ft.id::text = (string_to_array(realtime.topic(), ':'))[2]
      AND ft.user_id = auth.uid()
  )
);

-- 7) exam_attempts INSERT: require enrollment/access to the evaluation's course
DROP POLICY IF EXISTS "Users can insert their own exam attempts" ON public.exam_attempts;
CREATE POLICY "Users can insert their own exam attempts"
ON public.exam_attempts
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.course_evaluations ce
    WHERE ce.id = exam_attempts.evaluation_id
      AND public.can_access_course(auth.uid(), ce.course_id)
  )
);
