-- =========================
-- LIVE CLASSES
-- =========================
CREATE TABLE public.live_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  module_id uuid REFERENCES public.course_modules(id) ON DELETE SET NULL,
  teacher_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  status text NOT NULL DEFAULT 'agendada',
  recording_enabled boolean NOT NULL DEFAULT true,
  provider text NOT NULL DEFAULT 'google_meet',
  meet_url text,
  meet_event_id text,
  meet_conference_id text,
  google_account_email text,
  recording_status text NOT NULL DEFAULT 'nenhuma',
  error_message text,
  open_minutes_before integer NOT NULL DEFAULT 15,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_live_classes_course ON public.live_classes(course_id);
CREATE INDEX idx_live_classes_teacher ON public.live_classes(teacher_id);
CREATE INDEX idx_live_classes_sched ON public.live_classes(scheduled_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_classes TO authenticated;
GRANT ALL ON public.live_classes TO service_role;
ALTER TABLE public.live_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam aulas ao vivo"
ON public.live_classes FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Moderadores veem aulas ao vivo"
ON public.live_classes FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'moderador'));

CREATE POLICY "Professor gerencia suas aulas ao vivo"
ON public.live_classes FOR ALL TO authenticated
USING (teacher_id = auth.uid())
WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Alunos veem aulas ao vivo dos seus cursos"
ON public.live_classes FOR SELECT TO authenticated
USING (public.can_access_course(auth.uid(), course_id));

CREATE TRIGGER trg_live_classes_updated_at
BEFORE UPDATE ON public.live_classes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- LIVE RECORDINGS
-- =========================
CREATE TABLE public.live_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_class_id uuid NOT NULL REFERENCES public.live_classes(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  module_id uuid REFERENCES public.course_modules(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  storage_path text,
  video_url text,
  thumbnail_url text,
  duration_seconds integer,
  file_size bigint,
  source text NOT NULL DEFAULT 'google_meet',
  status text NOT NULL DEFAULT 'processando',
  error_message text,
  published_lesson_id uuid REFERENCES public.course_lessons(id) ON DELETE SET NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_live_recordings_class ON public.live_recordings(live_class_id);
CREATE INDEX idx_live_recordings_course ON public.live_recordings(course_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_recordings TO authenticated;
GRANT ALL ON public.live_recordings TO service_role;
ALTER TABLE public.live_recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam gravacoes"
ON public.live_recordings FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Professor gerencia gravacoes das suas aulas"
ON public.live_recordings FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.live_classes lc WHERE lc.id = live_class_id AND lc.teacher_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.live_classes lc WHERE lc.id = live_class_id AND lc.teacher_id = auth.uid()));

CREATE POLICY "Alunos veem gravacoes publicadas dos seus cursos"
ON public.live_recordings FOR SELECT TO authenticated
USING (status = 'publicada' AND public.can_access_course(auth.uid(), course_id));

CREATE TRIGGER trg_live_recordings_updated_at
BEFORE UPDATE ON public.live_recordings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- LIVE ATTENDANCE
-- =========================
CREATE TABLE public.live_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_class_id uuid NOT NULL REFERENCES public.live_classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  duration_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_live_attendance_class ON public.live_attendance(live_class_id);
CREATE UNIQUE INDEX idx_live_attendance_unique ON public.live_attendance(live_class_id, student_id);

GRANT SELECT, INSERT, UPDATE ON public.live_attendance TO authenticated;
GRANT ALL ON public.live_attendance TO service_role;
ALTER TABLE public.live_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins e moderadores veem presenca ao vivo"
ON public.live_attendance FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderador'));

CREATE POLICY "Professor ve presenca das suas aulas"
ON public.live_attendance FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.live_classes lc WHERE lc.id = live_class_id AND lc.teacher_id = auth.uid()));

CREATE POLICY "Aluno ve a propria presenca"
ON public.live_attendance FOR SELECT TO authenticated
USING (student_id = auth.uid());

CREATE POLICY "Aluno registra a propria saida"
ON public.live_attendance FOR UPDATE TO authenticated
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

CREATE TRIGGER trg_live_attendance_updated_at
BEFORE UPDATE ON public.live_attendance
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- GOOGLE CONNECTIONS (per teacher)
-- =========================
CREATE TABLE public.teacher_google_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  account_email text,
  connection_key text,
  connected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_google_connections TO authenticated;
