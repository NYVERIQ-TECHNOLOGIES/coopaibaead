
-- 1) Fix SECURITY DEFINER views by enforcing security_invoker (so RLS of querying user applies)
ALTER VIEW public.evaluation_questions_safe SET (security_invoker = true);
ALTER VIEW public.profiles_public SET (security_invoker = true);
ALTER VIEW public.public_profiles SET (security_invoker = true);
ALTER VIEW public.public_evaluation_questions SET (security_invoker = true);

-- 2) Remove tables from Realtime publication that the app doesn't actually subscribe to,
-- preventing any authenticated client from receiving row-change events for other users.
ALTER PUBLICATION supabase_realtime DROP TABLE public.certificates;
ALTER PUBLICATION supabase_realtime DROP TABLE public.enrollments;
ALTER PUBLICATION supabase_realtime DROP TABLE public.exam_attempts;
ALTER PUBLICATION supabase_realtime DROP TABLE public.lesson_completions;
