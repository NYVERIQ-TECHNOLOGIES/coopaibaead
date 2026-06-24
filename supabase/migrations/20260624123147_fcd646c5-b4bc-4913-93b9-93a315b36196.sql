
-- =====================================================================
-- 1) evaluation_questions_safe view: use security_invoker so RLS applies
--    Add column-level GRANTs so correct_option is never returned to clients.
--    Add SELECT policy on evaluation_questions for users with course access.
-- =====================================================================

-- Switch view back to security_invoker = true (respect querying user's RLS)
ALTER VIEW public.evaluation_questions_safe SET (security_invoker = true);

-- Ensure the public_evaluation_questions view also runs as invoker (it already does, idempotent)
ALTER VIEW public.public_evaluation_questions SET (security_invoker = true);

-- Make sure no direct grants leak correct_option.
-- Revoke any blanket SELECT and re-grant only the safe columns.
REVOKE ALL ON public.evaluation_questions FROM anon, authenticated;

GRANT SELECT (
  id, evaluation_id, question_text, option_a, option_b, option_c, option_d, sort_order, created_at, updated_at
) ON public.evaluation_questions TO authenticated;

GRANT INSERT, UPDATE, DELETE ON public.evaluation_questions TO authenticated;
GRANT ALL ON public.evaluation_questions TO service_role;

-- Allow enrolled students to read the safe columns through the view (RLS row filter).
DROP POLICY IF EXISTS "Enrolled users can read questions (safe columns)" ON public.evaluation_questions;
CREATE POLICY "Enrolled users can read questions (safe columns)"
  ON public.evaluation_questions
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.course_evaluations ce
      WHERE ce.id = evaluation_questions.evaluation_id
        AND public.can_access_course(auth.uid(), ce.course_id)
    )
  );

-- Re-grant view access (idempotent)
GRANT SELECT ON public.evaluation_questions_safe TO authenticated;
GRANT SELECT ON public.public_evaluation_questions TO authenticated;


-- =====================================================================
-- 2) Storage policy: media bucket must require enrollment / linkage.
--    Replaces the catch-all media_files branch that exposed any file with
--    cooperado_only = false to every authenticated user.
-- =====================================================================

DROP POLICY IF EXISTS "media_role_aware_read" ON storage.objects;

CREATE POLICY "media_role_aware_read"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'media'
    AND (
      -- Admins can read everything
      has_role(auth.uid(), 'admin'::app_role)
      -- Media files: must be tied to a course the user can access OR
      -- restricted to cooperados and the user IS a cooperado.
      OR EXISTS (
        SELECT 1
        FROM public.media_files mf
        WHERE (
          mf.file_url LIKE ('%/' || objects.name)
          OR mf.file_url = objects.name
          OR mf.thumbnail_url LIKE ('%/' || objects.name)
          OR mf.thumbnail_url = objects.name
        )
        AND (
          (mf.course_id IS NOT NULL
            AND public.can_access_course(auth.uid(), mf.course_id::uuid))
          OR (mf.cooperado_only = true AND has_role(auth.uid(), 'cooperado'::app_role))
          OR (mf.uploaded_by = auth.uid())
        )
      )
      -- Course books (PDF/library) require course access
      OR EXISTS (
        SELECT 1
        FROM public.course_books cb
        WHERE (cb.file_url LIKE ('%/' || objects.name) OR cb.file_url = objects.name)
          AND public.can_access_course(auth.uid(), cb.course_id)
      )
      -- Course thumbnails (public catalog images) — respect cooperado_only flag
      OR EXISTS (
        SELECT 1
        FROM public.courses c
        WHERE (c.image LIKE ('%/' || objects.name) OR c.image = objects.name)
          AND ((NOT c.cooperado_only) OR has_role(auth.uid(), 'cooperado'::app_role))
      )
      -- Active certificate templates (used by the cert generator)
      OR EXISTS (
        SELECT 1
        FROM public.certificate_templates ct
        WHERE ct.active = true
          AND (ct.file_url LIKE ('%/' || objects.name) OR ct.file_url = objects.name)
      )
      -- Course lesson assets require course access
      OR EXISTS (
        SELECT 1
        FROM public.course_lessons cl
        JOIN public.course_modules cm ON cm.id = cl.module_id
        WHERE (cl.content_url LIKE ('%/' || objects.name) OR cl.content_url = objects.name)
          AND public.can_access_course(auth.uid(), cm.course_id)
      )
    )
  );


-- =====================================================================
-- 3) Restrict SECURITY DEFINER function EXECUTE privileges.
--    - Revoke EXECUTE from PUBLIC, anon, authenticated for trigger
--      functions and Edge-Function-only RPCs.
--    - Keep client-callable RPCs available to authenticated.
--    - Allow anon ONLY for the two public endpoints
--      (validate_certificate, get_evento_publico).
-- =====================================================================

-- Trigger functions: should never be called by clients
REVOKE ALL ON FUNCTION public.assign_enrollment_number() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cooperados_eventuais_atualiza_vagas() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_support_sender_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_support_message() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.presenca_eventos_set_defaults() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_cpf_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_certificate_identity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Edge-function-only RPCs (called via service role)
REVOKE ALL ON FUNCTION public.registrar_presenca(text, text, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_certificate_error(uuid, text) FROM PUBLIC, anon, authenticated;

-- Admin-helper RPCs: still callable by authenticated (the function performs has_role checks internally),
-- but revoked from anon explicitly.
REVOKE EXECUTE ON FUNCTION public.assign_default_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.assign_default_role_bulk() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancel_certificate(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancelar_inscricao_eventual(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.encerrar_eventos_vencidos() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_reports() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_duplicate_enrollments() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_enrollment_diagnostics() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_missing_enrollments_with_users() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_question_answer(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_users_with_invalid_enrollment() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_users_without_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_purchased_course(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.inscrever_cooperado_eventual(uuid, text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_master_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.link_enrollment_to_user(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_public_profiles() FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_admin_access(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_certificate_available(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_lesson_access(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.register_certificate_pickup(uuid, text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.register_certificate_reissue(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reset_course_progress(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.submit_exam_answers(uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.tem_acesso_curso_eventual(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_access_course(uuid, uuid) FROM anon;

-- Keep these two callable by anon (public flows)
GRANT EXECUTE ON FUNCTION public.validate_certificate(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_evento_publico(text) TO anon, authenticated;
