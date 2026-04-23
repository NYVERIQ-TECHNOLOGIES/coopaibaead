-- Trigger to enforce sender_role based on caller's actual role
CREATE OR REPLACE FUNCTION public.enforce_support_sender_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Force sender_id to the authenticated user
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  NEW.sender_id := auth.uid();

  -- Override sender_role with caller's actual role
  IF public.has_role(auth.uid(), 'admin') THEN
    NEW.sender_role := 'admin';
  ELSE
    NEW.sender_role := 'user';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_support_sender_role_trigger ON public.support_messages;
CREATE TRIGGER enforce_support_sender_role_trigger
  BEFORE INSERT ON public.support_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_support_sender_role();