-- Garantir RLS ativo
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;

-- Remover política caso já exista (idempotente)
DROP POLICY IF EXISTS "Users can insert their own exam attempts" ON public.exam_attempts;

-- Permitir INSERT apenas para o próprio usuário autenticado
CREATE POLICY "Users can insert their own exam attempts"
ON public.exam_attempts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);