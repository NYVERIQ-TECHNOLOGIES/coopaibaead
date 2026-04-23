-- Prevent users from changing their CPF once it has been confirmed.
-- The existing "Users can update own profile" policy already restricts updates
-- to the user's own profile. We add a trigger that blocks any change to a
-- non-null CPF, providing backend-level enforcement of the lock.

CREATE OR REPLACE FUNCTION public.prevent_cpf_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If the old CPF was already set (not null and not empty), it cannot change.
  IF OLD.cpf IS NOT NULL AND length(trim(OLD.cpf)) > 0 THEN
    IF NEW.cpf IS DISTINCT FROM OLD.cpf THEN
      RAISE EXCEPTION 'CPF já confirmado e não pode ser alterado.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_cpf_change ON public.profiles;
CREATE TRIGGER profiles_prevent_cpf_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_cpf_change();