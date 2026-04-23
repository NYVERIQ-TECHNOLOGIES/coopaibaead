CREATE POLICY "Admins create conversations for any user"
  ON public.support_conversations FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));