
-- Add content_url to course_lessons so lessons can link to playable/readable content
ALTER TABLE public.course_lessons ADD COLUMN IF NOT EXISTS content_url text;

-- Add file_url to course_books so books can link to downloadable content
ALTER TABLE public.course_books ADD COLUMN IF NOT EXISTS file_url text;

-- Create avatars storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own avatar
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to update their own avatar
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow public read access to avatars
CREATE POLICY "Public avatar read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');
