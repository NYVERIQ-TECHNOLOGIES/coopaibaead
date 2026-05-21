
-- 1) Campanhas
CREATE TABLE public.cooperados_eventuais_campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  data_inicio date NOT NULL DEFAULT CURRENT_DATE,
  data_fim date NOT NULL,
  limite_vagas integer NOT NULL CHECK (limite_vagas > 0),
  vagas_ocupadas integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','encerrada','arquivada')),
  manter_acesso_cursos boolean NOT NULL DEFAULT true,
  aprovacao_automatica boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cooperados_eventuais_campanhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados veem campanhas visiveis"
ON public.cooperados_eventuais_campanhas FOR SELECT TO authenticated
USING (status IN ('ativa','encerrada') OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins gerenciam campanhas"
ON public.cooperados_eventuais_campanhas FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_campanhas_updated
BEFORE UPDATE ON public.cooperados_eventuais_campanhas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Cursos vinculados
CREATE TABLE public.cooperados_eventuais_cursos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id uuid NOT NULL REFERENCES public.cooperados_eventuais_campanhas(id) ON DELETE CASCADE,
  curso_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campanha_id, curso_id)
);
ALTER TABLE public.cooperados_eventuais_cursos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados veem vinculos"
ON public.cooperados_eventuais_cursos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins gerenciam vinculos"
ON public.cooperados_eventuais_cursos FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 3) Inscrições
CREATE TABLE public.cooperados_eventuais_inscricoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo text NOT NULL UNIQUE,
  campanha_id uuid NOT NULL REFERENCES public.cooperados_eventuais_campanhas(id) ON DELETE RESTRICT,
  usuario_id uuid,
  nome_completo text NOT NULL,
  cpf text NOT NULL,
  rg text NOT NULL,
  email text NOT NULL,
  telefone text NOT NULL,
  cidade text NOT NULL,
  estado text NOT NULL CHECK (length(estado) = 2),
  status text NOT NULL DEFAULT 'aprovada' CHECK (status IN ('pendente','aprovada','cancelada')),
  data_inscricao timestamptz NOT NULL DEFAULT now(),
  data_aprovacao timestamptz,
  aprovado_por uuid,
  motivo_cancelamento text,
  cancelado_por uuid,
  cancelado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campanha_id, cpf)
);
CREATE INDEX idx_insc_campanha ON public.cooperados_eventuais_inscricoes(campanha_id);
CREATE INDEX idx_insc_user ON public.cooperados_eventuais_inscricoes(usuario_id);

ALTER TABLE public.cooperados_eventuais_inscricoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario ve proprias inscricoes"
ON public.cooperados_eventuais_inscricoes FOR SELECT TO authenticated
USING (usuario_id = auth.uid());

CREATE POLICY "Admin/moderador veem todas inscricoes"
ON public.cooperados_eventuais_inscricoes FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderador'));

CREATE POLICY "Admins gerenciam inscricoes"
ON public.cooperados_eventuais_inscricoes FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_insc_updated
BEFORE UPDATE ON public.cooperados_eventuais_inscricoes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Trigger de contagem de vagas + encerramento automático
CREATE OR REPLACE FUNCTION public.cooperados_eventuais_atualiza_vagas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _camp public.cooperados_eventuais_campanhas;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status <> 'cancelada' THEN
    UPDATE public.cooperados_eventuais_campanhas
      SET vagas_ocupadas = vagas_ocupadas + 1, updated_at = now()
      WHERE id = NEW.campanha_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status <> 'cancelada' AND NEW.status = 'cancelada' THEN
      UPDATE public.cooperados_eventuais_campanhas
        SET vagas_ocupadas = GREATEST(vagas_ocupadas - 1, 0), updated_at = now()
        WHERE id = NEW.campanha_id;
    ELSIF OLD.status = 'cancelada' AND NEW.status <> 'cancelada' THEN
      UPDATE public.cooperados_eventuais_campanhas
        SET vagas_ocupadas = vagas_ocupadas + 1, updated_at = now()
        WHERE id = NEW.campanha_id;
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.status <> 'cancelada' THEN
    UPDATE public.cooperados_eventuais_campanhas
      SET vagas_ocupadas = GREATEST(vagas_ocupadas - 1, 0), updated_at = now()
      WHERE id = OLD.campanha_id;
  END IF;

  -- Encerramento automático
  SELECT * INTO _camp FROM public.cooperados_eventuais_campanhas
    WHERE id = COALESCE(NEW.campanha_id, OLD.campanha_id);
  IF _camp.id IS NOT NULL AND _camp.status = 'ativa'
     AND _camp.vagas_ocupadas >= _camp.limite_vagas THEN
    UPDATE public.cooperados_eventuais_campanhas
      SET status = 'encerrada', updated_at = now()
      WHERE id = _camp.id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_insc_vagas
AFTER INSERT OR UPDATE OR DELETE ON public.cooperados_eventuais_inscricoes
FOR EACH ROW EXECUTE FUNCTION public.cooperados_eventuais_atualiza_vagas();

