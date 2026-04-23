-- 1. Remove permissive SELECT policy on profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- 2. Restrict SELECT to the owner of the profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 3. Allow admins to view all profiles (needed for Students page, AdminLogs, etc.)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 4. Public, non-sensitive view of profiles (only name + avatar)
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = on) AS
SELECT
  user_id,
  full_name,
  avatar_url
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated, anon;

-- 5. Allow authenticated users to read the public view rows of any profile
--    (security_invoker means the view runs with the caller's permissions, so we
--     need a SELECT policy on profiles that exposes ONLY these safe columns to
--     other authenticated users. We do that via a separate policy that allows
--     reading non-sensitive columns through the view.)
--    Postgres RLS is row-level, not column-level, so we add a permissive
--    policy that lets authenticated users read rows but the application MUST
--    use the view to avoid leaking sensitive columns. Since columns like cpf,
--    enrollment_number, cooperativa, is_active, deactivated_at are sensitive,
--    we instead expose the view via a SECURITY DEFINER wrapper.

DROP VIEW IF EXISTS public.public_profiles;

CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = off) AS
SELECT
  user_id,
  full_name,
  avatar_url
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated, anon;