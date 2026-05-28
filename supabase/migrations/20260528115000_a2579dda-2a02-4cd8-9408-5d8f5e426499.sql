ALTER TABLE public.cooperado_pending_registrations
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'cooperado' CHECK (tipo IN ('cooperado','eventual'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS endereco text;