GRANT ALL ON public.teacher_google_connections TO service_role;
ALTER TABLE public.teacher_google_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario gerencia a propria conexao google"
ON public.teacher_google_connections FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_teacher_google_connections_updated_at
BEFORE UPDATE ON public.teacher_google_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- RPC: entrar na aula (valida matricula + registra presenca)
-- =========================
CREATE OR REPLACE FUNCTION public.entrar_aula_ao_vivo(_live_class_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _lc public.live_classes%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO _lc FROM public.live_classes WHERE id = _live_class_id;
  IF _lc.id IS NULL THEN RAISE EXCEPTION 'Aula ao vivo não encontrada'; END IF;

  IF NOT (public.has_role(_uid, 'admin') OR _lc.teacher_id = _uid
          OR public.can_access_course(_uid, _lc.course_id)) THEN
    RAISE EXCEPTION 'Você não tem acesso a esta aula';
  END IF;

  IF _lc.meet_url IS NULL OR length(trim(_lc.meet_url)) = 0 THEN
    RAISE EXCEPTION 'A sala desta aula ainda não foi criada';
  END IF;

  IF _lc.status = 'cancelada' THEN RAISE EXCEPTION 'Esta aula foi cancelada'; END IF;

  IF _lc.teacher_id <> _uid AND NOT public.has_role(_uid, 'admin') THEN
    IF now() < (_lc.scheduled_at - make_interval(mins => _lc.open_minutes_before)) THEN
      RAISE EXCEPTION 'A sala ainda não está aberta';
    END IF;
  END IF;

  INSERT INTO public.live_attendance (live_class_id, student_id)
  VALUES (_live_class_id, _uid)
  ON CONFLICT (live_class_id, student_id) DO NOTHING;

  RETURN jsonb_build_object('meet_url', _lc.meet_url, 'title', _lc.title);
END;
$$;

REVOKE ALL ON FUNCTION public.entrar_aula_ao_vivo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.entrar_aula_ao_vivo(uuid) TO authenticated, service_role;

-- =========================
-- RPC: publicar gravacao como aula do curso
-- =========================
CREATE OR REPLACE FUNCTION public.publicar_gravacao_como_aula(
  _recording_id uuid,
  _module_id uuid DEFAULT NULL,
  _new_module_title text DEFAULT NULL,
  _title text DEFAULT NULL,
  _description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _rec public.live_recordings%ROWTYPE;
  _lc public.live_classes%ROWTYPE;
  _mod uuid := _module_id;
  _lesson_id uuid;
  _order int;
  _dur text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO _rec FROM public.live_recordings WHERE id = _recording_id;
  IF _rec.id IS NULL THEN RAISE EXCEPTION 'Gravação não encontrada'; END IF;
  SELECT * INTO _lc FROM public.live_classes WHERE id = _rec.live_class_id;

  IF NOT (public.has_role(_uid, 'admin') OR _lc.teacher_id = _uid) THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  IF _rec.storage_path IS NULL AND _rec.video_url IS NULL THEN
    RAISE EXCEPTION 'A gravação ainda não possui vídeo';
  END IF;

  IF _mod IS NULL AND _new_module_title IS NOT NULL AND length(trim(_new_module_title)) > 0 THEN
    SELECT COALESCE(max(sort_order), 0) + 1 INTO _order FROM public.course_modules WHERE course_id = _rec.course_id;
    INSERT INTO public.course_modules (course_id, title, locked, sort_order)
    VALUES (_rec.course_id, trim(_new_module_title), false, _order)
    RETURNING id INTO _mod;
  END IF;

  IF _mod IS NULL THEN _mod := _rec.module_id; END IF;
  IF _mod IS NULL THEN RAISE EXCEPTION 'Escolha um módulo para publicar a aula'; END IF;

  SELECT COALESCE(max(sort_order), 0) + 1 INTO _order FROM public.course_lessons WHERE module_id = _mod;

  _dur := CASE
    WHEN _rec.duration_seconds IS NOT NULL AND _rec.duration_seconds > 0
      THEN (_rec.duration_seconds / 60)::text || 'min'
    ELSE COALESCE(_lc.duration_minutes, 60)::text || 'min'
  END;

  IF _rec.published_lesson_id IS NOT NULL THEN
    UPDATE public.course_lessons
      SET title = COALESCE(_title, _rec.title),
          content_url = COALESCE(_rec.video_url, _rec.storage_path),
          content_text = COALESCE(_description, _rec.description),
          module_id = _mod,
          updated_at = now()
      WHERE id = _rec.published_lesson_id
      RETURNING id INTO _lesson_id;
  END IF;

  IF _lesson_id IS NULL THEN
    INSERT INTO public.course_lessons (module_id, title, type, duration, completed, sort_order, content_url, content_text)
    VALUES (_mod, COALESCE(_title, _rec.title), 'video', _dur, false, _order,
            COALESCE(_rec.video_url, _rec.storage_path), COALESCE(_description, _rec.description))
    RETURNING id INTO _lesson_id;
  END IF;

  UPDATE public.live_recordings
    SET module_id = _mod,
        title = COALESCE(_title, title),
        description = COALESCE(_description, description),
        status = 'publicada',
        published_lesson_id = _lesson_id,
        published_at = now(),
        updated_at = now()
    WHERE id = _recording_id;

  UPDATE public.live_classes
    SET status = 'publicada', module_id = COALESCE(module_id, _mod), updated_at = now()
    WHERE id = _rec.live_class_id;

  INSERT INTO public.notifications (user_id, type, title, message, link)
  SELECT e.user_id, 'live_recording_published', 'Nova aula disponível',
         'A gravação "' || COALESCE(_title, _rec.title) || '" já está disponível no seu curso.',
         '/courses/' || _rec.course_id
  FROM public.enrollments e
  WHERE e.course_id = _rec.course_id;

  RETURN jsonb_build_object('lesson_id', _lesson_id, 'module_id', _mod);
END;
$$;

REVOKE ALL ON FUNCTION public.publicar_gravacao_como_aula(uuid, uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publicar_gravacao_como_aula(uuid, uuid, text, text, text) TO authenticated, service_role;