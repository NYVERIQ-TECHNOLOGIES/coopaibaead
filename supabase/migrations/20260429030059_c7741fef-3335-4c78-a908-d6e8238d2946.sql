-- Function to detect the master admin (the oldest admin in user_roles table)
CREATE OR REPLACE FUNCTION public.is_master_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.role = 'admin'
      AND ur.user_id = _user_id
      AND ur.id = (
        SELECT id FROM public.user_roles
        WHERE role = 'admin'
        ORDER BY id ASC
        LIMIT 1
      )
  );
$$;

-- Allow moderators to view profiles
CREATE POLICY "Moderators can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'moderador'));

-- Allow moderators to view roles
CREATE POLICY "Moderators can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'moderador'));

-- Allow moderators to view support conversations and messages
CREATE POLICY "Moderators view all conversations"
ON public.support_conversations FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'moderador'));

CREATE POLICY "Moderators update conversations"
ON public.support_conversations FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'moderador'));

CREATE POLICY "Moderators view all messages"
ON public.support_messages FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'moderador'));

CREATE POLICY "Moderators send messages anywhere"
ON public.support_messages FOR INSERT
TO authenticated
WITH CHECK ((sender_id = auth.uid()) AND public.has_role(auth.uid(), 'moderador'));

-- Update enforce_support_sender_role trigger to set 'admin' role for moderator's messages too,
-- so the existing handle_new_support_message trigger logic continues to work.
CREATE OR REPLACE FUNCTION public.enforce_support_sender_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  NEW.sender_id := auth.uid();

  IF public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderador') THEN
    NEW.sender_role := 'admin';
  ELSE
    NEW.sender_role := 'user';
  END IF;

  RETURN NEW;
END;
$function$;