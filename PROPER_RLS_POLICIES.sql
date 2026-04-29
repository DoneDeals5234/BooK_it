-- ============================================================================
-- PROPER: Enable RLS with correct policies for public video access
-- ============================================================================
-- This configuration allows:
-- 1. Public users to READ videos from the storage bucket
-- 2. Authenticated users to UPLOAD videos
-- 3. Authenticated users to DELETE their own videos
-- ============================================================================

-- Step 1: Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Step 2: Create policy to allow PUBLIC READ access to all storage objects
-- This allows anyone (authenticated or not) to view/download videos
CREATE POLICY "Allow public read access to storage objects"
  ON storage.objects
  FOR SELECT
  TO public
  USING (true);

-- Step 3: Create policy for authenticated users to INSERT objects
CREATE POLICY "Allow authenticated users to upload"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Users can upload to any bucket
    true
  );

-- Step 4: Create policy for authenticated users to DELETE their own objects
CREATE POLICY "Allow authenticated users to delete their own uploads"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    -- Users can delete objects they uploaded (owner check)
    auth.uid()::text = (metadata->>'user_id')::text
  );

-- Step 5: Create policy for authenticated users to UPDATE their own objects
CREATE POLICY "Allow authenticated users to update their own uploads"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    -- Users can update objects they uploaded
    auth.uid()::text = (metadata->>'user_id')::text
  )
  WITH CHECK (true);

-- Step 6: Enable RLS on storage.buckets
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

-- Step 7: Create policy to allow PUBLIC access to bucket metadata
CREATE POLICY "Allow public read access to buckets"
  ON storage.buckets
  FOR SELECT
  TO public
  USING (true);

-- Step 8: Create policy for authenticated users to manage buckets
CREATE POLICY "Allow authenticated users to manage buckets"
  ON storage.buckets
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check RLS status
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'storage'
ORDER BY tablename;

-- Check storage policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'storage'
ORDER BY tablename, policyname;

-- Check video bucket exists
SELECT 
  id,
  name,
  public,
  created_at
FROM storage.buckets
WHERE name = 'videos';

-- Count videos in bucket
SELECT 
  COUNT(*) as video_count,
  SUM((metadata->>'size')::bigint) / 1024 / 1024 as total_size_mb
FROM storage.objects
WHERE bucket_id = 'videos';
