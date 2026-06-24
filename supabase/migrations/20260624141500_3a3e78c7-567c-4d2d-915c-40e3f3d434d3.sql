-- Helper: user has access to a course because they signed presence (CPF) at an event linked to the course
CREATE OR REPLACE FUNCTION public.tem_acesso_curso_via_presenca(_user_id uuid, _course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.presenca_assinaturas a
      ON a.cpf = regexp_replace(COALESCE(p.cpf,''), '[^0-9]', '', 'g')
     AND length(regexp_replace(COALESCE(p.cpf,''), '[^0-9]', '', 'g')) = 11
    JOIN public.presenca_evento_cursos ec
      ON ec.evento_id = a.evento_id
    WHERE p.user_id = _user_id
      AND ec.curso_id = _course_id
  );
$$;

-- Extend can_access_course to consider presence-based access
CREATE OR REPLACE FUNCTION public.can_access_course(_user_id uuid, _course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = _course_id
      AND (
        public.has_role(_user_id, 'admin')
        OR public.tem_acesso_curso_eventual(_user_id, _course_id)
        OR public.tem_acesso_curso_via_presenca(_user_id, _course_id)
        OR (
          COALESCE(c.eventual, false) = false
          AND (NOT c.cooperado_only OR public.has_role(_user_id, 'cooperado'))
          AND (
            c.is_paid = false
            OR public.has_purchased_course(_user_id, _course_id)
            OR (c.premium_enabled AND public.has_active_subscription(_user_id))
          )
        )
      )
  )
$$;

-- Auto-create enrollments when a presence signature is registered for a CPF
-- that matches an existing profile, for each course linked to the event.
CREATE OR REPLACE FUNCTION public.criar_matriculas_apos_presenca()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cpf_clean text;
BEGIN
  _cpf_clean := regexp_replace(COALESCE(NEW.cpf,''), '[^0-9]', '', 'g');
  IF length(_cpf_clean) <> 11 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.enrollments (user_id, course_id, status, progress)
  SELECT p.user_id, ec.curso_id, 'ativo', 0
  FROM public.profiles p
  JOIN public.presenca_evento_cursos ec ON ec.evento_id = NEW.evento_id
  WHERE regexp_replace(COALESCE(p.cpf,''), '[^0-9]', '', 'g') = _cpf_clean
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_criar_matriculas_apos_presenca ON public.presenca_assinaturas;
CREATE TRIGGER trg_criar_matriculas_apos_presenca
AFTER INSERT ON public.presenca_assinaturas
FOR EACH ROW EXECUTE FUNCTION public.criar_matriculas_apos_presenca();

-- Backfill: create enrollments for existing signatures where CPF matches a profile
INSERT INTO public.enrollments (user_id, course_id, status, progress)
SELECT DISTINCT p.user_id, ec.curso_id, 'ativo', 0
FROM public.presenca_assinaturas a
JOIN public.profiles p
  ON regexp_replace(COALESCE(p.cpf,''), '[^0-9]', '', 'g') = a.cpf
JOIN public.presenca_evento_cursos ec ON ec.evento_id = a.evento_id
WHERE length(COALESCE(a.cpf,'')) = 11
ON CONFLICT DO NOTHING;