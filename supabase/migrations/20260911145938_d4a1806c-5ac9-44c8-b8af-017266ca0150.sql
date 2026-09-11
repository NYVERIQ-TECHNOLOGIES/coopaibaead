CREATE OR REPLACE FUNCTION public.live_course_attendance_summary(_course_id uuid)
RETURNS TABLE(
  live_class_id uuid,
  title text,
  scheduled_at timestamp with time zone,
  status text,
  total_alunos bigint,
  presentes bigint,
  parciais bigint,
  media_percent numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _min numeric;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderador')
    OR EXISTS (SELECT 1 FROM public.live_classes lc WHERE lc.course_id = _course_id AND lc.teacher_id = auth.uid())
    OR public.owns_course(auth.uid(), _course_id)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para ver o relatório deste curso';
  END IF;

  SELECT COALESCE((value #>> '{}')::numeric, 75) INTO _min
  FROM public.app_settings WHERE key = 'live_attendance_min_percent';
  _min := COALESCE(_min, 75);

  RETURN QUERY
  WITH aulas AS (
    SELECT lc.id,
           lc.title,
           lc.scheduled_at,
           lc.status,
           GREATEST(1, COALESCE(
             CASE WHEN lc.started_at IS NOT NULL AND lc.ended_at IS NOT NULL
               THEN EXTRACT(EPOCH FROM (lc.ended_at - lc.started_at))::int END,
             lc.duration_minutes * 60)) AS dur
    FROM public.live_classes lc
    WHERE lc.course_id = _course_id
  ),
  agg AS (
    SELECT a.id AS aula_id,
           s.user_id AS uid,
           LEAST(100, (SUM(GREATEST(0, CASE WHEN s.left_at IS NULL
             THEN EXTRACT(EPOCH FROM (s.last_seen_at - s.joined_at))::int
             ELSE s.total_seconds END))::numeric * 100) / a.dur) AS pct
    FROM aulas a
    JOIN public.live_class_sessions s
      ON s.live_class_id = a.id AND s.role = 'participante'
    GROUP BY a.id, s.user_id, a.dur
  )
  SELECT a.id,
         a.title,
         a.scheduled_at,
         a.status,
         COALESCE(COUNT(g.uid), 0)::bigint,
         COALESCE(COUNT(*) FILTER (WHERE g.pct >= _min), 0)::bigint,
         COALESCE(COUNT(*) FILTER (WHERE g.pct > 0 AND g.pct < _min), 0)::bigint,
         COALESCE(ROUND(AVG(g.pct), 1), 0)
  FROM aulas a
  LEFT JOIN agg g ON g.aula_id = a.id
  GROUP BY a.id, a.title, a.scheduled_at, a.status
  ORDER BY a.scheduled_at DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.live_course_attendance_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.live_course_attendance_summary(uuid) TO authenticated;