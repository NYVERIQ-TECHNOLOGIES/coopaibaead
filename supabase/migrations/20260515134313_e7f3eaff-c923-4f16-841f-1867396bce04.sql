ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS premium_enabled boolean NOT NULL DEFAULT true;

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
          AND (
            c.is_paid = false
            OR public.has_purchased_course(_user_id, _course_id)
            OR (c.premium_enabled AND public.has_active_subscription(_user_id))
          )
        )
      )
  )
$function$;