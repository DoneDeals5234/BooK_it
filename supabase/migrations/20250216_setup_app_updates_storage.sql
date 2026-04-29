-- ============================================================================
-- Setup App Updates Storage Bucket and RLS Policies
-- ============================================================================

-- 1. Ensure the 'app-updates' storage bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at, owner)
VALUES (
  'app-updates',
  'app-updates',
  true,
  104857600, -- 100MB limit for APKs
  ARRAY['application/vnd.android.package-archive', 'application/octet-stream'],
  now(),
  now(),
  'authenticated'
)
ON CONFLICT (id) DO NOTHING;

-- 2. Setup RLS policies for the 'app-updates' storage bucket
-- Policy: Allow public read access to app updates
-- We use DO $$ blocks to safely create policies that might already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Allow public read access to app updates'
    ) THEN
        CREATE POLICY "Allow public read access to app updates"
          ON storage.objects FOR SELECT
          TO public
          USING (bucket_id = 'app-updates');
    END IF;
END $$;

-- Policy: Allow authenticated users to upload app updates
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Allow authenticated users to upload app updates'
    ) THEN
        CREATE POLICY "Allow authenticated users to upload app updates"
          ON storage.objects FOR INSERT
          TO authenticated
          WITH CHECK (bucket_id = 'app-updates');
    END IF;
END $$;

-- Policy: Allow authenticated users to update app updates
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Allow authenticated users to update app updates'
    ) THEN
        CREATE POLICY "Allow authenticated users to update app updates"
          ON storage.objects FOR UPDATE
          TO authenticated
          USING (bucket_id = 'app-updates')
          WITH CHECK (bucket_id = 'app-updates');
    END IF;
END $$;

-- Policy: Allow authenticated users to delete app updates
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Allow authenticated users to delete app updates'
    ) THEN
        CREATE POLICY "Allow authenticated users to delete app updates"
          ON storage.objects FOR DELETE
          TO authenticated
          USING (bucket_id = 'app-updates');
    END IF;
END $$;

-- 3. Ensure RLS is enabled on app_updates table and add policies if missing
-- Note: Assuming the table exists based on app usage
ALTER TABLE IF EXISTS public.app_updates ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read on app_updates
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'app_updates' 
        AND schemaname = 'public' 
        AND policyname = 'Allow public read access to app_updates'
    ) THEN
        CREATE POLICY "Allow public read access to app_updates"
          ON public.app_updates FOR SELECT
          TO public
          USING (true);
    END IF;
END $$;

-- Policy: Allow authenticated users to update app_updates
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'app_updates' 
        AND schemaname = 'public' 
        AND policyname = 'Allow authenticated users to update app_updates'
    ) THEN
        CREATE POLICY "Allow authenticated users to update app_updates"
          ON public.app_updates FOR UPDATE
          TO authenticated
          USING (true)
          WITH CHECK (true);
    END IF;
END $$;
