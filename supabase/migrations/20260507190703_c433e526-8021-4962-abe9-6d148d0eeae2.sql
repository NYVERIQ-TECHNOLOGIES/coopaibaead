
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS stripe_price_id text;

ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS price_id text,
  ADD COLUMN IF NOT EXISTS product_id text,
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'sandbox',
  ADD COLUMN IF NOT EXISTS current_period_start timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS user_subscriptions_stripe_sub_unique
  ON public.user_subscriptions(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_subscriptions_user_env_idx
  ON public.user_subscriptions(user_id, environment);

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'sandbox',
  ADD COLUMN IF NOT EXISTS stripe_session_id text;

CREATE UNIQUE INDEX IF NOT EXISTS purchases_stripe_session_unique
  ON public.purchases(stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;
