-- Função: lista usuários (profiles) que não têm registro em user_roles
CREATE OR REPLACE FUNCTION public.get_users_without_role()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  enrollment_number text,
  cooperativa text,
  is_active boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT p.user_id, p.full_name, p.enrollment_number, p.cooperativa, p.is_active, p.created_at
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.user_id
  WHERE ur.user_id IS NULL
  ORDER BY p.created_at DESC;
END;
$$;

-- Função: atribui um role a um usuário (apenas admin)
CREATE OR REPLACE FUNCTION public.assign_default_role(_user_id uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF _role = 'admin' THEN
    RAISE EXCEPTION 'Cannot assign admin role through this function';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

-- Função: atribui role "aluno" a TODOS os perfis sem role
CREATE OR REPLACE FUNCTION public.assign_default_role_bulk()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  WITH inserted AS (
    INSERT INTO public.user_roles (user_id, role)
    SELECT p.user_id, 'aluno'::app_role
    FROM public.profiles p
    LEFT JOIN public.user_roles ur ON ur.user_id = p.user_id
    WHERE ur.user_id IS NULL
    ON CONFLICT (user_id, role) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO _count FROM inserted;

  RETURN _count;
END;
$$;