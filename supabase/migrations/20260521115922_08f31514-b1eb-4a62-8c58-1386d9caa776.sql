
-- 1. Extend certificates table with pickup/delivery fields
ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS pdf_path text,
  ADD COLUMN IF NOT EXISTS student_name_snapshot text,
  ADD COLUMN IF NOT EXISTS student_cpf_snapshot text,
  ADD COLUMN IF NOT EXISTS course_title_snapshot text,
  ADD COLUMN IF NOT EXISTS course_duration_snapshot text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS available_at timestamptz,
  ADD COLUMN IF NOT EXISTS pickup_registered_at timestamptz,
  ADD COLUMN IF NOT EXISTS pickup_registered_by uuid,
  ADD COLUMN IF NOT EXISTS pickup_attendant_name text,
  ADD COLUMN IF NOT EXISTS pickup_document_presented text,
  ADD COLUMN IF NOT EXISTS pickup_observations text,
  ADD COLUMN IF NOT EXISTS pickup_signature_url text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS reissued_from uuid REFERENCES public.certificates(id) ON DELETE SET NULL;

-- Backfill legacy 'emitido' -> 'disponivel_retirada' so all issued certs default to in-person pickup
UPDATE public.certificates
SET status = 'disponivel_retirada',
    available_at = COALESCE(available_at, issued_at, created_at)
WHERE status = 'emitido';

-- 2. Audit log for certificate lifecycle
CREATE TABLE IF NOT EXISTS public.certificate_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id uuid NOT NULL,
  action text NOT NULL,
  actor_user_id uuid,
  actor_name text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.certificate_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view cert audit"
ON public.certificate_audit_log FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Moderators view cert audit"
ON public.certificate_audit_log FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'moderador'));

CREATE POLICY "Admins insert cert audit"
ON public.certificate_audit_log FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners view own cert audit"
ON public.certificate_audit_log FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.certificates c
  WHERE c.id = certificate_audit_log.certificate_id
    AND c.user_id = auth.uid()
));

-- 3. Platform notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  message text NOT NULL,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications(user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins manage notifications"
ON public.notifications FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. App settings default for certificate pickup info
INSERT INTO public.app_settings (key, value)
VALUES (
  'cert_pickup_info',
  jsonb_build_object(
    'cooperativa_nome', 'Cooperativa Coopaíba',
    'endereco', '',
    'cidade', '',
    'horario', 'Segunda a sexta, das 08h às 17h',
    'telefone', '',
    'documentos_necessarios', jsonb_build_array('Documento oficial com foto', 'CPF (caso não conste no documento)')
  )
)
ON CONFLICT (key) DO NOTHING;

-- 5. Admin RPC: register pickup delivery
CREATE OR REPLACE FUNCTION public.register_certificate_pickup(
  _certificate_id uuid,
  _attendant_name text,
  _document_presented text,
  _observations text,
  _signature_url text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _cert public.certificates%ROWTYPE;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderador')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO _cert FROM public.certificates WHERE id = _certificate_id;
  IF _cert.id IS NULL THEN
    RAISE EXCEPTION 'Certificado não encontrado';
  END IF;
  IF _cert.status <> 'disponivel_retirada' THEN
    RAISE EXCEPTION 'Certificado não está disponível para retirada (status atual: %)', _cert.status;
  END IF;
  IF _attendant_name IS NULL OR length(trim(_attendant_name)) < 2 THEN
    RAISE EXCEPTION 'Nome do atendente obrigatório';
  END IF;
  IF _document_presented IS NULL OR length(trim(_document_presented)) < 2 THEN
    RAISE EXCEPTION 'Documento apresentado obrigatório';
  END IF;

  UPDATE public.certificates SET
    status = 'retirado',
    pickup_registered_at = now(),
    pickup_registered_by = auth.uid(),
    pickup_attendant_name = trim(_attendant_name),
    pickup_document_presented = trim(_document_presented),
    pickup_observations = _observations,
    pickup_signature_url = _signature_url,
    updated_at = now()
  WHERE id = _certificate_id;

  INSERT INTO public.certificate_audit_log (certificate_id, action, actor_user_id, actor_name, details)
  VALUES (
    _certificate_id, 'retirado', auth.uid(), trim(_attendant_name),
    jsonb_build_object(
      'document_presented', _document_presented,
      'observations', _observations,
      'has_signature', _signature_url IS NOT NULL
    )
  );
END;
$$;

-- 6. Admin RPC: cancel certificate
CREATE OR REPLACE FUNCTION public.cancel_certificate(
  _certificate_id uuid,
  _reason text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.certificates SET
    status = 'cancelado',
    cancelled_at = now(),
    cancelled_by = auth.uid(),
    cancellation_reason = _reason,
    updated_at = now()
  WHERE id = _certificate_id;

  INSERT INTO public.certificate_audit_log (certificate_id, action, actor_user_id, details)
  VALUES (_certificate_id, 'cancelado', auth.uid(), jsonb_build_object('reason', _reason));
END;
$$;

-- 7. Admin RPC: mark available manually (force)
CREATE OR REPLACE FUNCTION public.mark_certificate_available(
  _certificate_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _course_title text;
  _cert_code text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.certificates SET
    status = 'disponivel_retirada',
    available_at = COALESCE(available_at, now()),
    issued_at = COALESCE(issued_at, now()),
    updated_at = now()
  WHERE id = _certificate_id
  RETURNING user_id, code INTO _user_id, _cert_code;

  SELECT co.title INTO _course_title
  FROM public.certificates c
  JOIN public.courses co ON co.id = c.course_id
  WHERE c.id = _certificate_id;

  INSERT INTO public.certificate_audit_log (certificate_id, action, actor_user_id, details)
  VALUES (_certificate_id, 'disponibilizado', auth.uid(), jsonb_build_object('code', _cert_code));

  IF _user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      _user_id,
      'certificate_available',
      'Certificado disponível para retirada',
      'Seu certificado do curso ' || COALESCE(_course_title, '') || ' está disponível para retirada presencial na Cooperativa Coopaíba.',
      '/certificates/' || _cert_code || '/retirada'
    );
  END IF;
END;
$$;
