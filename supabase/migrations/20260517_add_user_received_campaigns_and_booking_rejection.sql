-- Add rejection reason to booking_requests
ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Add shop_name to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS shop_name TEXT;

-- Create user_received_campaigns table
CREATE TABLE IF NOT EXISTS user_received_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_received_campaigns_user_id ON user_received_campaigns(user_id);

-- Enable RLS
ALTER TABLE user_received_campaigns ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own received campaigns
CREATE POLICY "Users can read their own received campaigns"
  ON user_received_campaigns
  FOR SELECT
  USING (user_id = auth.uid()::TEXT);

-- Policy: Users can insert their own received campaigns (for testing/simulation or client-side storage)
CREATE POLICY "Users can insert their own received campaigns"
  ON user_received_campaigns
  FOR INSERT
  WITH CHECK (user_id = auth.uid()::TEXT);
