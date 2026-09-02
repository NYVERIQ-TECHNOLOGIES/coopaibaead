
-- Helper: is the user the owner (creator) of a course, and a professor?
CREATE OR REPLACE FUNCTION public.owns_course(_user_id uuid, _course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = _course_id
      AND c.created_by = _user_id
      AND public.has_role(_user_id, 'professor'::app_role)
  )
$$;

REVOKE ALL ON FUNCTION public.owns_course(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_course(uuid, uuid) TO authenticated, service_role;

-- Helper: owner of the course a module belongs to
CREATE OR REPLACE FUNCTION public.owns_module(_user_id uuid, _module_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.course_modules m
    WHERE m.id = _module_id AND public.owns_course(_user_id, m.course_id)
  )
$$;

REVOKE ALL ON FUNCTION public.owns_module(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_module(uuid, uuid) TO authenticated, service_role;

-- ============ COURSES ============
CREATE POLICY "Professors can create own courses"
  ON public.courses FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'professor'::app_role) AND created_by = auth.uid());

CREATE POLICY "Professors can update own courses"
  ON public.courses FOR UPDATE TO authenticated
  USING (public.owns_course(auth.uid(), id))
  WITH CHECK (public.owns_course(auth.uid(), id) AND created_by = auth.uid());

CREATE POLICY "Professors can delete own courses"
  ON public.courses FOR DELETE TO authenticated
  USING (public.owns_course(auth.uid(), id));

CREATE POLICY "Professors can view courses"
  ON public.courses FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'professor'::app_role));

-- ============ MODULES ============
CREATE POLICY "Professors manage own course modules"
  ON public.course_modules FOR ALL TO authenticated
  USING (public.owns_course(auth.uid(), course_id))
  WITH CHECK (public.owns_course(auth.uid(), course_id));

-- ============ LESSONS ============
CREATE POLICY "Professors manage own course lessons"
  ON public.course_lessons FOR ALL TO authenticated
  USING (public.owns_module(auth.uid(), module_id))
  WITH CHECK (public.owns_module(auth.uid(), module_id));

-- ============ BOOKS / MATERIALS ============
CREATE POLICY "Professors manage own course books"
  ON public.course_books FOR ALL TO authenticated
  USING (public.owns_course(auth.uid(), course_id))
  WITH CHECK (public.owns_course(auth.uid(), course_id));

-- ============ EVALUATIONS ============
CREATE POLICY "Professors manage own course evaluations"
  ON public.course_evaluations FOR ALL TO authenticated
  USING (public.owns_course(auth.uid(), course_id))
  WITH CHECK (public.owns_course(auth.uid(), course_id));

CREATE POLICY "Professors manage own evaluation questions"
  ON public.evaluation_questions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.course_evaluations e WHERE e.id = evaluation_id AND public.owns_course(auth.uid(), e.course_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.course_evaluations e WHERE e.id = evaluation_id AND public.owns_course(auth.uid(), e.course_id)));

-- ============ SURVEYS ============
CREATE POLICY "Professors manage own course surveys"
  ON public.course_surveys FOR ALL TO authenticated
  USING (public.owns_course(auth.uid(), course_id))
  WITH CHECK (public.owns_course(auth.uid(), course_id));

CREATE POLICY "Professors view own course survey responses"
  ON public.course_survey_responses FOR SELECT TO authenticated
  USING (public.owns_course(auth.uid(), course_id));

-- ============ LIVE CLASSES ============
CREATE POLICY "Professors manage own live classes"
  ON public.live_classes FOR ALL TO authenticated
  USING (teacher_id = auth.uid() AND public.has_role(auth.uid(), 'professor'::app_role))
  WITH CHECK (teacher_id = auth.uid() AND public.has_role(auth.uid(), 'professor'::app_role) AND public.owns_course(auth.uid(), course_id));

CREATE POLICY "Professors manage own live recordings"
  ON public.live_recordings FOR ALL TO authenticated
  USING (public.owns_course(auth.uid(), course_id))
  WITH CHECK (public.owns_course(auth.uid(), course_id));

CREATE POLICY "Professors view own live attendance"
  ON public.live_attendance FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.live_classes lc WHERE lc.id = live_class_id AND lc.teacher_id = auth.uid() AND public.has_role(auth.uid(), 'professor'::app_role)));

-- ============ MEDIA FILES ============
CREATE POLICY "Professors view media"
  ON public.media_files FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'professor'::app_role));

CREATE POLICY "Professors manage own media"
  ON public.media_files FOR ALL TO authenticated
  USING (uploaded_by = auth.uid() AND public.has_role(auth.uid(), 'professor'::app_role))
  WITH CHECK (uploaded_by = auth.uid() AND public.has_role(auth.uid(), 'professor'::app_role));

-- ============ ENROLLMENTS / STUDENTS ============
CREATE POLICY "Professors view own course enrollments"
  ON public.enrollments FOR SELECT TO authenticated
  USING (public.owns_course(auth.uid(), course_id));

CREATE POLICY "Professors view own course attendance"
  ON public.attendance FOR SELECT TO authenticated
  USING (public.owns_course(auth.uid(), course_id));

-- ============ CERTIFICATES ============
CREATE POLICY "Professors view own course certificates"
  ON public.certificates FOR SELECT TO authenticated
  USING (course_id IS NOT NULL AND public.owns_course(auth.uid(), course_id));

-- ============ PURCHASES / REVENUE ============
CREATE POLICY "Professors view own course purchases"
  ON public.purchases FOR SELECT TO authenticated
  USING (public.owns_course(auth.uid(), course_id));

-- ============ FORUM ============
CREATE POLICY "Professors moderate own course topics"
  ON public.forum_topics FOR UPDATE TO authenticated
  USING (course_id IS NOT NULL AND public.owns_course(auth.uid(), course_id))
  WITH CHECK (course_id IS NOT NULL AND public.owns_course(auth.uid(), course_id));

CREATE POLICY "Professors delete own course topics"
  ON public.forum_topics FOR DELETE TO authenticated
  USING (course_id IS NOT NULL AND public.owns_course(auth.uid(), course_id));

CREATE POLICY "Professors moderate own course replies"
  ON public.forum_replies FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.forum_topics t WHERE t.id = topic_id AND t.course_id IS NOT NULL AND public.owns_course(auth.uid(), t.course_id)));
