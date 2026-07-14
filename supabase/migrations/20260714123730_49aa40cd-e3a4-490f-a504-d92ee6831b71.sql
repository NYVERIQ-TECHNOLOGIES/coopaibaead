ALTER TABLE public.cooperado_pending_registrations ADD COLUMN IF NOT EXISTS phone text;

COMMENT ON COLUMN public.cooperado_pending_registrations.phone IS 'Telefone de contato informado no cadastro de cooperado';
