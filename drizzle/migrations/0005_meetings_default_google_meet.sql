-- Google Meet passa a ser o metodo padrao para NOVAS reunioes.
-- Registros existentes nao sao alterados: cada reuniao mantem o metodo
-- (provider) que ja estava configurado e os links ja criados permanecem.
ALTER TABLE public.meetings
  ALTER COLUMN provider SET DEFAULT 'google_meet';
