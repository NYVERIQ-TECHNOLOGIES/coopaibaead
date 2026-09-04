-- ============ Acesso a uma aula ao vivo ============
CREATE OR REPLACE FUNCTION public.live_can_view(_user_id uuid, _live_class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.live_classes lc
    WHERE lc.id = _live_class_id
      AND (
        lc.teacher_id = _user_id
        OR public.has_role(_user_id, 'admin')
        OR public.has_role(_user_id, 'moderador')
        OR public.can_access_course(_user_id, lc.course_id)
      )
  )
$$;
REVOKE ALL ON FUNCTION public.live_can_view(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.live_can_view(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.live_can_manage(_user_id uuid, _live_class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.live_classes lc
    WHERE lc.id = _live_class_id
      AND (lc.teacher_id = _user_id OR public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'moderador'))
  )
$$;
REVOKE ALL ON FUNCTION public.live_can_manage(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.live_can_manage(uuid, uuid) TO authenticated, service_role;

-- ============ Sessões de presença ============
CREATE TABLE public.live_class_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_class_id uuid NOT NULL REFERENCES public.live_classes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'participante',
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  total_seconds integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'online',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_live_sessions_class ON public.live_class_sessions(live_class_id);
CREATE INDEX idx_live_sessions_user ON public.live_class_sessions(user_id, live_class_id);

GRANT SELECT ON public.live_class_sessions TO authenticated;
GRANT ALL ON public.live_class_sessions TO service_role;
ALTER TABLE public.live_class_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participante vê a própria sessão"
ON public.live_class_sessions FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Responsáveis veem as sessões da aula"
ON public.live_class_sessions FOR SELECT TO authenticated
USING (public.live_can_manage(auth.uid(), live_class_id));

CREATE TRIGGER trg_live_sessions_updated
BEFORE UPDATE ON public.live_class_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Chat da aula ============
CREATE TABLE public.live_chat_mutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_class_id uuid NOT NULL REFERENCES public.live_classes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  muted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (live_class_id, user_id)
);
GRANT SELECT ON public.live_chat_mutes TO authenticated;
GRANT INSERT, DELETE ON public.live_chat_mutes TO authenticated;
GRANT ALL ON public.live_chat_mutes TO service_role;
ALTER TABLE public.live_chat_mutes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver silenciados da aula"
ON public.live_chat_mutes FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.live_can_manage(auth.uid(), live_class_id));

CREATE POLICY "Responsáveis silenciam"
ON public.live_chat_mutes FOR INSERT TO authenticated
WITH CHECK (public.live_can_manage(auth.uid(), live_class_id) AND muted_by = auth.uid());

CREATE POLICY "Responsáveis removem silêncio"
ON public.live_chat_mutes FOR DELETE TO authenticated
USING (public.live_can_manage(auth.uid(), live_class_id));

CREATE TABLE public.live_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_class_id uuid NOT NULL REFERENCES public.live_classes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  message text NOT NULL,
  deleted_at timestamptz,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_live_chat_class ON public.live_chat_messages(live_class_id, created_at);

GRANT SELECT, INSERT, UPDATE ON public.live_chat_messages TO authenticated;
GRANT ALL ON public.live_chat_messages TO service_role;
ALTER TABLE public.live_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver chat da aula permitida"
ON public.live_chat_messages FOR SELECT TO authenticated
USING (public.live_can_view(auth.uid(), live_class_id));

CREATE POLICY "Enviar mensagem na aula permitida"
ON public.live_chat_messages FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND deleted_at IS NULL
  AND public.live_can_view(auth.uid(), live_class_id)
  AND NOT EXISTS (
    SELECT 1 FROM public.live_chat_mutes m
    WHERE m.live_class_id = live_chat_messages.live_class_id AND m.user_id = auth.uid()
  )
);

