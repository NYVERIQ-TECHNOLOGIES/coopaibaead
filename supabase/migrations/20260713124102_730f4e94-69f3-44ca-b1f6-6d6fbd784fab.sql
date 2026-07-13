
-- Course satisfaction survey
CREATE TABLE public.course_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE UNIQUE,
  title text NOT NULL DEFAULT 'Pesquisa de Satisfação',
  description text,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_surveys TO authenticated;
GRANT ALL ON public.course_surveys TO service_role;

ALTER TABLE public.course_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view active surveys"
  ON public.course_surveys FOR SELECT TO authenticated
  USING (is_active OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage surveys"
  ON public.course_surveys FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER course_surveys_updated
  BEFORE UPDATE ON public.course_surveys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Responses
CREATE TABLE public.course_survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.course_surveys(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (survey_id, user_id)
);

GRANT SELECT, INSERT ON public.course_survey_responses TO authenticated;
GRANT ALL ON public.course_survey_responses TO service_role;

ALTER TABLE public.course_survey_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own response"
  ON public.course_survey_responses FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own response"
  ON public.course_survey_responses FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
