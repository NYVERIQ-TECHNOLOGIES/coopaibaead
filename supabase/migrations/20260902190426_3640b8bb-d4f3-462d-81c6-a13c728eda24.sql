
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS area_atuacao text,
  ADD COLUMN IF NOT EXISTS especialidade text;

CREATE OR REPLACE FUNCTION public.get_professor_stats(_professor_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _target uuid := COALESCE(_professor_id, auth.uid());
  _result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;
  IF _target <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  SELECT jsonb_build_object(
    'total_courses', (SELECT count(*) FROM courses c WHERE c.created_by = _target),
    'active_courses', (SELECT count(*) FROM courses c WHERE c.created_by = _target AND c.is_active),
    'draft_courses', (SELECT count(*) FROM courses c WHERE c.created_by = _target AND NOT c.is_active),
    'total_students', (SELECT count(DISTINCT e.user_id) FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE c.created_by = _target),
    'total_lessons', (SELECT count(*) FROM course_lessons l JOIN course_modules m ON m.id = l.module_id JOIN courses c ON c.id = m.course_id WHERE c.created_by = _target),
    'total_live_classes', (SELECT count(*) FROM live_classes lc JOIN courses c ON c.id = lc.course_id WHERE c.created_by = _target),
    'total_certificates', (SELECT count(*) FROM certificates ct JOIN courses c ON c.id = ct.course_id WHERE c.created_by = _target AND ct.status <> 'pending'),
    'total_revenue', (SELECT COALESCE(sum(p.amount),0) FROM purchases p JOIN courses c ON c.id = p.course_id WHERE c.created_by = _target AND p.status = 'paid'),
    'total_sales', (SELECT count(*) FROM purchases p JOIN courses c ON c.id = p.course_id WHERE c.created_by = _target AND p.status = 'paid'),
    'by_course', COALESCE((
      SELECT jsonb_agg(x ORDER BY x->>'title')
      FROM (
        SELECT jsonb_build_object(
          'course_id', c.id,
          'title', c.title,
          'is_active', c.is_active,
          'is_paid', c.is_paid,
          'students', (SELECT count(*) FROM enrollments e WHERE e.course_id = c.id),
          'certificates', (SELECT count(*) FROM certificates ct WHERE ct.course_id = c.id AND ct.status <> 'pending'),
          'sales', (SELECT count(*) FROM purchases p WHERE p.course_id = c.id AND p.status = 'paid'),
          'revenue', (SELECT COALESCE(sum(p.amount),0) FROM purchases p WHERE p.course_id = c.id AND p.status = 'paid')
        ) AS x
        FROM courses c WHERE c.created_by = _target
      ) s
    ), '[]'::jsonb)
  ) INTO _result;

  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_professor_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_professor_stats(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.list_professors()
RETURNS TABLE(
  user_id uuid,
  full_name text,
  avatar_url text,
  phone text,
  area_atuacao text,
  especialidade text,
  is_active boolean,
  created_at timestamptz,
  total_courses bigint,
  total_students bigint,
  total_certificates bigint,
  total_revenue numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id,
    p.full_name,
    p.avatar_url,
    p.phone,
    p.area_atuacao,
    p.especialidade,
    p.is_active,
    p.created_at,
    (SELECT count(*) FROM courses c WHERE c.created_by = p.user_id),
    (SELECT count(DISTINCT e.user_id) FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE c.created_by = p.user_id),
    (SELECT count(*) FROM certificates ct JOIN courses c ON c.id = ct.course_id WHERE c.created_by = p.user_id AND ct.status <> 'pending'),
    (SELECT COALESCE(sum(pu.amount),0) FROM purchases pu JOIN courses c ON c.id = pu.course_id WHERE c.created_by = p.user_id AND pu.status = 'paid')
  FROM profiles p
  JOIN user_roles r ON r.user_id = p.user_id AND r.role = 'professor'::app_role
  WHERE public.has_role(auth.uid(), 'admin'::app_role)
  ORDER BY p.full_name;
$$;

REVOKE ALL ON FUNCTION public.list_professors() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_professors() TO authenticated, service_role;
