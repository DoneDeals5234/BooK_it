-- ============================================================================
-- Fix RLS policies for 'notifications' storage bucket
-- ============================================================================
-- NOTE: This file is for reference. Use the Supabase Dashboard instead:
-- 1. Go to Authentication > Policies
-- 2. Select storage.objects table
-- 3. Create the policies below

-- Policy 1: Allow public read access to notifications
CREATE POLICY "public_read_notifications"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'notifications');

-- Policy 2: Allow authenticated users to upload to notifications
CREATE POLICY "authenticated_upload_notifications"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'notifications');

-- Policy 3: Allow authenticated users to delete from notifications
CREATE POLICY "authenticated_delete_notifications"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'notifications');

-- Policy 4: Allow authenticated users to update in notifications
CREATE POLICY "authenticated_update_notifications"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'notifications')
  WITH CHECK (bucket_id = 'notifications');
