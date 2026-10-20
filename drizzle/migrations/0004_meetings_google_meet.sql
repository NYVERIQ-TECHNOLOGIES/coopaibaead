-- Integração oficial do Google Meet com o módulo de Reuniões.
-- Registros históricos permanecem 'nativo' (sala WebRTC da plataforma).
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'nativo'
  CHECK (provider IN ('nativo','google_meet'));

-- Link privado da reunião Google Meet. Tabela separada de meetings para que o
-- RLS possa restringir a leitura a quem pode ENTRAR (meeting_can_enter), e não
-- apenas a quem pode VER a reunião (meeting_can_view) — evita vazar o link
-- para solicitantes pendentes, banidos ou quando a sala está bloqueada.
CREATE TABLE public.meeting_google_links (
  meeting_id uuid PRIMARY KEY REFERENCES public.meetings(id) ON DELETE CASCADE,
  meet_url text NOT NULL CHECK (meet_url ~ '^https://meet\.google\.com/'),
  meet_event_id text,
  meet_conference_id text,
  google_account_email text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.meeting_google_links TO authenticated;
GRANT ALL ON public.meeting_google_links TO service_role;
ALTER TABLE public.meeting_google_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY meeting_google_links_enter ON public.meeting_google_links
  FOR SELECT TO authenticated
  USING (public.meeting_can_enter(meeting_id, auth.uid()));
