-- ============================================================
-- HARDENING: profiles, evaluation answers, exam RPC, storage,
-- realtime forum scope.
-- ============================================================

-- 1) View pública para autores do fórum (somente dados não sensíveis)
DROP VIEW IF EXISTS public.public_profiles CASCADE;
CREATE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT user_id, full_name, avatar_url
FROM public.profiles;
GRANT SELECT ON public.public_profiles TO authenticated, anon;

-- 2) View pública de perguntas SEM correct_option
DROP VIEW IF EXISTS public.public_evaluation_questions CASCADE;
CREATE VIEW public.public_evaluation_questions
WITH (security_invoker = true) AS
SELECT
  q.id,
  q.evaluation_id,
  q.question_text,
  q.option_a,
  q.option_b,
  q.option_c,
  q.option_d,
  q.sort_order,
  q.created_at,
  q.updated_at
FROM public.evaluation_questions q
WHERE EXISTS (
  SELECT 1 FROM public.course_evaluations ce
  WHERE ce.id = q.evaluation_id
    AND public.can_access_course(auth.uid(), ce.course_id)
);
GRANT SELECT ON public.public_evaluation_questions TO authenticated;

-- 3) Endurecer submit_exam_answers: exigir matrícula ativa
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
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Avaliação deve existir e pertencer a um curso
  SELECT ce.course_id INTO _course_id
  FROM public.course_evaluations ce
  WHERE ce.id = _evaluation_id;

  IF _course_id IS NULL THEN
    RAISE EXCEPTION 'Evaluation not found';
  END IF;

  -- Usuário precisa ter acesso ao curso (matrícula ativa OU admin)
  IF NOT public.can_access_course(auth.uid(), _course_id) THEN
    RAISE EXCEPTION 'Not enrolled in course';
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

-- 4) Storage media: corrigir vazamento "qualquer certificado libera tudo"
DROP POLICY IF EXISTS media_role_aware_read ON storage.objects;

CREATE POLICY media_role_aware_read ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'media' AND (
    -- admin sempre vê
    public.has_role(auth.uid(), 'admin')
    -- arquivos referenciados em media_files (respeitando cooperado_only)
    OR EXISTS (
      SELECT 1 FROM public.media_files mf
      WHERE (mf.file_url LIKE ('%/' || objects.name)
             OR mf.file_url = objects.name
             OR mf.thumbnail_url LIKE ('%/' || objects.name)
             OR mf.thumbnail_url = objects.name)
        AND (NOT mf.cooperado_only OR public.has_role(auth.uid(), 'cooperado'))
    )
    -- livros do curso: precisa ter acesso ao curso
    OR EXISTS (
      SELECT 1 FROM public.course_books cb
      WHERE (cb.file_url LIKE ('%/' || objects.name) OR cb.file_url = objects.name)
        AND public.can_access_course(auth.uid(), cb.course_id)
    )
    -- imagens de cursos visíveis
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE (c.image LIKE ('%/' || objects.name) OR c.image = objects.name)
        AND (NOT c.cooperado_only OR public.has_role(auth.uid(), 'cooperado'))
    )
    -- templates de certificado ativos (visíveis a authenticated por RLS já)
    OR EXISTS (
      SELECT 1 FROM public.certificate_templates ct
      WHERE ct.active = true
        AND (ct.file_url LIKE ('%/' || objects.name) OR ct.file_url = objects.name)
    )
  )
);

-- 5) Política INSERT explícita para realtime de fórum (já tinha select/insert genérico
--    de support+course, agregamos forum:topic e forum:course com matrícula ativa)
DROP POLICY IF EXISTS realtime_messages_select ON realtime.messages;
DROP POLICY IF EXISTS realtime_messages_insert ON realtime.messages;

CREATE POLICY realtime_messages_select ON realtime.messages
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (realtime.topic() LIKE 'support:user:%'
      AND split_part(realtime.topic(), ':', 3) = (auth.uid())::text)
  OR (realtime.topic() LIKE 'support:conversation:%'
      AND EXISTS (
        SELECT 1 FROM public.support_conversations sc
        WHERE sc.id::text = split_part(realtime.topic(), ':', 3)
          AND sc.user_id = auth.uid()
      ))
  OR (realtime.topic() LIKE 'course:%'
      AND public.can_access_course(auth.uid(),
            NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid))
  OR (realtime.topic() LIKE 'forum:course:%'
      AND public.can_access_course(auth.uid(),
            NULLIF(split_part(realtime.topic(), ':', 3), '')::uuid))
  OR (realtime.topic() LIKE 'forum:topic:%')
);

CREATE POLICY realtime_messages_insert ON realtime.messages
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (realtime.topic() LIKE 'support:user:%'
      AND split_part(realtime.topic(), ':', 3) = (auth.uid())::text)
  OR (realtime.topic() LIKE 'support:conversation:%'
      AND EXISTS (
        SELECT 1 FROM public.support_conversations sc
        WHERE sc.id::text = split_part(realtime.topic(), ':', 3)
          AND sc.user_id = auth.uid()
      ))
  OR (realtime.topic() LIKE 'course:%'
      AND public.can_access_course(auth.uid(),
            NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid))
  OR (realtime.topic() LIKE 'forum:course:%'
      AND public.can_access_course(auth.uid(),
            NULLIF(split_part(realtime.topic(), ':', 3), '')::uuid))
  OR (realtime.topic() LIKE 'forum:topic:%')
);