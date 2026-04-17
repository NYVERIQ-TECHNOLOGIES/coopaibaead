
-- 1. Soft delete em profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;

-- 2. Garante trigger de matrícula automática (caso não exista)
DROP TRIGGER IF EXISTS trg_assign_enrollment_number ON public.profiles;
CREATE TRIGGER trg_assign_enrollment_number
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_enrollment_number();

-- Garante que a sequence existe (defensivo)
CREATE SEQUENCE IF NOT EXISTS public.enrollment_number_seq START 1;

-- 3. Tabela de chat por curso
CREATE TABLE IF NOT EXISTS public.course_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  user_id uuid NOT NULL,
  content text NOT NULL CHECK (length(trim(content)) > 0 AND length(content) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_course_chat_course_created 
  ON public.course_chat_messages (course_id, created_at DESC);

ALTER TABLE public.course_chat_messages ENABLE ROW LEVEL SECURITY;

-- Helper: verifica se user pode acessar curso (respeita cooperado_only)
CREATE OR REPLACE FUNCTION public.can_access_course(_user_id uuid, _course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = _course_id
      AND (
        NOT c.cooperado_only
        OR public.has_role(_user_id, 'cooperado')
        OR public.has_role(_user_id, 'admin')
      )
  )
$$;

-- Policies do chat
CREATE POLICY "View chat respecting course access"
  ON public.course_chat_messages FOR SELECT
  TO authenticated
  USING (public.can_access_course(auth.uid(), course_id));

CREATE POLICY "Send chat respecting course access"
  ON public.course_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.can_access_course(auth.uid(), course_id)
  );

CREATE POLICY "Delete own chat or admin"
  ON public.course_chat_messages FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Realtime
ALTER TABLE public.course_chat_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.course_chat_messages;
