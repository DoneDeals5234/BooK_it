-- ============================================================================
-- SETUP ALL STORAGE BUCKETS AND POLICIES FOR MINIO/S3 BACKEND
-- ============================================================================
-- This script ensures all required storage buckets exist and have the correct
-- RLS (Row Level Security) policies to work properly with your Minio setup.
-- ============================================================================

-- 1. ENABLE RLS ON STORAGE TABLES
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

-- 2. HELPER FUNCTION TO CREATE BUCKETS (IF NOT EXISTS)
-- We use a simple INSERT statement instead of a function for simplicity
-- List of buckets: orders, world-chat-images, chat-images, review-images, 
-- campaign-images, profiles, apks, shops, videos

INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('orders', 'orders', true),
  ('world-chat-images', 'world-chat-images', true),
  ('chat-images', 'chat-images', true),
  ('review-images', 'review-images', true),
  ('campaign-images', 'campaign-images', true),
  ('profiles', 'profiles', true),
  ('apks', 'apks', true),
  ('shops', 'shops', true),
  ('videos', 'videos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. CLEAN UP EXISTING POLICIES (Optional but recommended to avoid duplicates)
-- This will clear existing policies for these buckets so we can apply fresh ones
DO $$ 
BEGIN
    DELETE FROM pg_policy WHERE polrelid = 'storage.objects'::regclass;
    DELETE FROM pg_policy WHERE polrelid = 'storage.buckets'::regclass;
END $$;

-- 4. CREATE GLOBAL POLICIES (APPLIES TO ALL BUCKETS)
-- These policies are simple and will make everything "just work" like your videos bucket.

-- A. PUBLIC READ ACCESS (Anyone can view files)
CREATE POLICY "Public Read Access"
  ON storage.objects FOR SELECT
  TO public
  USING (true);

-- B. AUTHENTICATED INSERT ACCESS (Logged in users can upload)
CREATE POLICY "Authenticated Insert Access"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- C. AUTHENTICATED UPDATE ACCESS (Logged in users can update)
CREATE POLICY "Authenticated Update Access"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- D. AUTHENTICATED DELETE ACCESS (Logged in users can delete)
CREATE POLICY "Authenticated Delete Access"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (true);

-- E. BUCKET METADATA ACCESS (Required for the UI/API to list buckets)
CREATE POLICY "Public Bucket Access"
  ON storage.buckets FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated Bucket Management"
  ON storage.buckets FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run these queries to check the status:
-- SELECT id, name, public FROM storage.buckets;
-- SELECT * FROM pg_policies WHERE schemaname = 'storage';
