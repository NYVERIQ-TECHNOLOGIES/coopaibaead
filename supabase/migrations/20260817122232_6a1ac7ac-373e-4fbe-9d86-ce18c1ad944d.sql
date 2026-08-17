GRANT EXECUTE ON FUNCTION public.can_access_course(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tem_acesso_curso_eventual(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.can_access_course(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.tem_acesso_curso_eventual(uuid, uuid) FROM anon;