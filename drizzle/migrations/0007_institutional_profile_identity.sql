ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cnpj text, ADD COLUMN IF NOT EXISTS nire text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_cnpj_unique ON public.profiles(cnpj) WHERE cnpj IS NOT NULL;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_institution_identity CHECK (cnpj IS NULL OR (cnpj ~ '^[0-9]{14}$' AND nire ~ '^[0-9]{11}$' AND cpf IS NULL AND data_nascimento IS NULL));
CREATE OR REPLACE FUNCTION public.protect_institution_identity() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF TG_OP = 'INSERT' THEN
  IF (NEW.cnpj IS NOT NULL OR NEW.nire IS NOT NULL) AND auth.role() IS DISTINCT FROM 'service_role' AND NOT COALESCE(public.has_role(auth.uid(),'admin'),false) THEN
   RAISE EXCEPTION 'Somente administradores podem cadastrar identificação institucional';
  END IF;
 ELSIF (NEW.cnpj IS DISTINCT FROM OLD.cnpj OR NEW.nire IS DISTINCT FROM OLD.nire) AND auth.role() IS DISTINCT FROM 'service_role' AND NOT COALESCE(public.has_role(auth.uid(),'admin'),false) THEN
  RAISE EXCEPTION 'Somente administradores podem alterar identificação institucional';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_institution_identity BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_institution_identity();