CREATE OR REPLACE FUNCTION public.get_evento_cursos_publico(_codigo text)
RETURNS TABLE (id uuid, title text, description text, image text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id, c.title, c.description, c.image
  FROM public.presenca_eventos e
  JOIN public.presenca_evento_cursos ec ON ec.evento_id = e.id
  JOIN public.courses c ON c.id = ec.curso_id
  WHERE e.codigo = upper(_codigo)
  ORDER BY c.title;
$$;

REVOKE ALL ON FUNCTION public.get_evento_cursos_publico(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_evento_cursos_publico(text) TO anon, authenticated;