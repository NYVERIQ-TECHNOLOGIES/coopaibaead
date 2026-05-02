
-- 1) Pending cooperado registrations
CREATE TABLE public.cooperado_pending_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  cpf TEXT NOT NULL UNIQUE,
  email TEXT,
  cooperativa TEXT,
  password_hash TEXT NOT NULL, -- temporary, encrypted password to use upon approval
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cooperado_pending_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view pending registrations"
  ON public.cooperado_pending_registrations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update pending registrations"
  ON public.cooperado_pending_registrations FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete pending registrations"
  ON public.cooperado_pending_registrations FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
-- INSERT only via service role (edge function) — no policy needed for that.

CREATE TRIGGER trg_pending_registrations_updated_at
  BEFORE UPDATE ON public.cooperado_pending_registrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Rate limit table (used by edge functions; service role only)
CREATE TABLE public.edge_function_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name TEXT NOT NULL,
  identifier TEXT NOT NULL, -- e.g. IP address or hashed email
  request_count INTEGER NOT NULL DEFAULT 1,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_rate_limits_function_identifier
  ON public.edge_function_rate_limits (function_name, identifier);

ALTER TABLE public.edge_function_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies: only service role (edge functions) interacts with this table.

-- 3) Bulk import audit log
CREATE TABLE public.bulk_import_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  performed_by UUID NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  created_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bulk_import_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view bulk import audit"
  ON public.bulk_import_audit FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
-- INSERT only via service role.

-- 4) Lock down EXECUTE on new helpers (defense-in-depth)
-- (no SQL functions added here besides the trigger; nothing extra to revoke)
