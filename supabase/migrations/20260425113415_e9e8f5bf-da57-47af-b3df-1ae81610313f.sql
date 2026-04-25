-- ============================================================
-- Diagnóstico de matrículas (enrollment_number) — somente admin
-- ============================================================

-- 1) Usuários sem matrícula ou com matrícula inválida (fora do padrão COOP-XXXXXX)
CREATE OR REPLACE FUNCTION public.get_users_with_invalid_enrollment()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  enrollment_number text,
  cooperativa text,
  is_active boolean,
  created_at timestamptz,
  reason text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    p.user_id,
    p.full_name,
    u.email::text,
    p.enrollment_number,
    p.cooperativa,
    p.is_active,
    p.created_at,
    CASE
      WHEN p.enrollment_number IS NULL OR length(trim(p.enrollment_number)) = 0
        THEN 'sem_matricula'
      WHEN p.enrollment_number !~ '^COOP-[0-9]{6}$'
        THEN 'matricula_invalida'
      ELSE 'ok'
    END AS reason
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.user_id
  WHERE p.enrollment_number IS NULL
     OR length(trim(p.enrollment_number)) = 0
     OR p.enrollment_number !~ '^COOP-[0-9]{6}$'
  ORDER BY p.created_at ASC;
END;
$$;

-- 2) Matrículas duplicadas
CREATE OR REPLACE FUNCTION public.get_duplicate_enrollments()
RETURNS TABLE (
  enrollment_number text,
  occurrences bigint,
  user_ids uuid[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    p.enrollment_number,
    count(*) AS occurrences,
    array_agg(p.user_id) AS user_ids
  FROM public.profiles p
  WHERE p.enrollment_number IS NOT NULL
    AND p.enrollment_number ~ '^COOP-[0-9]{6}$'
  GROUP BY p.enrollment_number
  HAVING count(*) > 1
  ORDER BY p.enrollment_number;
END;
$$;

-- 3) Matrículas faltantes (gaps na sequência) com sugestão de possível dono
CREATE OR REPLACE FUNCTION public.get_missing_enrollments_with_users()
RETURNS TABLE (
  missing_enrollment_number text,
  possible_user_id uuid,
  possible_user_name text,
  possible_user_email text,
  possible_user_created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _min int;
  _max int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT
    MIN(CAST(REPLACE(enrollment_number, 'COOP-', '') AS integer)),
    MAX(CAST(REPLACE(enrollment_number, 'COOP-', '') AS integer))
  INTO _min, _max
  FROM public.profiles
  WHERE enrollment_number IS NOT NULL
    AND enrollment_number ~ '^COOP-[0-9]{6}$';

  IF _min IS NULL OR _max IS NULL OR _min = _max THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH numeros_existentes AS (
    SELECT CAST(REPLACE(p.enrollment_number, 'COOP-', '') AS integer) AS numero
    FROM public.profiles p
    WHERE p.enrollment_number ~ '^COOP-[0-9]{6}$'
  ),
  intervalo AS (
    SELECT generate_series(_min, _max) AS numero
  ),
  faltantes AS (
    SELECT i.numero
    FROM intervalo i
    LEFT JOIN numeros_existentes n ON n.numero = i.numero
    WHERE n.numero IS NULL
  ),
  usuarios_sem_matricula AS (
    SELECT
      p.user_id,
      p.full_name,
      u.email::text AS email,
      p.created_at,
      row_number() OVER (ORDER BY p.created_at ASC) AS rn
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.user_id
    WHERE p.enrollment_number IS NULL
       OR length(trim(p.enrollment_number)) = 0
       OR p.enrollment_number !~ '^COOP-[0-9]{6}$'
  ),
  faltantes_indexadas AS (
    SELECT f.numero, row_number() OVER (ORDER BY f.numero ASC) AS rn
    FROM faltantes f
  )
  SELECT
    ('COOP-' || LPAD(fi.numero::text, 6, '0'))::text AS missing_enrollment_number,
    usm.user_id AS possible_user_id,
    usm.full_name AS possible_user_name,
    usm.email AS possible_user_email,
    usm.created_at AS possible_user_created_at
  FROM faltantes_indexadas fi
  LEFT JOIN usuarios_sem_matricula usm ON usm.rn = fi.rn
  ORDER BY fi.numero;
END;
$$;

-- 4) Resumo geral de inconsistências
CREATE OR REPLACE FUNCTION public.get_enrollment_diagnostics()
RETURNS TABLE (
  total_profiles bigint,
  total_with_valid_enrollment bigint,
  total_without_enrollment bigint,
  total_invalid_format bigint,
  total_duplicates bigint,
  total_missing_gaps bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _min int;
  _max int;
  _existing int;
  _gaps int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT
    MIN(CAST(REPLACE(enrollment_number, 'COOP-', '') AS integer)),
    MAX(CAST(REPLACE(enrollment_number, 'COOP-', '') AS integer)),
    count(*)
  INTO _min, _max, _existing
  FROM public.profiles
  WHERE enrollment_number ~ '^COOP-[0-9]{6}$';

  IF _min IS NOT NULL AND _max IS NOT NULL THEN
    _gaps := (_max - _min + 1) - _existing;
    IF _gaps < 0 THEN _gaps := 0; END IF;
  END IF;

  RETURN QUERY
  SELECT
    (SELECT count(*) FROM public.profiles)::bigint,
    (SELECT count(*) FROM public.profiles WHERE enrollment_number ~ '^COOP-[0-9]{6}$')::bigint,
    (SELECT count(*) FROM public.profiles WHERE enrollment_number IS NULL OR length(trim(enrollment_number)) = 0)::bigint,
    (SELECT count(*) FROM public.profiles WHERE enrollment_number IS NOT NULL AND length(trim(enrollment_number)) > 0 AND enrollment_number !~ '^COOP-[0-9]{6}$')::bigint,
    (SELECT COALESCE(sum(c - 1), 0) FROM (
       SELECT count(*) AS c
       FROM public.profiles
       WHERE enrollment_number ~ '^COOP-[0-9]{6}$'
       GROUP BY enrollment_number
       HAVING count(*) > 1
     ) d)::bigint,
    _gaps::bigint;
END;
$$;

-- 5) Vincular um número de matrícula a um usuário (somente admin)
CREATE OR REPLACE FUNCTION public.link_enrollment_to_user(
  _user_id uuid,
  _enrollment_number text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _exists boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF _enrollment_number IS NULL OR _enrollment_number !~ '^COOP-[0-9]{6}$' THEN
    RAISE EXCEPTION 'Formato de matrícula inválido. Use COOP-XXXXXX (6 dígitos).';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.profiles
    WHERE enrollment_number = _enrollment_number
      AND user_id <> _user_id
  ) INTO _exists;

  IF _exists THEN
    RAISE EXCEPTION 'Esta matrícula já está vinculada a outro usuário.';
  END IF;

  UPDATE public.profiles
  SET enrollment_number = _enrollment_number,
      updated_at = now()
  WHERE user_id = _user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado.';
  END IF;
END;
$$;