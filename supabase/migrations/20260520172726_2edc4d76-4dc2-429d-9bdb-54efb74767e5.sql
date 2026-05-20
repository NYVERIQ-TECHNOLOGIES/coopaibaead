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
    _details := _details || jsonb_build_object(
      'question_id', _q.id,
      'given', _given,
      'correct_option', lower(_q.correct_option),
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