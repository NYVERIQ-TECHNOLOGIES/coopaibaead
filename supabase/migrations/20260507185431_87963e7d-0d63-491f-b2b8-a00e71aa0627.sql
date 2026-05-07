
-- ============= ETAPA 2: Monetização =============

-- 1. Adicionar campos de preço em courses
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS is_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS price numeric(10,2),
  ADD COLUMN IF NOT EXISTS promotional_price numeric(10,2);

-- 2. Tabela de planos de assinatura
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  interval text NOT NULL DEFAULT 'month', -- month | year
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans"
  ON public.subscription_plans FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins manage plans"
  ON public.subscription_plans FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Tabela de assinaturas dos usuários
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending', -- pending | active | past_due | canceled | expired
  started_at timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  provider text,         -- stripe | manual | etc
  provider_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON public.user_subscriptions(status);

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own subscriptions"
  ON public.user_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all subscriptions"
  ON public.user_subscriptions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage subscriptions"
  ON public.user_subscriptions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Tabela de compras avulsas (cursos pagos)
CREATE TABLE IF NOT EXISTS public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_id uuid NOT NULL,
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  status text NOT NULL DEFAULT 'pending', -- pending | paid | refunded | canceled
  provider text,
  provider_payment_id text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchases_user ON public.purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_course ON public.purchases(course_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_user_course_paid
  ON public.purchases(user_id, course_id) WHERE status = 'paid';

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own purchases"
  ON public.purchases FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all purchases"
  ON public.purchases FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage purchases"
  ON public.purchases FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_purchases_updated_at
  BEFORE UPDATE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Função: assinatura ativa
CREATE OR REPLACE FUNCTION public.has_active_subscription(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_subscriptions
    WHERE user_id = _user_id
      AND status = 'active'
      AND (current_period_end IS NULL OR current_period_end > now())
  );
$$;

-- 6. Função: comprou o curso
CREATE OR REPLACE FUNCTION public.has_purchased_course(_user_id uuid, _course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.purchases
    WHERE user_id = _user_id AND course_id = _course_id AND status = 'paid'
  );
$$;

-- 7. Atualizar can_access_course para considerar pagamento/assinatura
CREATE OR REPLACE FUNCTION public.can_access_course(_user_id uuid, _course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
          AND (
            -- gratuito, OU comprou, OU possui assinatura ativa
            c.is_paid = false
            OR public.has_purchased_course(_user_id, _course_id)
            OR public.has_active_subscription(_user_id)
          )
        )
      )
  )
$$;
