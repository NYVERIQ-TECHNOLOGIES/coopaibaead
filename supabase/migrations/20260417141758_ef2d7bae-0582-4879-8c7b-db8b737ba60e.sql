DO $$
DECLARE
  _uid uuid;
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE email = 'gustavoadmin@coopaiba.com.br';
  IF _uid IS NOT NULL THEN
    UPDATE auth.users
    SET encrypted_password = crypt('Coop@Master#2026!Secure', gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        confirmation_token = '',
        recovery_token = '',
        email_change_token_new = '',
        email_change = '',
        updated_at = now()
    WHERE id = _uid;
  END IF;
END $$;