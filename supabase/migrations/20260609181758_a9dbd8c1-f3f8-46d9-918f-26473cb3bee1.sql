-- Add a second FK from certificates.user_id to profiles.user_id so PostgREST can resolve the embed `profiles!certificates_user_id_fkey` used by the Certificates page.
ALTER TABLE public.certificates
  ADD CONSTRAINT certificates_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

NOTIFY pgrst, 'reload schema';