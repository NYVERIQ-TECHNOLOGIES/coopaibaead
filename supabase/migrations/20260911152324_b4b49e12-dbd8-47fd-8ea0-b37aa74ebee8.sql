
-- 1) Verificação de acesso à aula (inclui cobrança do curso pago)
CREATE OR REPLACE FUNCTION public.live_class_access(_live_class_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _lc public.live_classes%ROWTYPE;
  _c public.courses%ROWTYPE;
  _host boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO _lc FROM public.live_classes WHERE id = _live_class_id;
  IF _lc.id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'not_found');
  END IF;

  SELECT * INTO _c FROM public.courses WHERE id = _lc.course_id;

  _host := (_lc.teacher_id = _uid)
        OR public.has_role(_uid, 'admin')
        OR public.has_role(_uid, 'moderador');

  IF _host OR public.can_access_course(_uid, _lc.course_id) THEN
    IF NOT _host THEN
      INSERT INTO public.live_attendance (live_class_id, student_id)
      VALUES (_live_class_id, _uid)
      ON CONFLICT (live_class_id, student_id) DO NOTHING;
    END IF;
    RETURN jsonb_build_object(
      'allowed', true, 'is_host', _host,
      'course_id', _lc.course_id, 'course_title', _c.title,
      'status', _lc.status
    );
  END IF;

  IF COALESCE(_c.is_paid, false) THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'payment_required',
      'is_host', false,
      'course_id', _lc.course_id,
      'course_title', _c.title,
      'price', _c.price,
      'promotional_price', _c.promotional_price,
      'status', _lc.status
    );
  END IF;

  RETURN jsonb_build_object('allowed', false, 'reason', 'forbidden', 'is_host', false,
                            'course_id', _lc.course_id, 'course_title', _c.title);
END;
$function$;

REVOKE ALL ON FUNCTION public.live_class_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.live_class_access(uuid) TO authenticated;

-- 2) Participantes online visíveis para quem pode assistir a aula
CREATE OR REPLACE FUNCTION public.live_viewer_participants(_live_class_id uuid)
RETURNS TABLE(user_id uuid, full_name text, avatar_url text, role text, online boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.live_can_view(auth.uid(), _live_class_id) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  RETURN QUERY
  SELECT s.user_id,
         COALESCE(p.full_name, 'Participante'),
         p.avatar_url,
         MAX(s.role),
         BOOL_OR(s.left_at IS NULL AND s.last_seen_at > now() - interval '90 seconds')
  FROM public.live_class_sessions s
  LEFT JOIN public.profiles p ON p.user_id = s.user_id
  WHERE s.live_class_id = _live_class_id
  GROUP BY s.user_id, p.full_name, p.avatar_url
  HAVING BOOL_OR(s.left_at IS NULL AND s.last_seen_at > now() - interval '90 seconds')
  ORDER BY 2;
END;
$function$;

REVOKE ALL ON FUNCTION public.live_viewer_participants(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.live_viewer_participants(uuid) TO authenticated;

-- 3) Aulas ao vivo do aluno
CREATE OR REPLACE FUNCTION public.live_my_classes()
RETURNS TABLE(
  id uuid, title text, description text, course_id uuid, course_title text,
  scheduled_at timestamptz, duration_minutes int, status text, provider text,
  open_minutes_before int, teacher_name text, online_count bigint,
  payment_required boolean, price numeric, promotional_price numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  RETURN QUERY
  SELECT lc.id, lc.title, lc.description, lc.course_id, c.title,
         lc.scheduled_at, lc.duration_minutes, lc.status, lc.provider,
         lc.open_minutes_before,
         COALESCE(tp.full_name, 'Professor'),
         (SELECT COUNT(DISTINCT s.user_id) FROM public.live_class_sessions s
           WHERE s.live_class_id = lc.id
             AND s.left_at IS NULL
             AND s.last_seen_at > now() - interval '90 seconds'),
         (NOT public.can_access_course(_uid, lc.course_id)) AND COALESCE(c.is_paid, false),
         c.price, c.promotional_price
  FROM public.live_classes lc
  JOIN public.courses c ON c.id = lc.course_id
  LEFT JOIN public.profiles tp ON tp.user_id = lc.teacher_id
  WHERE lc.status <> 'cancelada'
    AND lc.scheduled_at > now() - interval '30 days'
    AND (
      public.can_access_course(_uid, lc.course_id)
      OR EXISTS (SELECT 1 FROM public.enrollments e
                  WHERE e.user_id = _uid AND e.course_id = lc.course_id)
      OR COALESCE(c.is_paid, false)
    )
    AND COALESCE(c.is_active, true) = true
  ORDER BY (lc.status = 'ao_vivo') DESC, lc.scheduled_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.live_my_classes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.live_my_classes() TO authenticated;
