CREATE TABLE public.course_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action text NOT NULL,
  course_id uuid NOT NULL,
  course_title text NOT NULL,
  preserved_history boolean,
  actor_user_id uuid,
  actor_name text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.course_audit_log TO authenticated;
GRANT ALL ON public.course_audit_log TO service_role;

ALTER TABLE public.course_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view course audit log"
ON public.course_audit_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_course_audit_log_created_at ON public.course_audit_log (created_at DESC);

CREATE OR REPLACE FUNCTION public.delete_course_with_options(_course_id uuid, _preserve_history boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _course public.courses%ROWTYPE;
  _archived integer := 0;
  _certs integer := 0;
  _cert_ids uuid[] := '{}';
  _snapshot jsonb;
  _actor_name text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO _course FROM public.courses WHERE id = _course_id;
  IF _course.id IS NULL THEN
    RAISE EXCEPTION 'Curso não encontrado';
  END IF;

  IF _preserve_history THEN
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

    SELECT COALESCE(array_agg(id), '{}'), count(*) INTO _cert_ids, _certs
    FROM public.certificates WHERE course_id = _course_id;

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

  SELECT jsonb_build_object(
    'course', to_jsonb(_course),
    'modules', COALESCE((SELECT jsonb_agg(to_jsonb(m)) FROM public.course_modules m WHERE m.course_id = _course_id), '[]'::jsonb),
    'lessons', COALESCE((SELECT jsonb_agg(to_jsonb(l)) FROM public.course_lessons l
                          JOIN public.course_modules m ON m.id = l.module_id WHERE m.course_id = _course_id), '[]'::jsonb),
    'evaluations', COALESCE((SELECT jsonb_agg(to_jsonb(ce)) FROM public.course_evaluations ce WHERE ce.course_id = _course_id), '[]'::jsonb),
    'questions', COALESCE((SELECT jsonb_agg(to_jsonb(q)) FROM public.evaluation_questions q
                            JOIN public.course_evaluations ce ON ce.id = q.evaluation_id WHERE ce.course_id = _course_id), '[]'::jsonb),
    'books', COALESCE((SELECT jsonb_agg(to_jsonb(b)) FROM public.course_books b WHERE b.course_id = _course_id), '[]'::jsonb),
    'surveys', COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM public.course_surveys s WHERE s.course_id = _course_id), '[]'::jsonb)
  ) INTO _snapshot;

  INSERT INTO public.deleted_courses (course_id, course_title, preserved_history, snapshot, certificate_ids, deleted_by)
  VALUES (_course_id, _course.title, _preserve_history, _snapshot, _cert_ids, auth.uid())
  ON CONFLICT (course_id) DO UPDATE
    SET course_title = EXCLUDED.course_title,
        preserved_history = EXCLUDED.preserved_history,
        snapshot = EXCLUDED.snapshot,
        certificate_ids = EXCLUDED.certificate_ids,
        deleted_by = EXCLUDED.deleted_by,
        deleted_at = now(),
        restored_at = NULL,
        restored_by = NULL,
        updated_at = now();

  DELETE FROM public.courses WHERE id = _course_id;

  SELECT full_name INTO _actor_name FROM public.profiles WHERE user_id = auth.uid();

  INSERT INTO public.course_audit_log (action, course_id, course_title, preserved_history, actor_user_id, actor_name, details)
  VALUES ('excluido', _course_id, _course.title, _preserve_history, auth.uid(), _actor_name,
    jsonb_build_object(
      'archived_completions', _archived,
      'preserved_certificates', CASE WHEN _preserve_history THEN _certs ELSE 0 END,
      'deleted_certificates', CASE WHEN _preserve_history THEN 0 ELSE NULL END
    ));

  RETURN jsonb_build_object(
    'preserved', _preserve_history,
    'archived_completions', _archived,
    'preserved_certificates', CASE WHEN _preserve_history THEN _certs ELSE 0 END
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.restore_deleted_course(_course_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _rec public.deleted_courses%ROWTYPE;
  _s jsonb;
  _certs integer := 0;
  _enrolls integer := 0;
  _actor_name text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO _rec FROM public.deleted_courses WHERE course_id = _course_id AND restored_at IS NULL;
  IF _rec.id IS NULL THEN
    RAISE EXCEPTION 'Curso excluído não encontrado ou já restaurado';
  END IF;
  IF EXISTS (SELECT 1 FROM public.courses WHERE id = _course_id) THEN
    RAISE EXCEPTION 'Este curso já existe';
  END IF;

  _s := _rec.snapshot;

  INSERT INTO public.courses
  SELECT * FROM jsonb_populate_record(NULL::public.courses, _s->'course');

  INSERT INTO public.course_modules
  SELECT * FROM jsonb_populate_recordset(NULL::public.course_modules, _s->'modules');

  INSERT INTO public.course_lessons
  SELECT * FROM jsonb_populate_recordset(NULL::public.course_lessons, _s->'lessons');

  INSERT INTO public.course_evaluations
  SELECT * FROM jsonb_populate_recordset(NULL::public.course_evaluations, _s->'evaluations');

  INSERT INTO public.evaluation_questions
  SELECT * FROM jsonb_populate_recordset(NULL::public.evaluation_questions, _s->'questions');

  INSERT INTO public.course_books
  SELECT * FROM jsonb_populate_recordset(NULL::public.course_books, _s->'books');

  INSERT INTO public.course_surveys
  SELECT * FROM jsonb_populate_recordset(NULL::public.course_surveys, _s->'surveys');

  IF _rec.preserved_history AND array_length(_rec.certificate_ids, 1) > 0 THEN
    WITH upd AS (
      UPDATE public.certificates
      SET course_id = _course_id, updated_at = now()
      WHERE id = ANY(_rec.certificate_ids) AND course_id IS NULL
      RETURNING 1
    )
    SELECT count(*) INTO _certs FROM upd;
  END IF;

  IF _rec.preserved_history THEN
    WITH ins AS (
      INSERT INTO public.enrollments (user_id, course_id, progress, status, enrolled_at)
      SELECT a.user_id, _course_id, a.progress, a.status, COALESCE(a.enrolled_at, now())
      FROM public.archived_course_completions a
      WHERE a.original_course_id = _course_id
      ON CONFLICT DO NOTHING
      RETURNING 1
    )
    SELECT count(*) INTO _enrolls FROM ins;

    DELETE FROM public.archived_course_completions WHERE original_course_id = _course_id;
  END IF;

  UPDATE public.deleted_courses
  SET restored_at = now(), restored_by = auth.uid(), updated_at = now()
  WHERE id = _rec.id;

  SELECT full_name INTO _actor_name FROM public.profiles WHERE user_id = auth.uid();

  INSERT INTO public.course_audit_log (action, course_id, course_title, preserved_history, actor_user_id, actor_name, details)
  VALUES ('restaurado', _course_id, _rec.course_title, _rec.preserved_history, auth.uid(), _actor_name,
    jsonb_build_object(
      'restored_certificates', _certs,
      'restored_enrollments', _enrolls,
      'deleted_at', _rec.deleted_at
    ));

  RETURN jsonb_build_object(
    'course_id', _course_id,
    'restored_certificates', _certs,
    'restored_enrollments', _enrolls
  );
END;
$function$;