-- 5) RPC de inscrição (SECURITY DEFINER, valida tudo atomicamente)
CREATE OR REPLACE FUNCTION public.inscrever_cooperado_eventual(
  _campanha_id uuid,
  _nome text, _cpf text, _rg text, _email text,
  _telefone text, _cidade text, _estado text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _camp public.cooperados_eventuais_campanhas;
  _cpf_clean text;
  _seq int;
  _protocolo text;
  _new_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO _camp FROM public.cooperados_eventuais_campanhas WHERE id = _campanha_id FOR UPDATE;
  IF _camp.id IS NULL THEN RAISE EXCEPTION 'Campanha não encontrada'; END IF;

  -- Encerrar se expirou
  IF _camp.data_fim < CURRENT_DATE THEN
    UPDATE public.cooperados_eventuais_campanhas SET status='encerrada' WHERE id=_camp.id;
    RAISE EXCEPTION 'Inscrições encerradas';
  END IF;
  IF _camp.status <> 'ativa' THEN RAISE EXCEPTION 'Inscrições encerradas'; END IF;
  IF _camp.vagas_ocupadas >= _camp.limite_vagas THEN
    UPDATE public.cooperados_eventuais_campanhas SET status='encerrada' WHERE id=_camp.id;
    RAISE EXCEPTION 'Inscrições encerradas — vagas esgotadas';
  END IF;
  IF CURRENT_DATE < _camp.data_inicio THEN RAISE EXCEPTION 'Inscrições ainda não iniciaram'; END IF;

  _cpf_clean := regexp_replace(coalesce(_cpf,''), '[^0-9]', '', 'g');
  IF length(_cpf_clean) <> 11 THEN RAISE EXCEPTION 'CPF inválido'; END IF;
  IF length(coalesce(_nome,'')) < 2 THEN RAISE EXCEPTION 'Nome inválido'; END IF;
  IF coalesce(_email,'') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'E-mail inválido'; END IF;
  IF length(coalesce(_estado,'')) <> 2 THEN RAISE EXCEPTION 'Estado inválido'; END IF;

  IF EXISTS (SELECT 1 FROM public.cooperados_eventuais_inscricoes
             WHERE campanha_id=_camp.id AND cpf=_cpf_clean) THEN
    RAISE EXCEPTION 'CPF já inscrito nesta campanha';
  END IF;

  -- Protocolo CPB-YYYY-NNNNNN
  SELECT COUNT(*)+1 INTO _seq FROM public.cooperados_eventuais_inscricoes
    WHERE date_part('year', created_at) = date_part('year', now());
  _protocolo := 'CPB-' || to_char(now(),'YYYY') || '-' || LPAD(_seq::text, 6, '0');

  INSERT INTO public.cooperados_eventuais_inscricoes (
    protocolo, campanha_id, usuario_id, nome_completo, cpf, rg, email,
    telefone, cidade, estado, status, data_aprovacao
  ) VALUES (
    _protocolo, _camp.id, _uid, trim(_nome), _cpf_clean, trim(_rg), lower(trim(_email)),
    trim(_telefone), trim(_cidade), upper(trim(_estado)),
    CASE WHEN _camp.aprovacao_automatica THEN 'aprovada' ELSE 'pendente' END,
    CASE WHEN _camp.aprovacao_automatica THEN now() ELSE NULL END
  )
  RETURNING id INTO _new_id;

  RETURN jsonb_build_object('id', _new_id, 'protocolo', _protocolo);
END;
$$;

-- 6) RPC de cancelamento
CREATE OR REPLACE FUNCTION public.cancelar_inscricao_eventual(_id uuid, _motivo text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Não autorizado'; END IF;
  UPDATE public.cooperados_eventuais_inscricoes SET
    status='cancelada',
    motivo_cancelamento=_motivo,
    cancelado_por=auth.uid(),
    cancelado_em=now()
  WHERE id=_id AND status<>'cancelada';
END;
$$;

-- 7) Função de acesso a curso por inscrição eventual
CREATE OR REPLACE FUNCTION public.tem_acesso_curso_eventual(_user_id uuid, _course_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cooperados_eventuais_inscricoes i
    JOIN public.cooperados_eventuais_cursos cv ON cv.campanha_id = i.campanha_id
    JOIN public.cooperados_eventuais_campanhas c ON c.id = i.campanha_id
    WHERE i.usuario_id = _user_id
      AND cv.curso_id = _course_id
      AND i.status = 'aprovada'
      AND (
        c.status = 'ativa'
        OR (c.status IN ('encerrada','arquivada') AND c.manter_acesso_cursos = true)
      )
  );
$$;

-- 8) Estender can_access_course para considerar acesso eventual
CREATE OR REPLACE FUNCTION public.can_access_course(_user_id uuid, _course_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = _course_id
      AND (
        public.has_role(_user_id, 'admin')
        OR public.tem_acesso_curso_eventual(_user_id, _course_id)
        OR (
          (NOT c.cooperado_only OR public.has_role(_user_id, 'cooperado'))
          AND EXISTS (
            SELECT 1 FROM public.enrollments e
            WHERE e.user_id = _user_id
              AND e.course_id = _course_id
              AND e.status = 'ativo'
          )
          AND (
            c.is_paid = false
            OR public.has_purchased_course(_user_id, _course_id)
            OR (c.premium_enabled AND public.has_active_subscription(_user_id))
          )
        )
      )
  )
$$;

-- 9) Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.cooperados_eventuais_campanhas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cooperados_eventuais_inscricoes;
