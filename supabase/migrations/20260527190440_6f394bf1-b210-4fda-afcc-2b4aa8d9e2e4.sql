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
        OR public.tem_acesso_curso_eventual(_user_id, _course_id)
        OR (
          COALESCE(c.eventual, false) = false
          AND (NOT c.cooperado_only OR public.has_role(_user_id, 'cooperado'))
          AND (
            c.is_paid = false
            OR public.has_purchased_course(_user_id, _course_id)
            OR (c.premium_enabled AND public.has_active_subscription(_user_id))
          )
        )
      )
  )
$function$;