-- Security fix: Remove client-controlled cooperado role assignment in handle_new_user trigger.
-- Previously, anyone could call supabase.auth.signUp({ data: { user_type: 'cooperado' } })
-- and instantly receive the cooperado role, bypassing the admin-approval flow.
-- The approve-cooperado-registration and bulk-import-cooperados edge functions
-- already explicitly assign the cooperado role via service-role after creation,
-- so always defaulting to 'aluno' here has no impact on legitimate flows.

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Create/update the profile
  INSERT INTO public.profiles (user_id, full_name, cooperativa, cpf)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'cooperativa',
    NEW.raw_user_meta_data->>'cpf'
  )
  ON CONFLICT (user_id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        cooperativa = COALESCE(EXCLUDED.cooperativa, public.profiles.cooperativa),
        cpf = COALESCE(EXCLUDED.cpf, public.profiles.cpf);

  -- SECURITY: Always assign 'aluno' on self-signup. Never trust client metadata
  -- to elevate to 'cooperado' or any other privileged role. Cooperado promotion
  -- happens exclusively through the admin-approved edge function flow using
  -- the service role key.
  DELETE FROM public.user_roles WHERE user_id = NEW.id;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'aluno'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$function$;