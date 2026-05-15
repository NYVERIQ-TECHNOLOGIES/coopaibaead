-- Add per-course standalone access duration (NULL = lifetime)
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS standalone_access_days integer;

-- Track when standalone purchase access expires (NULL = lifetime)
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS access_expires_at timestamptz;

-- Update has_purchased_course to respect expiration
CREATE OR REPLACE FUNCTION public.has_purchased_course(_user_id uuid, _course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.purchases
    WHERE user_id = _user_id
      AND course_id = _course_id
      AND status = 'paid'
      AND (access_expires_at IS NULL OR access_expires_at > now())
  );
$function$;