
-- 1. Fix exam answer leak
DROP POLICY IF EXISTS "Authenticated can view question metadata" ON public.evaluation_questions;
GRANT SELECT ON public.evaluation_questions_safe TO authenticated;

-- 2. Allow users to delete their own avatar
CREATE POLICY "Users can delete their own avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
