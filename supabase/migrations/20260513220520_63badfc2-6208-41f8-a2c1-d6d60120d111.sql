-- Restringir mutações em subscription_plans ao admin master
DROP POLICY IF EXISTS "Admins manage plans" ON public.subscription_plans;

CREATE POLICY "Master admin can insert plans"
ON public.subscription_plans
FOR INSERT
TO authenticated
WITH CHECK (public.is_master_admin(auth.uid()));

CREATE POLICY "Master admin can update plans"
ON public.subscription_plans
FOR UPDATE
TO authenticated
USING (public.is_master_admin(auth.uid()))
WITH CHECK (public.is_master_admin(auth.uid()));

CREATE POLICY "Master admin can delete plans"
ON public.subscription_plans
FOR DELETE
TO authenticated
USING (public.is_master_admin(auth.uid()));

CREATE POLICY "Admins view plans"
ON public.subscription_plans
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));