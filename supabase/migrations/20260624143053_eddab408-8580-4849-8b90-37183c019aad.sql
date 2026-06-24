DROP FUNCTION IF EXISTS public.get_evento_cursos_publico(text);

CREATE OR REPLACE FUNCTION public.get_evento_cursos_publico(_codigo text)
RETURNS TABLE(id uuid, title text, description text, image text, duration text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.title, c.description, c.image, c.duration
  FROM public.presenca_evento_cursos pec
  JOIN public.presenca_eventos pe ON pe.id = pec.evento_id
  JOIN public.courses c ON c.id = pec.curso_id
  WHERE pe.codigo = _codigo
  ORDER BY c.title;
$$;

GRANT EXECUTE ON FUNCTION public.get_evento_cursos_publico(text) TO anon, authenticated;