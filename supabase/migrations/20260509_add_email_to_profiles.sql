-- Add email, instagram and facebook fields to user_profiles table
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS google_map_link TEXT,
ADD COLUMN IF NOT EXISTS instagram_id TEXT,
ADD COLUMN IF NOT EXISTS facebook_id TEXT,
ADD COLUMN IF NOT EXISTS instagram_url TEXT,
ADD COLUMN IF NOT EXISTS facebook_url TEXT;

-- Update RLS policies to allow public reading of profiles for search
-- Drop existing select policy first
DROP POLICY IF EXISTS "Users can read their own profile" ON public.user_profiles;

-- Create new policy that allows everyone to read profiles (needed for search)
CREATE POLICY "Public profiles are viewable by everyone" 
ON public.user_profiles FOR SELECT 
USING (true);
