
-- 1. Enrollment numbers ---------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.enrollment_number_seq START 1;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS enrollment_number text UNIQUE;

CREATE OR REPLACE FUNCTION public.assign_enrollment_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.enrollment_number IS NULL THEN
    NEW.enrollment_number := 'COOP-' || LPAD(nextval('public.enrollment_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_assign_enrollment ON public.profiles;
CREATE TRIGGER profiles_assign_enrollment
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.assign_enrollment_number();

-- Backfill existing rows
UPDATE public.profiles
SET enrollment_number = 'COOP-' || LPAD(nextval('public.enrollment_number_seq')::text, 6, '0')
WHERE enrollment_number IS NULL;

-- 2. Admin access logs ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  accessed_at timestamptz NOT NULL DEFAULT now(),
  user_agent text
);

ALTER TABLE public.admin_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all access logs"
ON public.admin_access_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert their own access log"
ON public.admin_access_logs FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') AND user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.log_admin_access(_user_agent text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN; -- Silently ignore non-admins
  END IF;
  INSERT INTO public.admin_access_logs (user_id, user_agent)
  VALUES (auth.uid(), _user_agent);
END;
$$;

-- 3. Student exam attempts ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exam_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  evaluation_id uuid NOT NULL,
  score numeric(5,2) NOT NULL DEFAULT 0,
  total_questions integer NOT NULL DEFAULT 0,
  correct_count integer NOT NULL DEFAULT 0,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own attempts"
ON public.exam_attempts FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all attempts"
ON public.exam_attempts FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users insert own attempts"
ON public.exam_attempts FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 4. Secure server-side grading ------------------------------------------
-- Input: { question_id: 'a' | 'b' | 'c' | 'd', ... }
-- Returns: { score, total, correct, attempt_id }
CREATE OR REPLACE FUNCTION public.submit_exam_answers(
  _evaluation_id uuid,
  _answers jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _total integer := 0;
  _correct integer := 0;
  _score numeric(5,2);
  _attempt_id uuid;
  _q record;
  _given text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  FOR _q IN
    SELECT id, correct_option FROM public.evaluation_questions
    WHERE evaluation_id = _evaluation_id
  LOOP
    _total := _total + 1;
    _given := lower(coalesce(_answers->>(_q.id::text), ''));
    IF _given = lower(_q.correct_option) THEN
      _correct := _correct + 1;
    END IF;
  END LOOP;

  IF _total = 0 THEN
    _score := 0;
  ELSE
    _score := round((_correct::numeric / _total::numeric) * 100, 2);
  END IF;

  INSERT INTO public.exam_attempts
    (user_id, evaluation_id, score, total_questions, correct_count, answers)
  VALUES
    (auth.uid(), _evaluation_id, _score, _total, _correct, _answers)
  RETURNING id INTO _attempt_id;

  RETURN jsonb_build_object(
    'attempt_id', _attempt_id,
    'score', _score,
    'total', _total,
    'correct', _correct
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_exam_answers(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_admin_access(text) TO authenticated;
