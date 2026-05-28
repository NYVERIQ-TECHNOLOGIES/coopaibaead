ALTER TABLE public.cooperado_pending_registrations DROP COLUMN IF EXISTS phone;
ALTER TABLE public.cooperado_pending_registrations DROP COLUMN IF EXISTS endereco;
ALTER TABLE public.cooperado_pending_registrations DROP COLUMN IF EXISTS tipo;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS endereco;