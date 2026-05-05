-- Public certificate validation RPC (no auth required)
-- Returns minimal, non-sensitive info to verify a certificate by its code.
CREATE OR REPLACE FUNCTION public.validate_certificate(_code text)
RETURNS TABLE (
  code text,
  status text,
  issued_at timestamptz,
  student_name text,
  course_title text,
  course_duration text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.code,
    c.status,
    c.issued_at,
    p.full_name AS student_name,
    co.title AS course_title,
    co.duration AS course_duration
  FROM public.certificates c
  LEFT JOIN public.profiles p ON p.user_id = c.user_id
  LEFT JOIN public.courses co ON co.id = c.course_id
  WHERE c.code = _code
    AND c.status = 'emitido'
  LIMIT 1;
$$;

-- Allow anonymous (public) execution
GRANT EXECUTE ON FUNCTION public.validate_certificate(text) TO anon, authenticated;