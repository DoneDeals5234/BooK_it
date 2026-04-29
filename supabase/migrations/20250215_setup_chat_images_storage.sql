-- Migration: Setup chat images storage bucket
-- Date: 2025-02-15
-- Description: Create a storage bucket for world chat and temporary chat images

-- Note: Storage buckets are typically created through the Supabase dashboard UI
-- or via the Management API. If you need to create it via SQL, you can do it through
-- a SQL function or manually in the dashboard.

-- To create the bucket manually:
-- 1. Go to your Supabase project
-- 2. Click on "Storage" in the left sidebar
-- 3. Click "Create a new bucket"
-- 4. Name it "chat-images"
-- 5. Set it to PUBLIC
-- 6. Click "Create bucket"

-- After creating the bucket, set up RLS policies:

-- Allow public uploads to chat-images bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at, owner)
VALUES (
  'chat-images',
  'chat-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  now(),
  now(),
  'authenticated'
)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policy to allow public read access
CREATE POLICY "Allow public read access to chat images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-images');

-- Create RLS policy to allow authenticated users to upload
CREATE POLICY "Allow authenticated users to upload chat images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'chat-images'
    AND auth.role() = 'authenticated'
  );

-- Create RLS policy to allow users to delete their own images
CREATE POLICY "Allow users to delete their own chat images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'chat-images'
    AND (auth.uid()::text = owner OR auth.role() = 'service_role')
  );
