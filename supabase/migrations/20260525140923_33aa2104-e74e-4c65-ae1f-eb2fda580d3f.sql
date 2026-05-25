
-- =========================================================
-- PART 1: Remove sensitive tables from Realtime publication
-- =========================================================
ALTER PUBLICATION supabase_realtime DROP TABLE public.presenca_assinaturas;
ALTER PUBLICATION supabase_realtime DROP TABLE public.cooperados_eventuais_inscricoes;
ALTER PUBLICATION supabase_realtime DROP TABLE public.cooperados_eventuais_campanhas;

-- =========================================================
-- PART 2: Harden cooperados_eventuais_inscricoes RLS
-- =========================================================

-- Drop existing user SELECT policy and recreate with explicit NULL guard
DROP POLICY IF EXISTS "Usuario ve proprias inscricoes" ON public.cooperados_eventuais_inscricoes;
CREATE POLICY "Usuario ve proprias inscricoes"
ON public.cooperados_eventuais_inscricoes
FOR SELECT
TO authenticated
USING (usuario_id IS NOT NULL AND usuario_id = auth.uid());

-- Explicit INSERT policy: user can only insert rows owned by themselves.
-- (The official flow uses SECURITY DEFINER RPC with service role, which bypasses RLS.
--  This policy is defense-in-depth to block any direct client insert attempts.)
DROP POLICY IF EXISTS "Usuario cria propria inscricao" ON public.cooperados_eventuais_inscricoes;
CREATE POLICY "Usuario cria propria inscricao"
ON public.cooperados_eventuais_inscricoes
FOR INSERT
TO authenticated
WITH CHECK (usuario_id = auth.uid());

-- =========================================================
-- PART 3: Harden presenca_assinaturas RLS
-- =========================================================
-- Public attendance flow goes exclusively through edge function `registrar-presenca`
-- (service role). Direct client writes must remain forbidden.
-- Add explicit restrictive policies so any future permissive policy can't accidentally open writes.

DROP POLICY IF EXISTS "Block direct insert by clients" ON public.presenca_assinaturas;
CREATE POLICY "Block direct insert by clients"
ON public.presenca_assinaturas
AS RESTRICTIVE
FOR INSERT
TO anon, authenticated
WITH CHECK (false);

DROP POLICY IF EXISTS "Block direct update by clients" ON public.presenca_assinaturas;
CREATE POLICY "Block direct update by clients"
ON public.presenca_assinaturas
AS RESTRICTIVE
FOR UPDATE
TO anon, authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Block direct delete by clients" ON public.presenca_assinaturas;
CREATE POLICY "Block direct delete by clients"
ON public.presenca_assinaturas
AS RESTRICTIVE
FOR DELETE
TO anon, authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- =========================================================
-- PART 4: Restrict app_settings reads to public-prefixed keys
-- =========================================================
DROP POLICY IF EXISTS "Anyone authenticated can read app_settings" ON public.app_settings;
CREATE POLICY "Authenticated read public app_settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (
  key LIKE 'public_%'
  OR key = 'cert_pickup_info'
  OR has_role(auth.uid(), 'admin'::app_role)
);
