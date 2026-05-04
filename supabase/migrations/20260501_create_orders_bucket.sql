-- Migration: Setup orders storage bucket
-- Date: 2026-05-01
-- Description: Create a storage bucket for printing documents and order attachments

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'orders',
  'orders',
  true,
  52428800,
  NULL
)
ON CONFLICT (id) DO UPDATE SET 
  public = true, 
  file_size_limit = 52428800, 
  allowed_mime_types = NULL;

-- Wide open storage policies
DROP POLICY IF EXISTS "Allow public read access to orders bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload orders documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own orders documents" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Insert Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Update Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete Access" ON storage.objects;

CREATE POLICY "Public Read Access" ON storage.objects FOR SELECT USING (bucket_id = 'orders');
CREATE POLICY "Public Insert Access" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'orders');
CREATE POLICY "Public Update Access" ON storage.objects FOR UPDATE USING (bucket_id = 'orders');
CREATE POLICY "Public Delete Access" ON storage.objects FOR DELETE USING (bucket_id = 'orders');
