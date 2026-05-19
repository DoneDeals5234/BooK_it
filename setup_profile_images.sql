-- 1. Create the 'profiles' storage bucket for storing profile images
INSERT INTO storage.buckets (id, name, public)
SELECT 'profiles', 'profiles', true
WHERE NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'profiles'
);

-- 2. Drop existing policies if they exist (to avoid errors on re-run)
DROP POLICY IF EXISTS "Public Profile Images Access" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own profile image" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own profile image" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own profile image" ON storage.objects;

-- 3. Create Storage Policies for 'profiles' bucket
-- Allow anyone to view profile images
CREATE POLICY "Public Profile Images Access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'profiles');

-- Allow authenticated users to upload images
CREATE POLICY "Users can upload their own profile image" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'profiles' AND auth.role() = 'authenticated');

-- Allow authenticated users to update images
CREATE POLICY "Users can update their own profile image" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'profiles' AND auth.role() = 'authenticated') 
WITH CHECK (bucket_id = 'profiles' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete images
CREATE POLICY "Users can delete their own profile image" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'profiles' AND auth.role() = 'authenticated');

-- 4. Ensure the user_profiles table has the image_url column
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'image_url') THEN
    ALTER TABLE user_profiles ADD COLUMN image_url TEXT;
  END IF;
END $$;
