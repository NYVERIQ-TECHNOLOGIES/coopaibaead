
-- Add birth date to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS data_nascimento date;

-- Secure RPC to complete missing profile info; does not overwrite existing values
CREATE OR REPLACE FUNCTION public.complete_profile_info(
  _cpf text DEFAULT NULL,
  _data_nascimento date DEFAULT NULL,
  _phone text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _cur public.profiles%ROWTYPE;
  _cpf_clean text;
  _phone_clean text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _cur FROM public.profiles WHERE user_id = _uid;
  IF _cur.user_id IS NULL THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;

  -- CPF: only if currently empty
  IF (_cur.cpf IS NULL OR length(trim(_cur.cpf)) = 0) AND _cpf IS NOT NULL THEN
    _cpf_clean := regexp_replace(_cpf, '[^0-9]', '', 'g');
    IF length(_cpf_clean) <> 11 THEN
      RAISE EXCEPTION 'CPF inválido';
    END IF;
    IF EXISTS (SELECT 1 FROM public.profiles WHERE cpf = _cpf_clean AND user_id <> _uid) THEN
      RAISE EXCEPTION 'Este CPF já está cadastrado para outro usuário';
    END IF;
    UPDATE public.profiles SET cpf = _cpf_clean, updated_at = now() WHERE user_id = _uid;
  END IF;

  -- Birth date: only if currently empty
  IF _cur.data_nascimento IS NULL AND _data_nascimento IS NOT NULL THEN
    IF _data_nascimento > CURRENT_DATE THEN
      RAISE EXCEPTION 'Data de nascimento não pode ser futura';
    END IF;
    UPDATE public.profiles SET data_nascimento = _data_nascimento, updated_at = now() WHERE user_id = _uid;
  END IF;

  -- Phone: only if currently empty
  IF (_cur.phone IS NULL OR length(trim(_cur.phone)) = 0) AND _phone IS NOT NULL THEN
    _phone_clean := regexp_replace(_phone, '[^0-9]', '', 'g');
    IF length(_phone_clean) < 10 OR length(_phone_clean) > 11 THEN
      RAISE EXCEPTION 'Telefone inválido';
    END IF;
    UPDATE public.profiles SET phone = _phone_clean, updated_at = now() WHERE user_id = _uid;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_profile_info(text, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_profile_info(text, date, text) TO authenticated;
