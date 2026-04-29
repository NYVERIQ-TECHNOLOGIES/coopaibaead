-- Converter para 'cooperado' apenas contas criadas pela importação em massa
-- Critérios:
--   1) email no padrão cpf<digitos>@cooperado.coopaiba.com.br (gerado pelo importador)
--   2) matrícula <= COOP-000887 (não alterar nada acima desse número)
--   3) papel atual diferente de 'cooperado' OU sem papel
DO $$
DECLARE
  _max_num int := 887;
BEGIN
  -- Remover papéis incorretos (aluno) das contas importadas dentro do limite
  DELETE FROM public.user_roles ur
  USING public.profiles p, auth.users u
  WHERE ur.user_id = p.user_id
    AND u.id = p.user_id
    AND u.email LIKE 'cpf%@cooperado.coopaiba.com.br'
    AND p.enrollment_number ~ '^COOP-[0-9]{6}$'
    AND CAST(REPLACE(p.enrollment_number, 'COOP-', '') AS integer) <= _max_num
    AND ur.role <> 'cooperado'
    AND ur.role <> 'admin';

  -- Inserir o papel 'cooperado' onde ainda falta
  INSERT INTO public.user_roles (user_id, role)
  SELECT p.user_id, 'cooperado'::public.app_role
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.user_id
  LEFT JOIN public.user_roles ur
    ON ur.user_id = p.user_id AND ur.role = 'cooperado'
  WHERE u.email LIKE 'cpf%@cooperado.coopaiba.com.br'
    AND p.enrollment_number ~ '^COOP-[0-9]{6}$'
    AND CAST(REPLACE(p.enrollment_number, 'COOP-', '') AS integer) <= _max_num
    AND ur.user_id IS NULL
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;