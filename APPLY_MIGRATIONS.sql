-- ============================================================================
-- MIGRATION 1: Add reminder fields to bookings table
-- ============================================================================
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS reminder_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reminder_minutes_before INT DEFAULT 30,
ADD COLUMN IF NOT EXISTS reminder_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS customer_confirmed BOOLEAN,
ADD COLUMN IF NOT EXISTS reminder_triggered_at TIMESTAMP WITH TIME ZONE;

-- Create index for querying pending reminders
CREATE INDEX IF NOT EXISTS idx_bookings_pending_reminders 
ON bookings(reminder_time, status) 
WHERE reminder_enabled = true AND customer_confirmed IS NULL;

-- ============================================================================
-- MIGRATION 2: Create shop_customizations table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.shop_customizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id TEXT NOT NULL UNIQUE,
  background_color TEXT DEFAULT '#ffffff',
  primary_color TEXT DEFAULT '#3b82f6',
  text_color TEXT DEFAULT '#1f2937',
  border_radius TEXT DEFAULT 'md',
  layout_style TEXT DEFAULT 'spacious',
  card_style TEXT DEFAULT 'elevated',
  show_team BOOLEAN DEFAULT true,
  show_about BOOLEAN DEFAULT true,
  show_chats BOOLEAN DEFAULT true,
  show_reviews BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for shop_id lookup
CREATE INDEX IF NOT EXISTS idx_shop_customizations_shop_id 
ON public.shop_customizations(shop_id);

-- Enable RLS on shop_customizations table
ALTER TABLE public.shop_customizations ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read customizations (public read)
DROP POLICY IF EXISTS "Anyone can view shop customizations" ON public.shop_customizations;
CREATE POLICY "Anyone can view shop customizations"
  ON public.shop_customizations
  FOR SELECT
  TO public
  USING (true);

-- Policy: Only shop owners can update their own customizations
DROP POLICY IF EXISTS "Shop owners can update their customizations" ON public.shop_customizations;
CREATE POLICY "Shop owners can update their customizations"
  ON public.shop_customizations
  FOR UPDATE
  TO authenticated
  USING (
    shop_id IN (
      SELECT id FROM shops 
      WHERE owner_email = auth.email()
    )
  )
  WITH CHECK (
    shop_id IN (
      SELECT id FROM shops 
      WHERE owner_email = auth.email()
    )
  );

-- Policy: Only shop owners can insert customizations
DROP POLICY IF EXISTS "Shop owners can create customizations" ON public.shop_customizations;
CREATE POLICY "Shop owners can create customizations"
  ON public.shop_customizations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    shop_id IN (
      SELECT id FROM shops 
      WHERE owner_email = auth.email()
    )
  );

-- Policy: Only shop owners can delete their customizations
DROP POLICY IF EXISTS "Shop owners can delete their customizations" ON public.shop_customizations;
CREATE POLICY "Shop owners can delete their customizations"
  ON public.shop_customizations
  FOR DELETE
  TO authenticated
  USING (
    shop_id IN (
      SELECT id FROM shops 
      WHERE owner_email = auth.email()
    )
  );

-- ============================================================================
-- MIGRATION 3: Fix RLS policies for notifications storage bucket
-- ============================================================================
-- Create policies for notifications storage bucket
-- Go to Supabase Dashboard > Storage > Policies
-- Create these 4 policies on storage.objects table:

-- 1. Allow public read access to notifications
-- Name: "Allow public read notifications"
-- Target: storage.objects
-- Operation: SELECT
-- Role: Public
-- USING: bucket_id = 'notifications'

-- 2. Allow authenticated users to upload to notifications
-- Name: "Allow authenticated upload notifications"
-- Target: storage.objects
-- Operation: INSERT
-- Role: Authenticated
-- WITH CHECK: bucket_id = 'notifications'

-- 3. Allow authenticated users to delete from notifications
-- Name: "Allow authenticated delete notifications"
-- Target: storage.objects
-- Operation: DELETE
-- Role: Authenticated
-- USING: bucket_id = 'notifications'

-- 4. Allow authenticated users to update in notifications
-- Name: "Allow authenticated update notifications"
-- Target: storage.objects
-- Operation: UPDATE
-- Role: Authenticated
-- USING: bucket_id = 'notifications'
-- WITH CHECK: bucket_id = 'notifications'

-- ============================================================================
-- VERIFICATION QUERIES (run after applying migrations)
-- ============================================================================
-- Check if reminder columns exist in bookings table
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'bookings' AND column_name LIKE '%reminder%';

-- Check if shop_customizations table exists
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'shop_customizations';

-- List all columns in shop_customizations
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'shop_customizations';
