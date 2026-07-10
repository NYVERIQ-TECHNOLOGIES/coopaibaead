
CREATE TABLE public.password_reset_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  target_email text,
  performed_at timestamptz NOT NULL DEFAULT now(),
  user_agent text
);

GRANT SELECT ON public.password_reset_logs TO authenticated;
GRANT ALL ON public.password_reset_logs TO service_role;

ALTER TABLE public.password_reset_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view password reset logs"
ON public.password_reset_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_password_reset_logs_performed_at ON public.password_reset_logs (performed_at DESC);
