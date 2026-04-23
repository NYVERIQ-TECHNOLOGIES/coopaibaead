-- Drop the previous view (had SECURITY DEFINER linter warning)
DROP VIEW IF EXISTS public.public_profiles;

-- Safer alternative: a SECURITY DEFINER function that returns only
-- non-sensitive profile fields. The function is restricted to authenticated
-- callers and only ever exposes name + avatar.
CREATE OR REPLACE FUNCTION public.get_public_profiles(_user_ids uuid[])
RETURNS TABLE (
  user_id uuid,
  full_name text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.full_name, p.avatar_url
  FROM public.profiles p
  WHERE p.user_id = ANY(_user_ids);
$$;

REVOKE ALL ON FUNCTION public.get_public_profiles(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO authenticated;

-- Convenience: function to fetch ALL public profiles (for selectors like
-- "issue certificate to student"). Only returns safe columns.
CREATE OR REPLACE FUNCTION public.list_public_profiles()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.full_name, p.avatar_url
  FROM public.profiles p
  ORDER BY p.full_name;
$$;

REVOKE ALL ON FUNCTION public.list_public_profiles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_profiles() TO authenticated;