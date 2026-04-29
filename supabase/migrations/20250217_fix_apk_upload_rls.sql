-- ============================================================================
-- Fix APK Upload RLS Policies & Infrastructure
-- ============================================================================

-- 1. Create the 'app-updates' storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'app-updates',
  'app-updates',
  true,
  104857600, -- 100MB
  ARRAY['application/vnd.android.package-archive', 'application/octet-stream']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 104857600,
  allowed_mime_types = ARRAY['application/vnd.android.package-archive', 'application/octet-stream'];

-- 2. Create the 'app_updates' table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.app_updates (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  current_version TEXT NOT NULL DEFAULT '1.0.0',
  latest_version TEXT NOT NULL DEFAULT '1.0.0',
  update_enabled BOOLEAN NOT NULL DEFAULT false,
  apk_url TEXT,
  update_message TEXT DEFAULT 'New version available. Please update to get the latest features.',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Ensure there is at least one record in the 'app_updates' table for the frontend to use
INSERT INTO public.app_updates (current_version, latest_version, update_enabled)
SELECT '1.0.0', '1.0.0', false
WHERE NOT EXISTS (SELECT 1 FROM public.app_updates);

-- 4. Clean up all previous policies for BOTH storage and table to ensure a fresh start
DROP POLICY IF EXISTS "Allow public read access to app updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload app updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update app updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete app updates" ON storage.objects;
DROP POLICY IF EXISTS "Permissive access to app-updates bucket" ON storage.objects;

DROP POLICY IF EXISTS "Allow public read access to app_updates" ON public.app_updates;
DROP POLICY IF EXISTS "Allow authenticated users to update app_updates" ON public.app_updates;
DROP POLICY IF EXISTS "Permissive access to app_updates table" ON public.app_updates;

-- 5. Create the "very very simple" 100% solve policies (ALLOW ALL TO PUBLIC)
-- This allows anyone (even if not logged in to Supabase) to upload and manage APKs
CREATE POLICY "Public full access to app-updates bucket"
ON storage.objects FOR ALL
TO public
USING (bucket_id = 'app-updates')
WITH CHECK (bucket_id = 'app-updates');

CREATE POLICY "Public full access to app_updates table"
ON public.app_updates FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- 6. Enable RLS on the table (with our public policy, it will work for everyone)
ALTER TABLE IF EXISTS public.app_updates ENABLE ROW LEVEL SECURITY;
