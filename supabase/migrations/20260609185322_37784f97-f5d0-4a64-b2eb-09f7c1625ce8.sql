
ALTER TABLE public.presenca_eventos
  ADD COLUMN IF NOT EXISTS data_fim date,
  ADD COLUMN IF NOT EXISTS horario_fim time without time zone;

CREATE OR REPLACE FUNCTION public.encerrar_eventos_vencidos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH upd AS (
    UPDATE public.presenca_eventos
       SET status = 'encerrado',
           updated_at = now()
     WHERE status <> 'encerrado'
       AND (
         (data_fim IS NOT NULL AND horario_fim IS NOT NULL
            AND ((data_fim::timestamp + horario_fim) AT TIME ZONE 'America/Sao_Paulo') < now())
         OR
         (data_fim IS NOT NULL AND horario_fim IS NULL
            AND ((data_fim + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo') < now())
         OR
         (data_fim IS NULL AND horario_fim IS NOT NULL
            AND ((data::timestamp + horario_fim) AT TIME ZONE 'America/Sao_Paulo') < now())
       )
     RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upd;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.encerrar_eventos_vencidos() TO authenticated, anon, service_role;
