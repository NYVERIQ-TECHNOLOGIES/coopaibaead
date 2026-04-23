
-- ============================================================
-- HARDENING DE SEGURANÇA: matrícula obrigatória + realtime fix
-- ============================================================

-- 1) Atualizar can_access_course() para exigir matrícula ATIVA
-- (status = 'ativo' — valor real usado no banco)
-- Admin e cooperado continuam tendo acesso sem matrícula.
CREATE OR REPLACE FUNCTION public.can_access_course(_user_id uuid, _course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = _course_id
      AND (
        public.has_role(_user_id, 'admin')
        OR (
          (NOT c.cooperado_only OR public.has_role(_user_id, 'cooperado'))
          AND EXISTS (
            SELECT 1 FROM public.enrollments e
            WHERE e.user_id = _user_id
              AND e.course_id = _course_id
              AND e.status = 'ativo'
          )
        )
      )
  )
$function$;

-- 2) Remover policies amplamente permissivas em realtime.messages
DROP POLICY IF EXISTS "Authenticated can read realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated can write realtime" ON realtime.messages;

-- As policies seguras realtime_messages_select / realtime_messages_insert
-- já existem e permanecem ativas (admin + dono do tópico support + course access).

-- 3) Garantir que as policies seguras de realtime estejam atualizadas
-- (caso já existam, recria com a mesma lógica usando o novo can_access_course)
DROP POLICY IF EXISTS realtime_messages_select ON realtime.messages;
DROP POLICY IF EXISTS realtime_messages_insert ON realtime.messages;

CREATE POLICY realtime_messages_select ON realtime.messages
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
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

CREATE POLICY realtime_messages_insert ON realtime.messages
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
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
