
-- 1) Fix handle_new_user to never trust client-supplied role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  -- Always default to 'aluno'. Admin elevation only via create-admin edge function.
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'aluno');

  RETURN NEW;
END;
$function$;

-- 2) Hide correct_option from non-admins on evaluation_questions
DROP POLICY IF EXISTS "Anyone authenticated can view questions" ON public.evaluation_questions;

-- Admins keep full access via existing "Admins can manage questions" ALL policy.
-- Add a column-level restriction by revoking SELECT on correct_option from authenticated
-- and granting it only to admins via a security definer view.
REVOKE SELECT ON public.evaluation_questions FROM authenticated;
GRANT SELECT (id, evaluation_id, question_text, option_a, option_b, option_c, option_d, sort_order, created_at, updated_at)
  ON public.evaluation_questions TO authenticated;
GRANT SELECT ON public.evaluation_questions TO authenticated;
-- Re-grant column-level only (drop the full grant just made)
REVOKE SELECT ON public.evaluation_questions FROM authenticated;
GRANT SELECT (id, evaluation_id, question_text, option_a, option_b, option_c, option_d, correct_option, sort_order, created_at, updated_at)
  ON public.evaluation_questions TO authenticated;

-- Re-add SELECT policy but exclude correct_option access for non-admins via a check function approach:
-- Simplest: students see questions without correct_option through a dedicated view.
CREATE OR REPLACE VIEW public.evaluation_questions_safe
WITH (security_invoker = true)
AS
SELECT id, evaluation_id, question_text, option_a, option_b, option_c, option_d, sort_order, created_at, updated_at
FROM public.evaluation_questions;

GRANT SELECT ON public.evaluation_questions_safe TO authenticated;

-- Restrict the base table SELECT to admins only
CREATE POLICY "Admins can view questions with answers"
  ON public.evaluation_questions
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Allow authenticated users SELECT on the base table (the view uses security_invoker so it
-- evaluates RLS as the calling user). Since non-admins cannot see the table, we need a
-- separate policy that allows reading without exposing correct_option. Use the view.
CREATE POLICY "Authenticated can view questions via safe view"
  ON public.evaluation_questions
  FOR SELECT
  TO authenticated
  USING (true);

-- The above re-exposes correct_option. Instead, drop that and rely on column privileges.
DROP POLICY "Authenticated can view questions via safe view" ON public.evaluation_questions;

-- Re-add a policy granting SELECT to all authenticated, but combined with column-level
-- privileges (only safe columns granted), correct_option remains hidden.
REVOKE ALL ON public.evaluation_questions FROM authenticated;
GRANT SELECT (id, evaluation_id, question_text, option_a, option_b, option_c, option_d, sort_order, created_at, updated_at)
  ON public.evaluation_questions TO authenticated;
-- Admins need full access; they get it via has_role policy + table grants below.
GRANT SELECT (correct_option) ON public.evaluation_questions TO authenticated;
-- Above grant would re-expose; remove and use a different approach: separate admin-only column.
REVOKE SELECT (correct_option) ON public.evaluation_questions FROM authenticated;

-- Allow non-admin SELECT through RLS (column grants block correct_option)
CREATE POLICY "Authenticated can view question metadata"
  ON public.evaluation_questions
  FOR SELECT
  TO authenticated
  USING (true);

-- Admins need to be able to SELECT correct_option. Grant via service_role / re-grant for admins
-- Postgres column privileges can't be conditional, so admins must use the service role or
-- a SECURITY DEFINER function. Provide a function for admins to fetch answers.
CREATE OR REPLACE FUNCTION public.get_question_answer(_question_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _answer text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT correct_option INTO _answer FROM public.evaluation_questions WHERE id = _question_id;
  RETURN _answer;
END;
$$;

-- Restore admin INSERT/UPDATE/DELETE grants on full table (admins manage via has_role policy)
GRANT INSERT, UPDATE, DELETE ON public.evaluation_questions TO authenticated;

-- 3) Restrict cooperado_only content at RLS level
DROP POLICY IF EXISTS "Anyone authenticated can view courses" ON public.courses;
CREATE POLICY "View courses respecting cooperado flag"
  ON public.courses
  FOR SELECT
  TO authenticated
  USING (
    NOT cooperado_only
    OR public.has_role(auth.uid(), 'cooperado')
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Anyone authenticated can view books" ON public.course_books;
CREATE POLICY "View books respecting cooperado flag"
  ON public.course_books
  FOR SELECT
  TO authenticated
  USING (
    NOT cooperado_only
    OR public.has_role(auth.uid(), 'cooperado')
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Anyone authenticated can view media" ON public.media_files;
CREATE POLICY "View media respecting cooperado flag"
  ON public.media_files
  FOR SELECT
  TO authenticated
  USING (
    NOT cooperado_only
    OR public.has_role(auth.uid(), 'cooperado')
    OR public.has_role(auth.uid(), 'admin')
  );

-- 4) Lock down storage 'media' bucket to admin writes
DROP POLICY IF EXISTS "Authenticated upload media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete media" ON storage.objects;

CREATE POLICY "Admins can upload media"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update media"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete media"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'media' AND public.has_role(auth.uid(), 'admin'));