CREATE POLICY "Responsáveis moderam mensagens"
ON public.live_chat_messages FOR UPDATE TO authenticated
USING (public.live_can_manage(auth.uid(), live_class_id))
WITH CHECK (public.live_can_manage(auth.uid(), live_class_id));

CREATE TRIGGER trg_live_chat_updated
BEFORE UPDATE ON public.live_chat_messages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.live_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_class_sessions;

-- ============ Percentual mínimo de presença ============
INSERT INTO public.app_settings (key, value)
VALUES ('live_attendance_min_percent', '75'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============ RPCs de presença ============
CREATE OR REPLACE FUNCTION public.live_join_session(_live_class_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
        _lc public.live_classes%ROWTYPE;
        _sid uuid;
        _role text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
  SELECT * INTO _lc FROM public.live_classes WHERE id = _live_class_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Aula não encontrada'; END IF;
  IF NOT public.live_can_view(_uid, _live_class_id) THEN RAISE EXCEPTION 'Sem acesso a esta aula'; END IF;
  IF _lc.status IN ('cancelada') THEN RAISE EXCEPTION 'Aula cancelada'; END IF;

  _role := CASE WHEN public.live_can_manage(_uid, _live_class_id) THEN 'responsavel' ELSE 'participante' END;

  SELECT id INTO _sid FROM public.live_class_sessions
  WHERE live_class_id = _live_class_id AND user_id = _uid AND left_at IS NULL
    AND last_seen_at > now() - interval '2 minutes'
  ORDER BY joined_at DESC LIMIT 1;

  IF _sid IS NULL THEN
    INSERT INTO public.live_class_sessions (live_class_id, user_id, role)
    VALUES (_live_class_id, _uid, _role) RETURNING id INTO _sid;
  ELSE
    UPDATE public.live_class_sessions
    SET last_seen_at = now(), status = 'online', updated_at = now()
    WHERE id = _sid;
  END IF;

  RETURN jsonb_build_object('session_id', _sid, 'role', _role);
END;
$$;
REVOKE ALL ON FUNCTION public.live_join_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.live_join_session(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.live_heartbeat(_session_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.live_class_sessions
  SET last_seen_at = now(),
      status = 'online',
      total_seconds = GREATEST(total_seconds, EXTRACT(EPOCH FROM (now() - joined_at))::int),
      updated_at = now()
  WHERE id = _session_id AND user_id = auth.uid() AND left_at IS NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.live_heartbeat(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.live_heartbeat(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.live_leave_session(_session_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.live_class_sessions
  SET left_at = now(),
      status = 'encerrada',
      total_seconds = GREATEST(0, EXTRACT(EPOCH FROM (LEAST(now(), last_seen_at + interval '30 seconds') - joined_at))::int),
      updated_at = now()
  WHERE id = _session_id AND user_id = auth.uid() AND left_at IS NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.live_leave_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.live_leave_session(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.live_end_class(_live_class_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _closed int;
BEGIN
  IF NOT public.live_can_manage(auth.uid(), _live_class_id) THEN
    RAISE EXCEPTION 'Sem permissão para encerrar esta aula';
  END IF;

  UPDATE public.live_class_sessions
  SET left_at = now(),
      status = 'encerrada',
      total_seconds = GREATEST(0, EXTRACT(EPOCH FROM (LEAST(now(), last_seen_at + interval '30 seconds') - joined_at))::int),
      updated_at = now()
  WHERE live_class_id = _live_class_id AND left_at IS NULL;
  GET DIAGNOSTICS _closed = ROW_COUNT;

  UPDATE public.live_classes
  SET status = 'encerrada', ended_at = COALESCE(ended_at, now()), updated_at = now()
  WHERE id = _live_class_id;

  RETURN jsonb_build_object('sessions_closed', _closed);
END;
$$;
REVOKE ALL ON FUNCTION public.live_end_class(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.live_end_class(uuid) TO authenticated;

-- Presença consolidada de uma aula
CREATE OR REPLACE FUNCTION public.live_attendance_report(_live_class_id uuid)
RETURNS TABLE (
  user_id uuid, full_name text, first_join timestamptz, last_leave timestamptz,
  total_seconds bigint, percent numeric, presenca text, online boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _dur int; _min numeric;
BEGIN
  IF NOT public.live_can_manage(auth.uid(), _live_class_id) THEN
    RAISE EXCEPTION 'Sem permissão para ver a presença desta aula';
  END IF;

  SELECT GREATEST(1, COALESCE(
    CASE WHEN lc.started_at IS NOT NULL AND lc.ended_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (lc.ended_at - lc.started_at))::int END,
    lc.duration_minutes * 60)) INTO _dur
  FROM public.live_classes lc WHERE lc.id = _live_class_id;

  SELECT COALESCE((value #>> '{}')::numeric, 75) INTO _min
  FROM public.app_settings WHERE key = 'live_attendance_min_percent';
  _min := COALESCE(_min, 75);

  RETURN QUERY
  WITH agg AS (
    SELECT s.user_id AS uid,
           MIN(s.joined_at) AS fj,
           MAX(s.left_at) AS ll,
           SUM(GREATEST(0, CASE WHEN s.left_at IS NULL
                THEN EXTRACT(EPOCH FROM (s.last_seen_at - s.joined_at))::int
                ELSE s.total_seconds END))::bigint AS secs,
           BOOL_OR(s.left_at IS NULL AND s.last_seen_at > now() - interval '90 seconds') AS is_online
    FROM public.live_class_sessions s
    WHERE s.live_class_id = _live_class_id AND s.role = 'participante'
    GROUP BY s.user_id
  )
  SELECT a.uid,
         COALESCE(p.full_name, 'Participante'),
         a.fj, a.ll, a.secs,
         ROUND(LEAST(100, (a.secs::numeric * 100) / _dur), 1),
         CASE WHEN (a.secs::numeric * 100) / _dur >= _min THEN 'presente'
              WHEN a.secs > 0 THEN 'parcial' ELSE 'ausente' END,
         COALESCE(a.is_online, false)
  FROM agg a
  LEFT JOIN public.profiles p ON p.user_id = a.uid
  ORDER BY 2;
END;
$$;
REVOKE ALL ON FUNCTION public.live_attendance_report(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.live_attendance_report(uuid) TO authenticated;

-- Minha presença numa aula (aluno)
CREATE OR REPLACE FUNCTION public.live_my_attendance(_live_class_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _dur int; _secs bigint; _min numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
  SELECT GREATEST(1, COALESCE(
    CASE WHEN lc.started_at IS NOT NULL AND lc.ended_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (lc.ended_at - lc.started_at))::int END,
    lc.duration_minutes * 60)) INTO _dur
  FROM public.live_classes lc WHERE lc.id = _live_class_id;

  SELECT COALESCE(SUM(GREATEST(0, CASE WHEN s.left_at IS NULL
      THEN EXTRACT(EPOCH FROM (s.last_seen_at - s.joined_at))::int
      ELSE s.total_seconds END)), 0)::bigint INTO _secs
  FROM public.live_class_sessions s
  WHERE s.live_class_id = _live_class_id AND s.user_id = auth.uid();

  SELECT COALESCE((value #>> '{}')::numeric, 75) INTO _min
  FROM public.app_settings WHERE key = 'live_attendance_min_percent';
  _min := COALESCE(_min, 75);

  RETURN jsonb_build_object(
    'total_seconds', _secs,
    'percent', ROUND(LEAST(100, (_secs::numeric * 100) / COALESCE(_dur, 1)), 1),
    'min_percent', _min,
    'status', CASE WHEN (_secs::numeric * 100) / COALESCE(_dur, 1) >= _min THEN 'presente'
                   WHEN _secs > 0 THEN 'parcial' ELSE 'ausente' END
  );
END;
$$;
REVOKE ALL ON FUNCTION public.live_my_attendance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.live_my_attendance(uuid) TO authenticated;

-- Histórico do aluno em aulas ao vivo
CREATE OR REPLACE FUNCTION public.live_my_history()
RETURNS TABLE (
  live_class_id uuid, title text, course_title text, scheduled_at timestamptz,
  total_seconds bigint, percent numeric, presenca text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _min numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
  SELECT COALESCE((value #>> '{}')::numeric, 75) INTO _min
  FROM public.app_settings WHERE key = 'live_attendance_min_percent';
  _min := COALESCE(_min, 75);

  RETURN QUERY
  WITH agg AS (
    SELECT s.live_class_id AS lcid,
           SUM(GREATEST(0, CASE WHEN s.left_at IS NULL
               THEN EXTRACT(EPOCH FROM (s.last_seen_at - s.joined_at))::int
               ELSE s.total_seconds END))::bigint AS secs
    FROM public.live_class_sessions s
    WHERE s.user_id = auth.uid()
    GROUP BY s.live_class_id
  )
  SELECT lc.id, lc.title, c.title, lc.scheduled_at, a.secs,
         ROUND(LEAST(100, (a.secs::numeric * 100) / GREATEST(1, COALESCE(
           CASE WHEN lc.started_at IS NOT NULL AND lc.ended_at IS NOT NULL
             THEN EXTRACT(EPOCH FROM (lc.ended_at - lc.started_at))::int END,
           lc.duration_minutes * 60))), 1),
         CASE WHEN (a.secs::numeric * 100) / GREATEST(1, COALESCE(
           CASE WHEN lc.started_at IS NOT NULL AND lc.ended_at IS NOT NULL
             THEN EXTRACT(EPOCH FROM (lc.ended_at - lc.started_at))::int END,
           lc.duration_minutes * 60)) >= _min THEN 'presente'
              WHEN a.secs > 0 THEN 'parcial' ELSE 'ausente' END
  FROM agg a
  JOIN public.live_classes lc ON lc.id = a.lcid
  LEFT JOIN public.courses c ON c.id = lc.course_id
  ORDER BY lc.scheduled_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.live_my_history() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.live_my_history() TO authenticated;

-- Perfis públicos dos participantes de uma aula (nome/avatar apenas)
CREATE OR REPLACE FUNCTION public.live_class_participants(_live_class_id uuid)
RETURNS TABLE (
  user_id uuid, full_name text, avatar_url text, joined_at timestamptz,
  left_at timestamptz, total_seconds bigint, online boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.live_can_manage(auth.uid(), _live_class_id) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  RETURN QUERY
  SELECT s.user_id, COALESCE(p.full_name, 'Participante'), p.avatar_url,
         MIN(s.joined_at), MAX(s.left_at),
         SUM(GREATEST(0, CASE WHEN s.left_at IS NULL
             THEN EXTRACT(EPOCH FROM (s.last_seen_at - s.joined_at))::int
             ELSE s.total_seconds END))::bigint,
         BOOL_OR(s.left_at IS NULL AND s.last_seen_at > now() - interval '90 seconds')
  FROM public.live_class_sessions s
  LEFT JOIN public.profiles p ON p.user_id = s.user_id
  WHERE s.live_class_id = _live_class_id AND s.role = 'participante'
  GROUP BY s.user_id, p.full_name, p.avatar_url
  ORDER BY 2;
END;
$$;
REVOKE ALL ON FUNCTION public.live_class_participants(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.live_class_participants(uuid) TO authenticated;

-- Storage: professores/administradores podem enviar a gravação da própria aula
CREATE POLICY "Responsáveis enviam gravações"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'gravacoes'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'professor') OR public.has_role(auth.uid(), 'moderador'))
);

CREATE POLICY "Responsáveis atualizam gravações"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'gravacoes'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'professor') OR public.has_role(auth.uid(), 'moderador'))
);