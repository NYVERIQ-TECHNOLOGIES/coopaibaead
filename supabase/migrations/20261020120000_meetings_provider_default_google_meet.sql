-- Google Meet passa a ser o metodo padrao para NOVAS reunioes.
-- Somente o default da coluna muda: nenhum registro existente e alterado e o
-- CHECK (provider IN ('nativo','google_meet')) continua valendo para as duas
-- opcoes (Google Meet padrao e alternativa sem Meet).
-- Idempotente e protegido para ambientes onde a tabela ainda nao existe.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'meetings'
  ) THEN
    ALTER TABLE public.meetings
      ALTER COLUMN provider SET DEFAULT 'google_meet';
  END IF;
END $$;
