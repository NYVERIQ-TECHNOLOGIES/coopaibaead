-- 1. New columns
ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS delivery_mode text NOT NULL DEFAULT 'retirada',
  ADD COLUMN IF NOT EXISTS reissue_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reissued_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_reissued_by uuid,
  ADD COLUMN IF NOT EXISTS error_message text;

DO $$ BEGIN
  ALTER TABLE public.certificates
    ADD CONSTRAINT certificates_delivery_mode_check
    CHECK (delivery_mode IN ('download','retirada'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Trigger to protect issued identity (code, issued_at, created_at)
CREATE OR REPLACE FUNCTION public.protect_certificate_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.issued_at IS NOT NULL THEN
    IF NEW.code IS DISTINCT FROM OLD.code THEN
      RAISE EXCEPTION 'Código do certificado não pode ser alterado após a emissão.'
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.issued_at IS DISTINCT FROM OLD.issued_at THEN
      RAISE EXCEPTION 'Data de emissão original não pode ser alterada.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Data de criação do certificado não pode ser alterada.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_certificate_identity ON public.certificates;
CREATE TRIGGER trg_protect_certificate_identity
BEFORE UPDATE ON public.certificates
FOR EACH ROW
EXECUTE FUNCTION public.protect_certificate_identity();

-- 3. RPC to register a reissue (counter + audit). PDF rebuild happens in edge function.
CREATE OR REPLACE FUNCTION public.register_certificate_reissue(_certificate_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _code text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.certificates
  SET reissue_count = reissue_count + 1,
      last_reissued_at = now(),
      last_reissued_by = auth.uid(),
      error_message = NULL,
      updated_at = now()
  WHERE id = _certificate_id
  RETURNING code INTO _code;

  IF _code IS NULL THEN
    RAISE EXCEPTION 'Certificado não encontrado';
  END IF;

  INSERT INTO public.certificate_audit_log (certificate_id, action, actor_user_id, details)
  VALUES (_certificate_id, 'reemitido', auth.uid(), jsonb_build_object('code', _code));
END;
$$;

-- 4. Helper to mark error state on a certificate (used by edge functions)
CREATE OR REPLACE FUNCTION public.mark_certificate_error(_certificate_id uuid, _message text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.certificates
  SET status = 'erro',
      error_message = _message,
      updated_at = now()
  WHERE id = _certificate_id;
END;
$$;