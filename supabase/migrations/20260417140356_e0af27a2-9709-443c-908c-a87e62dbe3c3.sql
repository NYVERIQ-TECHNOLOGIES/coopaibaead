DO $$
DECLARE
  _old_user_id uuid;
  _new_user_id uuid;
BEGIN
  SELECT id INTO _old_user_id FROM auth.users WHERE email = 'admin@coopedu.com';
  SELECT id INTO _new_user_id FROM auth.users WHERE email = 'gustavoadmin@coopaiba.com.br';

  IF _old_user_id IS NOT NULL AND _new_user_id IS NOT NULL THEN
    -- Reassign content created by old admin to the new admin
    UPDATE public.media_files SET uploaded_by = _new_user_id WHERE uploaded_by = _old_user_id;
    UPDATE public.certificate_templates SET uploaded_by = _new_user_id WHERE uploaded_by = _old_user_id;
    UPDATE public.courses SET created_by = _new_user_id WHERE created_by = _old_user_id;

    -- Now safe to delete
    DELETE FROM public.user_roles WHERE user_id = _old_user_id;
    DELETE FROM public.profiles WHERE user_id = _old_user_id;
    DELETE FROM auth.identities WHERE user_id = _old_user_id;
    DELETE FROM auth.users WHERE id = _old_user_id;
  END IF;
END $$;