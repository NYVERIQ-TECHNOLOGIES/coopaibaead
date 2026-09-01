CREATE POLICY "Admins gerenciam arquivos de gravacoes"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'gravacoes' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'gravacoes' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Professor gerencia arquivos das suas gravacoes"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'gravacoes'
  AND EXISTS (
    SELECT 1 FROM public.live_classes lc
    WHERE lc.teacher_id = auth.uid()
      AND lc.id::text = (storage.foldername(name))[1]
  )
)
WITH CHECK (
  bucket_id = 'gravacoes'
  AND EXISTS (
    SELECT 1 FROM public.live_classes lc
    WHERE lc.teacher_id = auth.uid()
      AND lc.id::text = (storage.foldername(name))[1]
  )
);