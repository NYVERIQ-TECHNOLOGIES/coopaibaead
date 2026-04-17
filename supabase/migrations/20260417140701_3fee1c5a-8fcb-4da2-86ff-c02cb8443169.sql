DO $$
DECLARE
  _new_user_id uuid := gen_random_uuid();
  _existing_id uuid;
BEGIN
  SELECT id INTO _existing_id FROM auth.users WHERE email = 'gustavoadmin@coopaiba.com.br';

  IF _existing_id IS NULL THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', _new_user_id, 'authenticated', 'authenticated',
      'gustavoadmin@coopaiba.com.br',
      crypt('Cristal12@', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Gustavo Admin Master"}'::jsonb,
      '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), _new_user_id::text, _new_user_id,
      jsonb_build_object('sub', _new_user_id::text, 'email', 'gustavoadmin@coopaiba.com.br', 'email_verified', true),
      'email', now(), now(), now()
    );
  ELSE
    _new_user_id := _existing_id;
    UPDATE auth.users
    SET encrypted_password = crypt('Cristal12@', gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = _new_user_id;
  END IF;

  INSERT INTO public.profiles (user_id, full_name)
  VALUES (_new_user_id, 'Gustavo Admin Master')
  ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name;

  DELETE FROM public.user_roles WHERE user_id = _new_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_new_user_id, 'admin');
END $$;