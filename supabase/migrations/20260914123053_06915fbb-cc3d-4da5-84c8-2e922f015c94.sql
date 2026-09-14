DROP POLICY IF EXISTS "Cooperados veem eventos" ON public.presenca_eventos;
CREATE POLICY "Cooperados veem eventos" ON public.presenca_eventos
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'cooperado'::app_role)
  AND (
    status <> 'encerrado'
    OR EXISTS (
      SELECT 1 FROM public.presenca_assinaturas a
      WHERE a.evento_id = presenca_eventos.id AND a.cooperado_user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Professors can view courses" ON public.courses;
CREATE POLICY "Professors can view own courses" ON public.courses
FOR SELECT TO authenticated
USING (owns_course(auth.uid(), id));

DROP POLICY IF EXISTS "Professors view media" ON public.media_files;