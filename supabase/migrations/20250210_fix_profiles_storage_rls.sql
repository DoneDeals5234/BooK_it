-- ============================================================================
-- Fix RLS policies for 'profiles' storage bucket
-- ============================================================================
-- This enables users to upload, view, and manage their profile images

-- Step 1: Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop existing conflicting policies (if any)
DROP POLICY IF EXISTS "Allow public read access to profiles" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload profiles" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete their own profiles" ON storage.objects;

-- Step 3: Create policy to allow PUBLIC READ access to profile images
CREATE POLICY "Allow public read access to profile images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'profiles');

-- Step 4: Create policy for authenticated users to UPLOAD profile images
-- Users can upload to the profiles bucket (the user_id check happens in the application logic)
CREATE POLICY "Allow authenticated users to upload profile images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'profiles');

-- Step 5: Create policy for authenticated users to DELETE their own profile images
-- Users can delete objects they uploaded (based on metadata)
CREATE POLICY "Allow authenticated users to delete their own profile images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profiles' AND
    auth.uid()::text = (metadata->>'user_id')::text
  );

-- Step 6: Create policy for authenticated users to UPDATE their own profile images
CREATE POLICY "Allow authenticated users to update their own profile images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'profiles' AND
    auth.uid()::text = (metadata->>'user_id')::text
  )
  WITH CHECK (bucket_id = 'profiles');

-- Step 7: Enable RLS on storage.buckets if not already enabled
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

-- Step 8: Drop existing conflicting policies (if any)
DROP POLICY IF EXISTS "Allow public read access to profiles bucket" ON storage.buckets;
DROP POLICY IF EXISTS "Allow authenticated users to manage profiles bucket" ON storage.buckets;

-- Step 9: Create policy to allow PUBLIC access to bucket metadata
CREATE POLICY "Allow public read access to profiles bucket"
  ON storage.buckets
  FOR SELECT
  TO public
  USING (name = 'profiles');

-- Step 10: Create policy for authenticated users to manage profiles bucket
CREATE POLICY "Allow authenticated users to manage profiles bucket"
  ON storage.buckets
  FOR ALL
  TO authenticated
  USING (name = 'profiles')
  WITH CHECK (name = 'profiles');
