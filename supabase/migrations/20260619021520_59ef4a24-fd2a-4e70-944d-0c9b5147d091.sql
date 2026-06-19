
-- 1) Remove SELECT policy that exposed correct_option to enrolled students.
DROP POLICY IF EXISTS "Users with course access can view questions" ON public.evaluation_questions;

-- 2) Rewrite submit_exam_answers to NOT return correct_option (only is_correct).
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
  _details jsonb := '[]'::jsonb;
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
    ORDER BY sort_order
  LOOP
    _total := _total + 1;
    _given := lower(coalesce(_answers->>(_q.id::text), ''));
    -- NEVER include correct_option in the response. Only signal correctness.
    _details := _details || jsonb_build_object(
      'question_id', _q.id,
      'given', _given,
      'is_correct', (_given = lower(_q.correct_option))
    );
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
    'correct', _correct,
    'details', _details
  );
END;
$function$;

-- 3) Lock down SECURITY DEFINER function execution. Revoke broad EXECUTE, then
-- grant only to the roles that legitimately need each function.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;

-- Anonymous-callable (truly public reads)
GRANT EXECUTE ON FUNCTION public.validate_certificate(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_evento_publico(text) TO anon, authenticated;

-- Authenticated app RPCs
GRANT EXECUTE ON FUNCTION public.submit_exam_answers(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_course_progress(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_lesson_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inscrever_cooperado_eventual(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_inscricao_eventual(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_admin_access(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_public_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_reports() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_users_without_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_users_with_invalid_enrollment() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_duplicate_enrollments() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_missing_enrollments_with_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_enrollment_diagnostics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_default_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_default_role_bulk() TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_enrollment_to_user(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_certificate(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_certificate_available(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_certificate_pickup(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_certificate_reissue(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_question_answer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_course(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_purchased_course(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tem_acesso_curso_eventual(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_master_admin(uuid) TO authenticated;

-- Service-role-only (edge functions / cron)
-- registrar_presenca, encerrar_eventos_vencidos, mark_certificate_error remain
-- callable only by service_role (which bypasses GRANTs).

-- 4) Restrict listing on public branding bucket. Files remain accessible via
-- their public URLs (storage public endpoint does not check this policy).
DROP POLICY IF EXISTS "Public read branding" ON storage.objects;

-- 5) Document that exam_attempts.answers stores only student-submitted choices.
COMMENT ON COLUMN public.exam_attempts.answers IS
  'Only the student''s submitted answers (question_id -> chosen letter). Never stores correct-answer metadata.';
