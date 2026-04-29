-- ============================================================================
-- COMPLETE FIX FOR PROFILE SAVING AND IMAGE UPLOAD
-- ============================================================================
-- Run this entire script in your Supabase SQL Editor
-- This fixes both the user_profiles table and storage bucket RLS policies
-- ============================================================================

-- Step 1: Drop existing policies that might be causing issues
DROP POLICY IF EXISTS "Users can read their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;

DROP POLICY IF EXISTS "Allow public read access to profile images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload profile images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete their own profile images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update their own profile images" ON storage.objects;

DROP POLICY IF EXISTS "Allow public read access to profiles bucket" ON storage.buckets;
DROP POLICY IF EXISTS "Allow authenticated users to manage profiles bucket" ON storage.buckets;

-- Step 2: Create user_profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  image_url TEXT,
  address TEXT,
  village TEXT,
  district TEXT,
  state TEXT,
  country TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);

-- Step 3: Disable RLS temporarily to ensure table is accessible
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;

-- Step 4: Enable RLS on user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies for user_profiles table
-- Policy for SELECT: Users can read their own profile
CREATE POLICY "Users can read their own profile"
  ON public.user_profiles
  FOR SELECT
  USING (user_id = auth.uid()::TEXT);

-- Policy for INSERT: Authenticated users can insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid()::TEXT);

-- Policy for UPDATE: Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid()::TEXT)
  WITH CHECK (user_id = auth.uid()::TEXT);

-- Step 6: Disable then re-enable RLS on storage.objects to reset policies
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Step 7: Create RLS policies for storage.objects (profile images)
-- Policy for SELECT: Public can read profile images
CREATE POLICY "Allow public read access to profile images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'profiles');

-- Policy for INSERT: Authenticated users can upload profile images
CREATE POLICY "Allow authenticated users to upload profile images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'profiles');

-- Policy for DELETE: Users can delete their own profile images
CREATE POLICY "Allow authenticated users to delete their own profile images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profiles' AND
    auth.uid()::text = (metadata->>'user_id')::text
  );

-- Policy for UPDATE: Users can update their own profile images
CREATE POLICY "Allow authenticated users to update their own profile images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'profiles' AND
    auth.uid()::text = (metadata->>'user_id')::text
  )
  WITH CHECK (bucket_id = 'profiles');

-- Step 8: Disable then re-enable RLS on storage.buckets
ALTER TABLE storage.buckets DISABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

-- Step 9: Create RLS policies for storage.buckets
-- Policy for SELECT: Public can access bucket metadata
CREATE POLICY "Allow public read access to profiles bucket"
  ON storage.buckets
  FOR SELECT
  TO public
  USING (name = 'profiles');

-- Policy for ALL: Authenticated users can manage profiles bucket
CREATE POLICY "Allow authenticated users to manage profiles bucket"
  ON storage.buckets
  FOR ALL
  TO authenticated
  USING (name = 'profiles')
  WITH CHECK (name = 'profiles');

-- Step 10: Create timestamp update trigger for user_profiles
CREATE OR REPLACE FUNCTION update_user_profiles_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_profiles_update_timestamp ON public.user_profiles;

CREATE TRIGGER user_profiles_update_timestamp
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION update_user_profiles_timestamp();

-- ============================================================================
-- VERIFICATION QUERIES (Run these to verify everything is set up correctly)
-- ============================================================================

-- Check if user_profiles table exists and RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'user_profiles';

-- Check user_profiles policies
SELECT 
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'user_profiles'
ORDER BY policyname;

-- Check storage.objects policies for profiles bucket
SELECT 
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;

-- Check storage.buckets policies
SELECT 
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'storage' AND tablename = 'buckets'
ORDER BY policyname;
