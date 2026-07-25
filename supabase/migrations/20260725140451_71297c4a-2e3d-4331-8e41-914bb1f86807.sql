-- 1) Preserve certificates when a course is deleted
ALTER TABLE public.certificates ALTER COLUMN course_id DROP NOT NULL;
ALTER TABLE public.certificates DROP CONSTRAINT IF EXISTS certificates_course_id_fkey;
ALTER TABLE public.certificates
  ADD CONSTRAINT certificates_course_id_fkey
  FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE SET NULL;

-- 2) Archive table for completed enrollments
CREATE TABLE IF NOT EXISTS public.archived_course_completions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  original_course_id uuid NOT NULL,
  course_title text NOT NULL,
  course_duration text,
  student_name text,
  progress integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'concluido',
  enrolled_at timestamp with time zone,
  completed_at timestamp with time zone,
  archived_at timestamp with time zone NOT NULL DEFAULT now(),
  archived_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.archived_course_completions TO authenticated;
GRANT DELETE ON public.archived_course_completions TO authenticated;
GRANT ALL ON public.archived_course_completions TO service_role;

ALTER TABLE public.archived_course_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own archived completions"
ON public.archived_course_completions FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Staff can view all archived completions"
ON public.archived_course_completions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderador'));

CREATE POLICY "Admins can delete archived completions"
ON public.archived_course_completions FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_archived_course_completions_updated_at
BEFORE UPDATE ON public.archived_course_completions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Delete course with optional preservation of student history
CREATE OR REPLACE FUNCTION public.delete_course_with_options(_course_id uuid, _preserve_history boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _course public.courses%ROWTYPE;
  _archived integer := 0;
  _certs integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO _course FROM public.courses WHERE id = _course_id;
  IF _course.id IS NULL THEN
    RAISE EXCEPTION 'Curso não encontrado';
  END IF;

  IF _preserve_history THEN
    -- Backfill certificate snapshots so they stay readable without the course row
    UPDATE public.certificates c
    SET course_title_snapshot = COALESCE(c.course_title_snapshot, _course.title),
        course_duration_snapshot = COALESCE(c.course_duration_snapshot, _course.duration),
        student_name_snapshot = COALESCE(c.student_name_snapshot, p.full_name),
        student_cpf_snapshot = COALESCE(c.student_cpf_snapshot, p.cpf),
        enrollment_number_snapshot = COALESCE(c.enrollment_number_snapshot, p.enrollment_number),
        cooperativa_snapshot = COALESCE(c.cooperativa_snapshot, p.cooperativa),
        updated_at = now()
    FROM public.profiles p
    WHERE c.course_id = _course_id AND p.user_id = c.user_id;

    SELECT count(*) INTO _certs FROM public.certificates WHERE course_id = _course_id;

    -- Archive completed enrollments
    WITH ins AS (
      INSERT INTO public.archived_course_completions (
        user_id, original_course_id, course_title, course_duration, student_name,
        progress, status, enrolled_at, completed_at, archived_by
      )
      SELECT e.user_id, _course_id, _course.title, _course.duration, p.full_name,
             e.progress, e.status, e.enrolled_at, e.updated_at, auth.uid()
      FROM public.enrollments e
      LEFT JOIN public.profiles p ON p.user_id = e.user_id
      WHERE e.course_id = _course_id
        AND (e.status = 'concluido' OR e.progress >= 100)
      RETURNING 1
    )
    SELECT count(*) INTO _archived FROM ins;
  ELSE
    DELETE FROM public.certificates WHERE course_id = _course_id;
  END IF;

  DELETE FROM public.courses WHERE id = _course_id;

  RETURN jsonb_build_object(
    'preserved', _preserve_history,
    'archived_completions', _archived,
    'preserved_certificates', CASE WHEN _preserve_history THEN _certs ELSE 0 END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_course_with_options(uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_course_with_options(uuid, boolean) TO authenticated;

-- 4) Certificate validation keeps working after course deletion
CREATE OR REPLACE FUNCTION public.validate_certificate(_code text)
RETURNS TABLE(code text, status text, issued_at timestamp with time zone, student_name text, course_title text, course_duration text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.code,
    c.status,
    c.issued_at,
    COALESCE(c.student_name_snapshot, p.full_name) AS student_name,
    COALESCE(co.title, c.course_title_snapshot) AS course_title,
    COALESCE(co.duration, c.course_duration_snapshot) AS course_duration
  FROM public.certificates c
  LEFT JOIN public.profiles p ON p.user_id = c.user_id
  LEFT JOIN public.courses co ON co.id = c.course_id
  WHERE c.code = _code
    AND c.status = 'emitido'
  LIMIT 1;
$$;