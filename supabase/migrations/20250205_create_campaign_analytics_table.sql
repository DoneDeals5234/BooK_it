-- Create campaign_analytics table for aggregated metrics
CREATE TABLE IF NOT EXISTS campaign_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL UNIQUE REFERENCES campaigns(id) ON DELETE CASCADE,
  total_recipients INT DEFAULT 0,
  total_sent INT DEFAULT 0,
  total_delivered INT DEFAULT 0,
  total_opened INT DEFAULT 0,
  total_failed INT DEFAULT 0,
  delivery_rate NUMERIC(5, 2) DEFAULT 0, -- percentage
  open_rate NUMERIC(5, 2) DEFAULT 0, -- percentage
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for campaign analytics lookup
CREATE INDEX IF NOT EXISTS idx_campaign_analytics_campaign_id 
ON campaign_analytics(campaign_id);
