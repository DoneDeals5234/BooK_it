-- Create campaign_targets table for geographic targeting
CREATE TABLE IF NOT EXISTS campaign_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  country TEXT NOT NULL,
  state TEXT,
  district TEXT,
  village TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for querying targets by campaign
CREATE INDEX IF NOT EXISTS idx_campaign_targets_campaign_id 
ON campaign_targets(campaign_id);

-- Create composite index for geographic queries
CREATE INDEX IF NOT EXISTS idx_campaign_targets_location 
ON campaign_targets(country, state, district, village);
