-- RPC to reset a user's progress for a single course (used when failing prova final 3x)
CREATE OR REPLACE FUNCTION public.reset_course_progress(_course_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Delete lesson completions for lessons in this course
  DELETE FROM public.lesson_completions lc
  USING public.course_lessons l
  JOIN public.course_modules m ON m.id = l.module_id
  WHERE lc.lesson_id = l.id
    AND m.course_id = _course_id
    AND lc.user_id = _uid;

  -- Delete exam attempts for evaluations in this course
  DELETE FROM public.exam_attempts ea
  USING public.course_evaluations ce
  WHERE ea.evaluation_id = ce.id
    AND ce.course_id = _course_id
    AND ea.user_id = _uid;

  -- Reset enrollment progress
  UPDATE public.enrollments
  SET progress = 0, status = 'ativo', updated_at = now()
  WHERE user_id = _uid AND course_id = _course_id;
END;
$$;