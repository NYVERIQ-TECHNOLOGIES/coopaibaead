CREATE OR REPLACE FUNCTION public.matricular_via_link(_course_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _c public.courses%ROWTYPE;
  _created boolean := false;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO _c FROM public.courses WHERE id = _course_id;
  IF _c.id IS NULL THEN
    RAISE EXCEPTION 'Curso não encontrado';
  END IF;

  IF COALESCE(_c.is_open, true) = false THEN
    RAISE EXCEPTION 'Este curso está fechado para novas matrículas';
  END IF;

  IF _c.is_paid THEN
    RAISE EXCEPTION 'Este curso é pago e não pode ser acessado por link direto';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.enrollments WHERE user_id = _uid AND course_id = _course_id) THEN
    INSERT INTO public.enrollments (user_id, course_id, status, progress)
    VALUES (_uid, _course_id, 'ativo', 0);
    _created := true;
  END IF;

  RETURN jsonb_build_object('course_id', _course_id, 'created', _created, 'title', _c.title);
END;
$$;

REVOKE ALL ON FUNCTION public.matricular_via_link(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.matricular_via_link(uuid) TO authenticated;