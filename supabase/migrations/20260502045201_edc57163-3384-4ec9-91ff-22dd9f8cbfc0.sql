-- Revoke EXECUTE from anon/public on SECURITY DEFINER functions; grant to authenticated only.
-- Functions that should remain callable by anon (used in public flows) are excluded.

REVOKE EXECUTE ON FUNCTION public.get_question_answer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_question_answer(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.log_admin_access(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_admin_access(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.list_public_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_public_profiles() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.submit_exam_answers(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_exam_answers(uuid, jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.assign_default_role_bulk() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_default_role_bulk() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_users_without_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_users_without_role() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.assign_default_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_default_role(uuid, app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_duplicate_enrollments() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_duplicate_enrollments() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.link_enrollment_to_user(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_enrollment_to_user(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.reset_course_progress(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_course_progress(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_users_with_invalid_enrollment() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_users_with_invalid_enrollment() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_master_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_master_admin(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_enrollment_diagnostics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_enrollment_diagnostics() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_missing_enrollments_with_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_missing_enrollments_with_users() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.can_access_course(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_course(uuid, uuid) TO authenticated;