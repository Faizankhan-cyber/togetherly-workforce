-- Persist employee profile pictures in Supabase Storage.
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS avatar_url text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('profile-avatars', 'profile-avatars', true, 5242880, ARRAY['image/png','image/jpeg','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880, allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp','image/gif'];

DROP POLICY IF EXISTS "Users can upload their own profile avatars" ON storage.objects;
CREATE POLICY "Users can upload their own profile avatars" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'profile-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can update their own profile avatars" ON storage.objects;
CREATE POLICY "Users can update their own profile avatars" ON storage.objects
FOR UPDATE TO authenticated USING (bucket_id = 'profile-avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'profile-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can read profile avatars" ON storage.objects;
CREATE POLICY "Users can read profile avatars" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'profile-avatars');

NOTIFY pgrst, 'reload schema';
