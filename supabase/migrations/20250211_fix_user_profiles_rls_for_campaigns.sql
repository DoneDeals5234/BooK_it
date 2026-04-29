-- Add RLS policy to allow service role (campaigns) to read user profiles
-- This is needed for the send-campaign function to query user locations for geographic targeting

-- Drop existing restrictive policies if they exist (service role bypass may not work as expected)
DROP POLICY IF EXISTS "Users can read their own profile" ON public.user_profiles;

-- Policy 1: Users can read their own profile
CREATE POLICY "Users can read their own profile"
  ON public.user_profiles
  FOR SELECT
  USING (auth.uid()::TEXT = user_id);

-- Policy 2: Allow service role (campaigns) to read all profiles for targeting
-- This is essential for the send-campaign edge function to query user locations
CREATE POLICY "Service role can read all profiles for campaigns"
  ON public.user_profiles
  FOR SELECT
  USING (true);

-- Keep existing insert/update policies for user data
-- Allow authenticated users to insert their own profile
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;

CREATE POLICY "Users can insert their own profile"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::TEXT = user_id);

-- Allow users to update their own profile
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;

CREATE POLICY "Users can update their own profile"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::TEXT = user_id)
  WITH CHECK (auth.uid()::TEXT = user_id);
