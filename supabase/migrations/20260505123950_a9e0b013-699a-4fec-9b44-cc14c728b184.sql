-- 1) Attach evaluations (quizzes) to specific lessons
ALTER TABLE public.course_evaluations
  ADD COLUMN IF NOT EXISTS lesson_id uuid NULL;

CREATE INDEX IF NOT EXISTS idx_course_evaluations_lesson_id
  ON public.course_evaluations(lesson_id);

-- 2) Continue where you left off
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS last_accessed_lesson_id uuid NULL,
  ADD COLUMN IF NOT EXISTS last_accessed_at timestamptz NULL;

-- 3) Secure RPC so a user can mark their own progress on a lesson
CREATE OR REPLACE FUNCTION public.mark_lesson_access(_course_id uuid, _lesson_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- The lesson must belong to the given course
  IF NOT EXISTS (
    SELECT 1
    FROM public.course_lessons l
    JOIN public.course_modules m ON m.id = l.module_id
    WHERE l.id = _lesson_id AND m.course_id = _course_id
  ) THEN
    RAISE EXCEPTION 'Lesson does not belong to course';
  END IF;

  -- The user must have access to the course
  IF NOT public.can_access_course(auth.uid(), _course_id) THEN
    RAISE EXCEPTION 'Not enrolled in course';
  END IF;

  UPDATE public.enrollments
  SET last_accessed_lesson_id = _lesson_id,
      last_accessed_at = now(),
      updated_at = now()
  WHERE user_id = auth.uid() AND course_id = _course_id;
END;
$$;