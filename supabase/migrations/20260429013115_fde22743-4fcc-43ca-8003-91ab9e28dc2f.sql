-- Converter para 'cooperado' todas as contas que possuem CPF mas estão como 'aluno'
-- (essas contas vieram da importação em massa do documento de cooperados)

INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'cooperado'::app_role
FROM public.profiles p
JOIN public.user_roles ur ON ur.user_id = p.user_id
WHERE p.cpf IS NOT NULL
  AND length(trim(p.cpf)) > 0
  AND ur.role = 'aluno'
ON CONFLICT (user_id, role) DO NOTHING;

-- Remove o role 'aluno' dessas mesmas contas
DELETE FROM public.user_roles ur
USING public.profiles p
WHERE ur.user_id = p.user_id
  AND ur.role = 'aluno'
  AND p.cpf IS NOT NULL
  AND length(trim(p.cpf)) > 0;