-- Create table to track campaign notifications sent to users
CREATE TABLE IF NOT EXISTS user_campaign_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  campaign_title TEXT NOT NULL,
  campaign_message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_user_campaign_alerts_user_id ON user_campaign_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_campaign_alerts_created_at ON user_campaign_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_campaign_alerts_expires_at ON user_campaign_alerts(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_campaign_alerts_user_created ON user_campaign_alerts(user_id, created_at DESC);

-- Create a policy to allow users to view their own alerts
ALTER TABLE user_campaign_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own campaign alerts"
  ON user_campaign_alerts
  FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own campaign alerts"
  ON user_campaign_alerts
  FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);
