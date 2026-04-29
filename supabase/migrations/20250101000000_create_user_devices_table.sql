-- Create user_devices table to store user login data
-- This table stores: email, user_id (Firebase UID), and player_id (OneSignal ID)
-- Used for sending targeted push notifications to specific devices/users

CREATE TABLE IF NOT EXISTS public.user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  email TEXT,
  password TEXT,
  player_id TEXT,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON public.user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_player_id ON public.user_devices(player_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_email ON public.user_devices(email);

-- Create composite index for common queries (find by user_id and player_id)
CREATE INDEX IF NOT EXISTS idx_user_devices_user_player ON public.user_devices(user_id, player_id);

-- Enable Row Level Security
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

-- Create policies for RLS
-- Allow users to read their own data
CREATE POLICY "Users can read their own device records"
  ON public.user_devices
  FOR SELECT
  USING (user_id = auth.uid()::TEXT);

-- Allow authenticated users to insert their own device records
CREATE POLICY "Users can insert their own device records"
  ON public.user_devices
  FOR INSERT
  WITH CHECK (user_id = auth.uid()::TEXT);

-- Allow users to update their own device records
CREATE POLICY "Users can update their own device records"
  ON public.user_devices
  FOR UPDATE
  USING (user_id = auth.uid()::TEXT);

-- Create a trigger to automatically update the updated_at column
CREATE OR REPLACE FUNCTION update_user_devices_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_devices_update_timestamp
BEFORE UPDATE ON public.user_devices
FOR EACH ROW
EXECUTE FUNCTION update_user_devices_timestamp();
