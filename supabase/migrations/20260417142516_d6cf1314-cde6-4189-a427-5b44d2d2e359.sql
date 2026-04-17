DO $$
DECLARE
  _uid uuid;
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE email = 'gustavoadmin@coopaiba.com.br';

  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Usuário gustavoadmin@coopaiba.com.br não encontrado';
  END IF;

  DELETE FROM auth.identities WHERE user_id = _uid AND provider = 'email';

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    _uid,
    jsonb_build_object(
      'sub', _uid::text,
      'email', 'gustavoadmin@coopaiba.com.br',
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    _uid::text,
    now(),
    now(),
    now()
  );
END $$;