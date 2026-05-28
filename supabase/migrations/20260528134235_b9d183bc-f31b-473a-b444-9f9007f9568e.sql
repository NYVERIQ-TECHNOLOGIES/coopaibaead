
ALTER TABLE public.cooperados_eventuais_inscricoes
  ADD COLUMN IF NOT EXISTS endereco text;

ALTER TABLE public.cooperados_eventuais_inscricoes
  ALTER COLUMN rg DROP NOT NULL,
  ALTER COLUMN cidade DROP NOT NULL,
  ALTER COLUMN estado DROP NOT NULL;

ALTER TABLE public.cooperados_eventuais_inscricoes
  DROP CONSTRAINT IF EXISTS cooperados_eventuais_inscricoes_estado_check;

DROP FUNCTION IF EXISTS public.inscrever_cooperado_eventual(uuid, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.inscrever_cooperado_eventual(
  _campanha_id uuid,
  _nome text,
  _cpf text,
  _telefone text,
  _endereco text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _camp public.cooperados_eventuais_campanhas;
  _cpf_clean text;
  _seq int;
  _protocolo text;
  _new_id uuid;
  _email text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT email INTO _email FROM auth.users WHERE id = _uid;

  SELECT * INTO _camp FROM public.cooperados_eventuais_campanhas WHERE id = _campanha_id FOR UPDATE;
  IF _camp.id IS NULL THEN RAISE EXCEPTION 'Campanha não encontrada'; END IF;

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
  IF length(regexp_replace(coalesce(_telefone,''), '[^0-9]', '', 'g')) < 10 THEN RAISE EXCEPTION 'Telefone inválido'; END IF;
  IF length(coalesce(_endereco,'')) < 5 THEN RAISE EXCEPTION 'Endereço inválido'; END IF;

  IF EXISTS (SELECT 1 FROM public.cooperados_eventuais_inscricoes
             WHERE campanha_id=_camp.id AND cpf=_cpf_clean) THEN
    RAISE EXCEPTION 'CPF já inscrito nesta campanha';
  END IF;

  SELECT COUNT(*)+1 INTO _seq FROM public.cooperados_eventuais_inscricoes
    WHERE date_part('year', created_at) = date_part('year', now());
  _protocolo := 'CPB-' || to_char(now(),'YYYY') || '-' || LPAD(_seq::text, 6, '0');

  INSERT INTO public.cooperados_eventuais_inscricoes (
    protocolo, campanha_id, usuario_id, nome_completo, cpf, email,
    telefone, endereco, status, data_aprovacao
  ) VALUES (
    _protocolo, _camp.id, _uid, trim(_nome), _cpf_clean, lower(coalesce(_email,'')),
    trim(_telefone), trim(_endereco),
    CASE WHEN _camp.aprovacao_automatica THEN 'aprovada' ELSE 'pendente' END,
    CASE WHEN _camp.aprovacao_automatica THEN now() ELSE NULL END
  )
  RETURNING id INTO _new_id;

  RETURN jsonb_build_object('id', _new_id, 'protocolo', _protocolo);
END;
$function$;
