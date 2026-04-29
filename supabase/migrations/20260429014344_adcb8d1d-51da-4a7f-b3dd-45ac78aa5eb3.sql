UPDATE public.profiles p
SET cooperativa = 'Coopaiba', updated_at = now()
FROM auth.users u
WHERE u.id = p.user_id
  AND u.email LIKE 'cpf%@cooperado.coopaiba.com.br'
  AND p.enrollment_number ~ '^COOP-[0-9]{6}$'
  AND CAST(REPLACE(p.enrollment_number, 'COOP-', '') AS integer) <= 887;