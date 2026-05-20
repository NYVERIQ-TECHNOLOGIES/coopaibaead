-- 1) Tabela de vínculo aulas <-> avaliações (N:N)
CREATE TABLE IF NOT EXISTS public.evaluation_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid NOT NULL REFERENCES public.course_evaluations(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evaluation_id, lesson_id)
);
CREATE INDEX IF NOT EXISTS idx_evaluation_lessons_eval ON public.evaluation_lessons(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_lessons_lesson ON public.evaluation_lessons(lesson_id);

ALTER TABLE public.evaluation_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage evaluation_lessons"
ON public.evaluation_lessons
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "View evaluation_lessons respecting course access"
ON public.evaluation_lessons
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.course_evaluations ce
    WHERE ce.id = evaluation_lessons.evaluation_id
      AND public.can_access_course(auth.uid(), ce.course_id)
  )
);

-- Backfill: existing single lesson_id vínculos passam para a nova tabela
INSERT INTO public.evaluation_lessons (evaluation_id, lesson_id)
SELECT ce.id, ce.lesson_id
FROM public.course_evaluations ce
WHERE ce.lesson_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 2) Hardening de permissões em funções SECURITY DEFINER
-- Padrão: revogar EXECUTE de public/anon e conceder apenas onde necessário.

-- Funções públicas (anônimas) — fluxos abertos legítimos
REVOKE ALL ON FUNCTION public.get_evento_publico(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_evento_publico(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.validate_certificate(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_certificate(text) TO anon, authenticated;

-- Funções para usuários autenticados (validações internas controlam admin)
REVOKE ALL ON FUNCTION public.submit_exam_answers(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_exam_answers(uuid, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.mark_lesson_access(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_lesson_access(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.reset_course_progress(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_course_progress(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_admin_reports() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_reports() TO authenticated;

REVOKE ALL ON FUNCTION public.get_question_answer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_question_answer(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.log_admin_access(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_admin_access(text) TO authenticated;

REVOKE ALL ON FUNCTION public.assign_default_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_default_role(uuid, app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.assign_default_role_bulk() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_default_role_bulk() TO authenticated;

REVOKE ALL ON FUNCTION public.get_users_without_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_users_without_role() TO authenticated;

REVOKE ALL ON FUNCTION public.get_users_with_invalid_enrollment() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_users_with_invalid_enrollment() TO authenticated;

REVOKE ALL ON FUNCTION public.get_missing_enrollments_with_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_missing_enrollments_with_users() TO authenticated;

REVOKE ALL ON FUNCTION public.get_enrollment_diagnostics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_enrollment_diagnostics() TO authenticated;

REVOKE ALL ON FUNCTION public.get_duplicate_enrollments() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_duplicate_enrollments() TO authenticated;

REVOKE ALL ON FUNCTION public.link_enrollment_to_user(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_enrollment_to_user(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.get_public_profiles(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO authenticated;

REVOKE ALL ON FUNCTION public.list_public_profiles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_profiles() TO authenticated;

-- Helpers usadas em RLS — não precisam ser chamadas por clientes
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.has_active_subscription(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.has_purchased_course(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_purchased_course(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.can_access_course(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_course(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_master_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_master_admin(uuid) TO authenticated;

-- Função usada exclusivamente pelo backend (service role) via edge function
REVOKE ALL ON FUNCTION public.registrar_presenca(text, text, text, text, text, text, text, text) FROM PUBLIC;