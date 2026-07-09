
-- Revoke EXECUTE from PUBLIC/anon/authenticated on SECURITY DEFINER trigger-only
-- functions. Triggers fire regardless of function EXECUTE grants (they run as
-- the trigger owner), so removing these grants closes API exposure without
-- affecting behavior.
DO $$
DECLARE
  fn text;
  trigger_fns text[] := ARRAY[
    'handle_new_user()',
    'assign_enrollment_number()',
    'prevent_cpf_change()',
    'protect_certificate_identity()',
    'update_updated_at_column()',
    'cooperados_eventuais_atualiza_vagas()',
    'handle_new_support_message()',
    'enforce_support_sender_role()',
    'criar_matriculas_apos_presenca()',
    'presenca_eventos_set_defaults()'
  ];
BEGIN
  FOREACH fn IN ARRAY trigger_fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM anon', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', fn);
  END LOOP;
END $$;

-- Admin/moderator-only RPCs: these self-check has_role() but should not even
-- be callable by anon. Keep authenticated so admins can invoke via PostgREST.
DO $$
DECLARE
  fn text;
  admin_fns text[] := ARRAY[
    'assign_default_role_bulk()',
    'assign_default_role(uuid, app_role)',
    'get_duplicate_enrollments()',
    'get_users_with_invalid_enrollment()',
    'get_users_without_role()',
    'get_enrollment_diagnostics()',
    'get_missing_enrollments_with_users()',
    'link_enrollment_to_user(uuid, text)',
    'log_admin_access(text)',
    'get_admin_reports()',
    'get_question_answer(uuid)',
    'list_public_profiles()',
    'mark_certificate_error(uuid, text)',
    'mark_certificate_available(uuid)',
    'cancel_certificate(uuid, text)',
    'register_certificate_reissue(uuid)',
    'register_certificate_pickup(uuid, text, text, text, text)',
    'cancelar_inscricao_eventual(uuid, text)',
    'encerrar_eventos_vencidos()'
  ];
BEGIN
  FOREACH fn IN ARRAY admin_fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', fn);
  END LOOP;
END $$;

-- Authenticated-only RPCs (called by signed-in users): revoke from anon.
DO $$
DECLARE
  fn text;
  auth_fns text[] := ARRAY[
    'reset_course_progress(uuid)',
    'mark_lesson_access(uuid, uuid)',
    'submit_exam_answers(uuid, jsonb)',
    'inscrever_cooperado_eventual(uuid, text, text, text, text)'
  ];
BEGIN
  FOREACH fn IN ARRAY auth_fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', fn);
  END LOOP;
END $$;

-- Service-role-only RPC (called from edge function with service role key).
REVOKE ALL ON FUNCTION public.registrar_presenca(text, text, text, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_presenca(text, text, text, text, text, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.registrar_presenca(text, text, text, text, text, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_presenca(text, text, text, text, text, text, text, text) TO service_role;

-- Public validation/lookup functions intentionally remain callable by anon:
--   validate_certificate(text), get_evento_publico(text), get_evento_cursos_publico(text)
-- RLS-helper predicates must remain executable by anon/authenticated so
-- policies can evaluate them:
--   has_role, can_access_course, has_active_subscription, has_purchased_course,
--   tem_acesso_curso_eventual, tem_acesso_curso_via_presenca, is_master_admin,
--   get_public_profiles
