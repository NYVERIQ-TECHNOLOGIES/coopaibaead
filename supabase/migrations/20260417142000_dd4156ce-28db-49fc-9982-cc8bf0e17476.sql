DO $$
DECLARE
  _uid uuid;
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE email = 'gustavoadmin@coopaiba.com.br';

  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Usuário gustavoadmin@coopaiba.com.br não encontrado';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt('Coop@Master#2026!Secure', gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      aud = 'authenticated',
      role = 'authenticated',
      raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      updated_at = now()
  WHERE id = _uid;

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
    _uid,
    _uid,
    jsonb_build_object(
      'sub', _uid::text,
      'email', 'gustavoadmin@coopaiba.com.br',
      'email_verified', true
    ),
    'email',
    'gustavoadmin@coopaiba.com.br',
    now(),
    now(),
    now()
  )
  ON CONFLICT (provider, provider_id) DO UPDATE
  SET identity_data = EXCLUDED.identity_data,
      user_id = EXCLUDED.user_id,
      updated_at = now();
END $$;