-- Atualiza o trigger handle_new_user para atribuir o role correto (cooperado ou aluno)
-- com base em raw_user_meta_data.user_type vindo do cadastro.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_type text;
  _role public.app_role;
BEGIN
  -- Cria/atualiza o profile
  INSERT INTO public.profiles (user_id, full_name, cooperativa, cpf)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'cooperativa',
    NEW.raw_user_meta_data->>'cpf'
  )
  ON CONFLICT (user_id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        cooperativa = COALESCE(EXCLUDED.cooperativa, public.profiles.cooperativa),
        cpf = COALESCE(EXCLUDED.cpf, public.profiles.cpf);

  -- Determina o role com base no metadata
  _user_type := NEW.raw_user_meta_data->>'user_type';
  IF _user_type = 'cooperado' THEN
    _role := 'cooperado';
  ELSE
    _role := 'aluno';
  END IF;

  -- Garante UM único role inicial para o novo usuário
  DELETE FROM public.user_roles WHERE user_id = NEW.id;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role);

  RETURN NEW;
END;
$$;