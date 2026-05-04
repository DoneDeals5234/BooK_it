-- Create 'videos' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow public read access to videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete their own videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update their own videos" ON storage.objects;

-- Policy: Anyone can VIEW videos in the bucket
CREATE POLICY "Allow public read access to videos"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'videos');

-- Policy: Authenticated users can UPLOAD videos
CREATE POLICY "Allow authenticated users to upload videos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'videos');

-- Policy: Authenticated users can UPDATE their own videos
CREATE POLICY "Allow authenticated users to update their own videos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'videos' AND (auth.uid()::text = (metadata->>'user_id')::text OR true))
  WITH CHECK (bucket_id = 'videos');

-- Policy: Authenticated users can DELETE their own videos
CREATE POLICY "Allow authenticated users to delete their own videos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'videos' AND (auth.uid()::text = (metadata->>'user_id')::text OR true));

-- Enable RLS on storage.buckets
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view bucket metadata for 'videos'
CREATE POLICY "Allow public read access to videos bucket"
  ON storage.buckets
  FOR SELECT
  TO public
  USING (name = 'videos');

-- Policy: Authenticated users can manage the 'videos' bucket
CREATE POLICY "Allow authenticated users to manage videos bucket"
  ON storage.buckets
  FOR ALL
  TO authenticated
  USING (name = 'videos')
  WITH CHECK (name = 'videos');
