-- 1) Tabela de cooperativas selecionáveis no cadastro
CREATE TABLE IF NOT EXISTS public.cooperativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cooperativas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view active cooperativas"
ON public.cooperativas FOR SELECT TO authenticated
USING (active = true);

CREATE POLICY "Admins manage cooperativas"
ON public.cooperativas FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.cooperativas (name) VALUES ('Coopaíba')
ON CONFLICT (name) DO NOTHING;

-- 2) RLS para realtime.messages (Supabase Realtime broadcast/presence)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'realtime' AND table_name = 'messages'
  ) THEN
    EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'realtime' AND tablename = 'messages'
        AND policyname = 'Authenticated can read realtime'
    ) THEN
      EXECUTE 'CREATE POLICY "Authenticated can read realtime" ON realtime.messages FOR SELECT TO authenticated USING (true)';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'realtime' AND tablename = 'messages'
        AND policyname = 'Authenticated can write realtime'
    ) THEN
      EXECUTE 'CREATE POLICY "Authenticated can write realtime" ON realtime.messages FOR INSERT TO authenticated WITH CHECK (true)';
    END IF;
  END IF;
END $$;