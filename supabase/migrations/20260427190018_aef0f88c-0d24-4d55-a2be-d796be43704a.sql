
-- Revoke EXECUTE from anon and authenticated on all SECURITY DEFINER functions in public,
-- then re-grant only where appropriate.

-- Trigger-only / internal functions: revoke from both anon and authenticated
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_support_message() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.enforce_support_sender_role() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.assign_enrollment_number() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.prevent_cpf_change() FROM anon, authenticated, public;

-- RLS helper functions: only used inside policies under definer context; no direct execute needed
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.can_access_course(uuid, uuid) FROM anon, authenticated, public;

-- Admin-only functions: revoke from anon, keep authenticated (function checks admin role internally)
REVOKE EXECUTE ON FUNCTION public.get_question_answer(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_users_without_role() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.assign_default_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.assign_default_role_bulk() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.link_enrollment_to_user(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_duplicate_enrollments() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_users_with_invalid_enrollment() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_missing_enrollments_with_users() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_enrollment_diagnostics() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.log_admin_access(text) FROM anon, public;

-- User-facing functions: revoke from anon, allow authenticated
REVOKE EXECUTE ON FUNCTION public.submit_exam_answers(uuid, jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.reset_course_progress(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.list_public_profiles() FROM anon, public;
