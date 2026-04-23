-- =====================================================================
-- 1) MATRÍCULAS: bloquear self-enroll em cursos cooperado_only
-- =====================================================================
DROP POLICY IF EXISTS "Users can self-enroll" ON public.enrollments;

CREATE POLICY "Users can self-enroll"
ON public.enrollments
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    -- curso não é cooperado-only
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id AND c.cooperado_only = false
    )
    -- ou usuário é cooperado/admin
    OR public.has_role(auth.uid(), 'cooperado'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- =====================================================================
-- 2) EXAM_ATTEMPTS: remover INSERT direto do cliente
-- =====================================================================
-- A função submit_exam_answers (SECURITY DEFINER) já existe e calcula
-- score no servidor. Removemos o INSERT direto para forçar uso da função.
DROP POLICY IF EXISTS "Users insert own attempts" ON public.exam_attempts;

-- (SELECT policies permanecem: usuários veem suas tentativas, admins veem tudo)
-- A função SECURITY DEFINER continua podendo inserir, pois roda com
-- privilégios do owner, ignorando RLS.

-- =====================================================================
-- 3) CPF: criar view pública sem dados sensíveis
-- =====================================================================
-- View segura para áreas públicas (chat, fórum, ranking).
-- Não inclui cpf nem enrollment_number.
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = true)
AS
SELECT
  user_id,
  full_name,
  avatar_url,
  cooperativa,
  is_active
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO authenticated, anon;

-- =====================================================================
-- 4) STORAGE: remover listagem ampla do bucket público 'avatars'
-- =====================================================================
-- Buckets públicos no Supabase servem objetos via URL pública sem
-- precisar de policy. Mas uma policy SELECT aberta em storage.objects
-- permite LISTAR todo o bucket — isso é o que o linter alerta.
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Avatars public read" ON storage.objects;

-- Permite que cada usuário gerencie SEUS arquivos no bucket avatars
-- (path no formato "<user_id>/...").
DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
CREATE POLICY "Users upload own avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
CREATE POLICY "Users update own avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users delete own avatar" ON storage.objects;
CREATE POLICY "Users delete own avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Não criamos policy SELECT ampla. O bucket 'avatars' é público,
-- então URLs diretas continuam funcionando, mas a LISTAGEM do bucket
-- via API exige autenticação e fica restrita ao dono.
DROP POLICY IF EXISTS "Users list own avatar" ON storage.objects;
CREATE POLICY "Users list own avatar"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- =====================================================================
-- 5) REALTIME: restringir canais privados por tópico
-- =====================================================================
-- Política por tópico em realtime.messages.
-- Convenção de tópicos privados:
--   "support:user:<user_id>"   -> dono do canal
--   "support:admin"            -> apenas admins
--   "course:<course_id>"       -> qualquer usuário com acesso ao curso
DROP POLICY IF EXISTS "Authenticated can read all" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated can write all" ON realtime.messages;
DROP POLICY IF EXISTS "Allow authenticated read" ON realtime.messages;
DROP POLICY IF EXISTS "Allow authenticated write" ON realtime.messages;
DROP POLICY IF EXISTS "realtime_messages_select" ON realtime.messages;
DROP POLICY IF EXISTS "realtime_messages_insert" ON realtime.messages;

CREATE POLICY "realtime_messages_select"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Admins podem ouvir qualquer canal
  public.has_role(auth.uid(), 'admin'::app_role)
  -- Canal privado de suporte: dono pode ouvir
  OR (
    realtime.topic() LIKE 'support:user:%'
    AND split_part(realtime.topic(), ':', 3) = auth.uid()::text
  )
  -- Canal de curso: qualquer um com acesso ao curso
  OR (
    realtime.topic() LIKE 'course:%'
    AND public.can_access_course(
      auth.uid(),
      NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid
    )
  )
);

CREATE POLICY "realtime_messages_insert"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    realtime.topic() LIKE 'support:user:%'
    AND split_part(realtime.topic(), ':', 3) = auth.uid()::text
  )
  OR (
    realtime.topic() LIKE 'course:%'
    AND public.can_access_course(
      auth.uid(),
      NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid
    )
  )
);