CREATE OR REPLACE FUNCTION public.cpf_ja_cadastrado(_cpf text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE cpf = regexp_replace(COALESCE(_cpf, ''), '\D', '', 'g')
  );
$$;

REVOKE ALL ON FUNCTION public.cpf_ja_cadastrado(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cpf_ja_cadastrado(text) TO anon, authenticated, service_role;