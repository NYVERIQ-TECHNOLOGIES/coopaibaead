CREATE OR REPLACE FUNCTION public.set_certificate_delivery_mode(_certificate_ids uuid[], _mode text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _count integer := 0;
  _r record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _mode NOT IN ('download','retirada') THEN
    RAISE EXCEPTION 'Modo inválido';
  END IF;

  FOR _r IN
    SELECT id, status FROM public.certificates
    WHERE id = ANY(_certificate_ids) AND status <> 'cancelado'
  LOOP
    UPDATE public.certificates
    SET delivery_mode = _mode,
        status = CASE
          WHEN _mode = 'download' AND status = 'disponivel_retirada' THEN 'emitido'
          WHEN _mode = 'retirada' AND status = 'emitido' THEN 'disponivel_retirada'
          ELSE status
        END,
        available_at = CASE WHEN available_at IS NULL THEN now() ELSE available_at END,
        issued_at = CASE WHEN issued_at IS NULL AND status <> 'pendente' THEN now() ELSE issued_at END,
        updated_at = now()
    WHERE id = _r.id;

    INSERT INTO public.certificate_audit_log (certificate_id, action, actor_user_id, details)
    VALUES (_r.id,
            CASE WHEN _mode = 'download' THEN 'liberado_download' ELSE 'restrito_retirada' END,
            auth.uid(),
            jsonb_build_object('delivery_mode', _mode));

    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$$;

REVOKE ALL ON FUNCTION public.set_certificate_delivery_mode(uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_certificate_delivery_mode(uuid[], text) TO authenticated;