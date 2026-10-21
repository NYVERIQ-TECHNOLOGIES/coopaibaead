CREATE TABLE public.video_play_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lesson_id uuid NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  played_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX video_play_events_user_idx ON public.video_play_events (user_id, played_at DESC);
CREATE INDEX video_play_events_lesson_idx ON public.video_play_events (lesson_id, played_at DESC);
CREATE INDEX video_play_events_course_idx ON public.video_play_events (course_id, played_at DESC);

GRANT SELECT, INSERT ON public.video_play_events TO authenticated;
GRANT ALL ON public.video_play_events TO service_role;

ALTER TABLE public.video_play_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own play events"
ON public.video_play_events
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users read own play events"
ON public.video_play_events
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins and moderators read all play events"
ON public.video_play_events
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderador'));