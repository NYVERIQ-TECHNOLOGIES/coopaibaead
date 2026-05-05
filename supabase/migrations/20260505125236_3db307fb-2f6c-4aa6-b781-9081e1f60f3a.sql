
CREATE OR REPLACE FUNCTION public.get_admin_reports()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  WITH
  totals AS (
    SELECT
      (SELECT count(*) FROM public.profiles WHERE is_active = true) AS active_students,
      (SELECT count(*) FROM public.enrollments WHERE status = 'ativo') AS active_enrollments,
      (SELECT count(*) FROM public.courses) AS total_courses,
      (SELECT count(*) FROM public.certificates WHERE status = 'emitido') AS issued_certificates,
      (SELECT count(*) FROM public.enrollments WHERE status = 'concluido') AS completed_enrollments,
      (SELECT count(*) FROM public.enrollments) AS all_enrollments,
      (SELECT COALESCE(round(avg(progress)::numeric, 1), 0) FROM public.enrollments) AS avg_progress
  ),
  most_accessed AS (
    SELECT c.id, c.title,
      count(e.id) FILTER (WHERE e.last_accessed_at IS NOT NULL) AS accesses,
      count(e.id) AS total_enrollments
    FROM public.courses c
    LEFT JOIN public.enrollments e ON e.course_id = c.id
    GROUP BY c.id, c.title
    ORDER BY accesses DESC NULLS LAST, total_enrollments DESC
    LIMIT 10
  ),
  completion_rate AS (
    SELECT c.id, c.title,
      count(e.id) AS enrollments,
      count(e.id) FILTER (WHERE e.status = 'concluido') AS completed,
      CASE WHEN count(e.id) > 0
        THEN round((count(e.id) FILTER (WHERE e.status = 'concluido')::numeric / count(e.id)::numeric) * 100, 1)
        ELSE 0 END AS rate
    FROM public.courses c
    LEFT JOIN public.enrollments e ON e.course_id = c.id
    GROUP BY c.id, c.title
    HAVING count(e.id) > 0
    ORDER BY rate DESC, enrollments DESC
    LIMIT 10
  ),
  recent_signups AS (
    SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, count(*) AS qty
    FROM public.profiles
    WHERE created_at > now() - interval '30 days'
    GROUP BY 1
    ORDER BY 1
  )
  SELECT jsonb_build_object(
    'totals', (SELECT row_to_json(totals.*) FROM totals),
    'most_accessed', COALESCE((SELECT jsonb_agg(row_to_json(most_accessed.*)) FROM most_accessed), '[]'::jsonb),
    'completion_rate', COALESCE((SELECT jsonb_agg(row_to_json(completion_rate.*)) FROM completion_rate), '[]'::jsonb),
    'recent_signups', COALESCE((SELECT jsonb_agg(row_to_json(recent_signups.*)) FROM recent_signups), '[]'::jsonb)
  ) INTO _result;

  RETURN _result;
END;
$$;
