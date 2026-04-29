-- Create campaign_logs table for tracking notification delivery
CREATE TABLE IF NOT EXISTS campaign_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  onesignal_notification_id TEXT,
  status TEXT DEFAULT 'sent', -- sent, delivered, opened, failed, bounced
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for querying logs by campaign
CREATE INDEX IF NOT EXISTS idx_campaign_logs_campaign_id 
ON campaign_logs(campaign_id);

-- Create index for querying logs by user
CREATE INDEX IF NOT EXISTS idx_campaign_logs_user_id 
ON campaign_logs(user_id);

-- Create index for status queries
CREATE INDEX IF NOT EXISTS idx_campaign_logs_status 
ON campaign_logs(status);

-- Create composite index for analytics queries
CREATE INDEX IF NOT EXISTS idx_campaign_logs_analytics 
ON campaign_logs(campaign_id, status, sent_at);
