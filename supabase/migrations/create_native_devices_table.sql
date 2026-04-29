-- Create native_devices table for storing native app device information
CREATE TABLE IF NOT EXISTS native_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  email TEXT,
  player_id TEXT NOT NULL,
  device_type TEXT DEFAULT 'native',
  last_active TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_native_devices_user_id ON native_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_native_devices_player_id ON native_devices(player_id);
CREATE INDEX IF NOT EXISTS idx_native_devices_user_player ON native_devices(user_id, player_id);

-- Enable RLS (required)
ALTER TABLE native_devices ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to view their own native devices
CREATE POLICY "Users can view their own native devices"
  ON native_devices
  FOR SELECT
  USING (auth.uid()::TEXT = user_id OR auth.role() = 'service_role');

-- Policy: Allow service role (Edge Functions) to manage native devices
CREATE POLICY "Service role can manage native devices"
  ON native_devices
  FOR INSERT, UPDATE, DELETE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Policy: Allow authenticated users to insert their own devices (for client-side operations)
CREATE POLICY "Users can insert their own native devices"
  ON native_devices
  FOR INSERT
  WITH CHECK (auth.uid()::TEXT = user_id);

-- Policy: Allow authenticated users to update their own devices (for client-side operations)
CREATE POLICY "Users can update their own native devices"
  ON native_devices
  FOR UPDATE
  USING (auth.uid()::TEXT = user_id)
  WITH CHECK (auth.uid()::TEXT = user_id);
