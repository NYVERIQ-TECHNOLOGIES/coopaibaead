CREATE POLICY "Users with course access can view questions"
ON public.evaluation_questions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.course_evaluations ce
    WHERE ce.id = evaluation_questions.evaluation_id
      AND public.can_access_course(auth.uid(), ce.course_id)
  )
);