-- ============================================================================
-- QUICK FIX: Disable RLS on storage buckets to allow profile image uploads
-- Run this in Supabase SQL Editor to immediately fix the upload issue
-- ============================================================================

-- Step 1: Disable RLS on storage.objects (this allows all authenticated users to upload)
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- Step 2: Disable RLS on storage.buckets
ALTER TABLE storage.buckets DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Verification - check RLS status
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'storage'
ORDER BY tablename;
