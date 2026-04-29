-- Create campaigns table for barber shop owner campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft', -- draft, scheduled, sent, completed, paused
  scheduled_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for querying campaigns by shop
CREATE INDEX IF NOT EXISTS idx_campaigns_shop_id 
ON campaigns(shop_id);

-- Create index for scheduled campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled 
ON campaigns(scheduled_at) WHERE status = 'scheduled';

-- Create index for finding sent campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_status 
ON campaigns(status);
