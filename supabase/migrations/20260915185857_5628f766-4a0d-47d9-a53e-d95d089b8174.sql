CREATE OR REPLACE VIEW public.evaluation_questions_safe
WITH (security_invoker = false) AS
SELECT q.id,
       q.evaluation_id,
       q.question_text,
       q.option_a,
       q.option_b,
       q.option_c,
       q.option_d,
       q.sort_order,
       q.created_at,
       q.updated_at
FROM public.evaluation_questions q
JOIN public.course_evaluations e ON e.id = q.evaluation_id
WHERE public.has_role(auth.uid(), 'admin'::app_role)
   OR public.owns_course(auth.uid(), e.course_id)
   OR public.can_access_course(auth.uid(), e.course_id);

REVOKE ALL ON public.evaluation_questions_safe FROM anon;
GRANT SELECT ON public.evaluation_questions_safe TO authenticated;