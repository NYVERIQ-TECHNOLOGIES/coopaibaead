
-- =========== Tabela de eventos ===========
CREATE TABLE public.presenca_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'reuniao',
  descricao text,
  data date NOT NULL DEFAULT CURRENT_DATE,
  horario time,
  local text,
  responsavel text,
  expected_count integer,
  status text NOT NULL DEFAULT 'aberto',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_presenca_eventos_codigo ON public.presenca_eventos(codigo);
CREATE INDEX idx_presenca_eventos_status ON public.presenca_eventos(status);

-- Gera código curto único (6 chars alfanuméricos uppercase) e mantém updated_at
CREATE OR REPLACE FUNCTION public.presenca_eventos_set_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _try int := 0;
  _candidate text;
BEGIN
  IF NEW.codigo IS NULL OR length(trim(NEW.codigo)) = 0 THEN
    LOOP
      _candidate := upper(substr(translate(encode(gen_random_bytes(6), 'base64'), '+/=', 'XYZ'), 1, 6));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.presenca_eventos WHERE codigo = _candidate);
      _try := _try + 1;
      IF _try > 10 THEN
        RAISE EXCEPTION 'Não foi possível gerar código único';
      END IF;
    END LOOP;
    NEW.codigo := _candidate;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_presenca_eventos_defaults
BEFORE INSERT OR UPDATE ON public.presenca_eventos
FOR EACH ROW EXECUTE FUNCTION public.presenca_eventos_set_defaults();

ALTER TABLE public.presenca_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/moderadores veem eventos"
ON public.presenca_eventos FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderador'));

CREATE POLICY "Admins gerenciam eventos"
ON public.presenca_eventos FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========== Tabela de assinaturas ===========
CREATE TABLE public.presenca_assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES public.presenca_eventos(id) ON DELETE CASCADE,
  cooperado_user_id uuid,
  nome text NOT NULL,
  cpf text,
  matricula text,
  assinatura_url text,
  assinatura_tipo text NOT NULL DEFAULT 'desenho',
  horario timestamptz NOT NULL DEFAULT now(),
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_presenca_assinaturas_evento ON public.presenca_assinaturas(evento_id);
CREATE UNIQUE INDEX uq_presenca_assinaturas_evento_cpf ON public.presenca_assinaturas(evento_id, cpf) WHERE cpf IS NOT NULL;
CREATE UNIQUE INDEX uq_presenca_assinaturas_evento_matricula ON public.presenca_assinaturas(evento_id, matricula) WHERE matricula IS NOT NULL;

ALTER TABLE public.presenca_assinaturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/moderadores veem assinaturas"
ON public.presenca_assinaturas FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderador'));

CREATE POLICY "Admins gerenciam assinaturas"
ON public.presenca_assinaturas FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========== RPC pública: dados do evento por código ===========
CREATE OR REPLACE FUNCTION public.get_evento_publico(_codigo text)
RETURNS TABLE (
  id uuid, codigo text, nome text, tipo text, descricao text,
  data date, horario time, local text, responsavel text, status text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, codigo, nome, tipo, descricao, data, horario, local, responsavel, status
  FROM public.presenca_eventos
  WHERE codigo = upper(_codigo)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_evento_publico(text) TO anon, authenticated;

-- =========== RPC pública: registrar presença ===========
CREATE OR REPLACE FUNCTION public.registrar_presenca(
  _codigo text,
  _nome text,
  _cpf text,
  _matricula text,
  _assinatura_url text,
  _assinatura_tipo text,
  _ip text,
  _user_agent text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _evento public.presenca_eventos;
  _new_id uuid;
  _cpf_clean text;
BEGIN
  IF _nome IS NULL OR length(trim(_nome)) < 2 THEN
    RAISE EXCEPTION 'Nome inválido';
  END IF;

  SELECT * INTO _evento FROM public.presenca_eventos WHERE codigo = upper(_codigo);
  IF _evento.id IS NULL THEN
    RAISE EXCEPTION 'Evento não encontrado';
  END IF;
  IF _evento.status <> 'aberto' THEN
    RAISE EXCEPTION 'Evento encerrado';
  END IF;

  _cpf_clean := NULLIF(regexp_replace(coalesce(_cpf,''), '[^0-9]', '', 'g'), '');
  IF _cpf_clean IS NOT NULL AND length(_cpf_clean) <> 11 THEN
    RAISE EXCEPTION 'CPF inválido';
  END IF;

  INSERT INTO public.presenca_assinaturas
    (evento_id, nome, cpf, matricula, assinatura_url, assinatura_tipo, ip, user_agent)
  VALUES
    (_evento.id, trim(_nome), _cpf_clean, NULLIF(trim(coalesce(_matricula,'')), ''),
     _assinatura_url, coalesce(_assinatura_tipo, 'desenho'), _ip, _user_agent)
  RETURNING id INTO _new_id;

  RETURN jsonb_build_object('id', _new_id, 'evento_id', _evento.id, 'horario', now());
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Presença já registrada para este CPF/matrícula';
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_presenca(text,text,text,text,text,text,text,text) TO anon, authenticated;

-- =========== Realtime ===========
ALTER PUBLICATION supabase_realtime ADD TABLE public.presenca_assinaturas;
ALTER TABLE public.presenca_assinaturas REPLICA IDENTITY FULL;

-- =========== Storage bucket privado para assinaturas ===========
INSERT INTO storage.buckets (id, name, public) VALUES ('assinaturas', 'assinaturas', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can upload signatures"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id = 'assinaturas');

CREATE POLICY "Admins read signatures"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'assinaturas' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderador')));

CREATE POLICY "Admins delete signatures"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'assinaturas' AND public.has_role(auth.uid(), 'admin'));
