CREATE OR REPLACE FUNCTION public.presenca_eventos_set_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _try int := 0;
  _candidate text;
  _chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  _i int;
BEGIN
  IF NEW.codigo IS NULL OR length(trim(NEW.codigo)) = 0 THEN
    LOOP
      _candidate := '';
      FOR _i IN 1..6 LOOP
        _candidate := _candidate || substr(_chars, 1 + floor(random() * length(_chars))::int, 1);
      END LOOP;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.presenca_eventos WHERE codigo = _candidate);
      _try := _try + 1;
      IF _try > 20 THEN
        RAISE EXCEPTION 'Não foi possível gerar código único';
      END IF;
    END LOOP;
    NEW.codigo := _candidate;
  ELSE
    NEW.codigo := upper(NEW.codigo);
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;