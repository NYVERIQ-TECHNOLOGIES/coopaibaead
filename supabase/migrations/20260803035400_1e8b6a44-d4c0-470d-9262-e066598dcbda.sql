-- 1. Exam attempts: block direct client inserts (must use submit_exam_answers RPC)
DROP POLICY IF EXISTS "Users can insert their own exam attempts" ON public.exam_attempts;
REVOKE INSERT ON public.exam_attempts FROM authenticated, anon;

-- 2. Enrollments: require purchase/subscription for paid courses
DROP POLICY IF EXISTS "Users can self-enroll" ON public.enrollments;
CREATE POLICY "Users can self-enroll"
ON public.enrollments FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = course_id
      AND (
        c.cooperado_only = false
        OR public.has_role(auth.uid(), 'cooperado'::app_role)
        OR public.has_role(auth.uid(), 'admin'::app_role)
      )
      AND (
        c.is_paid = false
        OR public.has_purchased_course(auth.uid(), c.id)
        OR (c.premium_enabled AND public.has_active_subscription(auth.uid()))
        OR public.has_role(auth.uid(), 'admin'::app_role)
      )
  )
);

-- 3. Revoke anon EXECUTE on privileged SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.delete_course_with_options(uuid, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.restore_deleted_course(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.tem_acesso_curso_via_presenca(uuid, uuid) FROM anon;

-- 4. Revoke authenticated EXECUTE on internal-only helper functions
REVOKE EXECUTE ON FUNCTION public.can_access_course(uuid, uuid) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.tem_acesso_curso_eventual(uuid, uuid) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.tem_acesso_curso_via_presenca(uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_question_answer(uuid) FROM authenticated, anon;
