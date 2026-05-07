
CREATE TABLE IF NOT EXISTS public.lesson_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lesson_id uuid NOT NULL,
  course_id uuid NOT NULL,
  content text NOT NULL,
  video_timestamp_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lesson_notes_user_lesson_idx
  ON public.lesson_notes(user_id, lesson_id);

ALTER TABLE public.lesson_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notes"
  ON public.lesson_notes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own notes"
  ON public.lesson_notes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own notes"
  ON public.lesson_notes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own notes"
  ON public.lesson_notes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all notes"
  ON public.lesson_notes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER lesson_notes_updated_at
  BEFORE UPDATE ON public.lesson_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
