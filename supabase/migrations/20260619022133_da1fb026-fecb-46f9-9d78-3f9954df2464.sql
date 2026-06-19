
-- Make the safe view bypass RLS on the base table (security definer-style view).
-- The view already enforces access via has_role / can_access_course in its WHERE,
-- and it excludes correct_option, so it is safe to expose to authenticated users
-- without granting any SELECT policy on the base table.
ALTER VIEW public.evaluation_questions_safe SET (security_invoker = false);

GRANT SELECT ON public.evaluation_questions_safe TO authenticated;
