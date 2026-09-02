DROP POLICY IF EXISTS "Enrolled users can read questions (safe columns)" ON public.evaluation_questions;

REVOKE EXECUTE ON FUNCTION public.delete_course_with_options(uuid, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.restore_deleted_course(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tem_acesso_curso_via_presenca(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_evento_cursos_publico(text) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.get_duplicate_enrollments() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_enrollment_diagnostics() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_missing_enrollments_with_users() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_users_with_invalid_enrollment() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.link_enrollment_to_user(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_certificate_available(uuid) FROM anon, authenticated;