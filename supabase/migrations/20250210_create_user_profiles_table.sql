-- Create user_profiles table to store user profile information
-- This table stores user profile data including name, phone, location, and image URL

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  image_url TEXT,
  address TEXT,
  village TEXT,
  district TEXT,
  state TEXT,
  country TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);

-- Enable Row Level Security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for RLS
-- Allow users to read their own profile
CREATE POLICY "Users can read their own profile"
  ON public.user_profiles
  FOR SELECT
  USING (user_id = auth.uid()::TEXT);

-- Allow authenticated users to insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid()::TEXT);

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid()::TEXT)
  WITH CHECK (user_id = auth.uid()::TEXT);

-- Create a trigger to automatically update the updated_at column
CREATE OR REPLACE FUNCTION update_user_profiles_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_profiles_update_timestamp ON public.user_profiles;

CREATE TRIGGER user_profiles_update_timestamp
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION update_user_profiles_timestamp();
