CREATE OR REPLACE FUNCTION public.resolve_course_short_code(_code text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
  FROM public.courses c
  WHERE replace(c.id::text, '-', '') LIKE lower(replace(_code, '-', '')) || '%'
  ORDER BY c.created_at
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.resolve_course_short_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_course_short_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_course_short_code(text) TO anon;