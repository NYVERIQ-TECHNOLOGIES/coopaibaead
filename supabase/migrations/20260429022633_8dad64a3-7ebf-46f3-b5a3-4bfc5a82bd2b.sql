WITH target AS (
  SELECT user_id FROM profiles WHERE enrollment_number IN ('COOP-000092','COOP-000585')
)
DELETE FROM user_roles WHERE user_id IN (SELECT user_id FROM target) AND role IN ('aluno','cooperado');

INSERT INTO user_roles (user_id, role)
SELECT user_id, 'aluno'::app_role FROM profiles WHERE enrollment_number IN ('COOP-000092','COOP-000585')
ON CONFLICT (user_id, role) DO NOTHING;