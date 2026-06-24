
CREATE TABLE public.presenca_evento_cursos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES public.presenca_eventos(id) ON DELETE CASCADE,
  curso_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evento_id, curso_id)
);

CREATE INDEX presenca_evento_cursos_evento_idx ON public.presenca_evento_cursos(evento_id);
CREATE INDEX presenca_evento_cursos_curso_idx ON public.presenca_evento_cursos(curso_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.presenca_evento_cursos TO authenticated;
GRANT ALL ON public.presenca_evento_cursos TO service_role;

ALTER TABLE public.presenca_evento_cursos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam vinculos de cursos do evento"
  ON public.presenca_evento_cursos
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Cooperados, moderadores e admins veem vinculos"
  ON public.presenca_evento_cursos
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'moderador'::app_role)
    OR has_role(auth.uid(), 'cooperado'::app_role)
  );
