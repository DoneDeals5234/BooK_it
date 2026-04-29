-- ============================================================================
-- TEMPORARY: Disable RLS on storage.objects to test video playback
-- ============================================================================
-- WARNING: This disables security policies. Use ONLY for testing.
-- Re-enable RLS after confirming the issue.
-- ============================================================================

-- Step 1: Disable RLS on storage.objects table
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop all existing policies on storage.objects (if any)
DROP POLICY IF EXISTS "Enable read access for all users" ON storage.objects;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON storage.objects;

-- Step 3: Disable RLS on storage.buckets
ALTER TABLE storage.buckets DISABLE ROW LEVEL SECURITY;

-- Step 4: Drop policies on storage.buckets (if any)
DROP POLICY IF EXISTS "Enable public access for public buckets" ON storage.buckets;
DROP POLICY IF EXISTS "Enable read access for public buckets" ON storage.buckets;

-- ============================================================================
-- VERIFICATION: Check RLS Status
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'storage'
ORDER BY tablename;

-- ============================================================================
-- After confirming video works, RE-ENABLE RLS with proper policies:
-- ============================================================================

/*
-- RE-ENABLE RLS (Run these commands after testing)

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access to all storage objects
CREATE POLICY "Allow public read" ON storage.objects
  FOR SELECT
  TO public
  USING (true);

-- Create policy to allow authenticated users to insert objects
CREATE POLICY "Allow authenticated insert" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create policy to allow authenticated users to delete objects
CREATE POLICY "Allow authenticated delete" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (true);

-- Enable RLS on storage.buckets
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access to buckets
CREATE POLICY "Allow public read buckets" ON storage.buckets
  FOR SELECT
  TO public
  USING (true);
*/
