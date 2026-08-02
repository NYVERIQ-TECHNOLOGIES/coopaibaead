-- 1. Revoke anon EXECUTE on SECURITY DEFINER functions that must not be public
REVOKE EXECUTE ON FUNCTION public.complete_profile_info(text, date, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_course_with_options(uuid, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.restore_deleted_course(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.tem_acesso_curso_via_presenca(uuid, uuid) FROM anon;

-- 2. Internal-only function: service role / triggers only
REVOKE EXECUTE ON FUNCTION public.mark_certificate_error(uuid, text) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_certificate_error(uuid, text) TO service_role;

-- 3. Scope campaign-course links
DROP POLICY IF EXISTS "Autenticados veem vinculos" ON public.cooperados_eventuais_cursos;
CREATE POLICY "Vinculos visiveis conforme elegibilidade"
ON public.cooperados_eventuais_cursos
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderador'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.cooperados_eventuais_inscricoes i
    WHERE i.campanha_id = cooperados_eventuais_cursos.campanha_id
      AND i.usuario_id = auth.uid()
      AND i.status = 'aprovada'
  )
);