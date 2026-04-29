-- ============================================================================
-- FIX: Allow anon and authenticated users to manage user_devices
-- This is necessary because Firebase is used for Auth, so Supabase auth.uid() is null
-- ============================================================================

-- Step 1: Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can read their own device records" ON public.user_devices;
DROP POLICY IF EXISTS "Users can insert their own device records" ON public.user_devices;
DROP POLICY IF EXISTS "Users can update their own device records" ON public.user_devices;

-- Step 2: Create more permissive policies that don't rely on auth.uid()
-- Note: In a production app with true Supabase Auth, you'd use auth.uid()
-- But here we trust the client-side user_id (Firebase UID)

-- Policy for SELECT: Allow anyone to read device records (filtered by user_id in the app)
-- We still allow it for both anon and authenticated roles
CREATE POLICY "Allow anyone to read device records"
  ON public.user_devices
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Policy for INSERT: Allow anyone to insert device records
CREATE POLICY "Allow anyone to insert device records"
  ON public.user_devices
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Policy for UPDATE: Allow anyone to update device records
CREATE POLICY "Allow anyone to update device records"
  ON public.user_devices
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Step 3: Verify RLS is enabled
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

-- Step 4: Add comment to explain why this is permissive
COMMENT ON TABLE public.user_devices IS 'Stores device info for push notifications. Permissive RLS because Firebase is the primary Auth provider.';
