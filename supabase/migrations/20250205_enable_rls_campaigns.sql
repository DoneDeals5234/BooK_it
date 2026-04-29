-- Enable RLS on campaigns table
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

-- Policy: Shop owners can create their own campaigns
CREATE POLICY "Users can create campaigns for their shops"
ON campaigns FOR INSERT
WITH CHECK (shop_id = auth.uid()::text);

-- Policy: Shop owners can read their own campaigns
CREATE POLICY "Users can read their own campaigns"
ON campaigns FOR SELECT
USING (shop_id = auth.uid()::text);

-- Policy: Shop owners can update their own campaigns
CREATE POLICY "Users can update their own campaigns"
ON campaigns FOR UPDATE
USING (shop_id = auth.uid()::text)
WITH CHECK (shop_id = auth.uid()::text);

-- Policy: Shop owners can delete their own campaigns
CREATE POLICY "Users can delete their own campaigns"
ON campaigns FOR DELETE
USING (shop_id = auth.uid()::text);

-- Enable RLS on campaign_targets table
ALTER TABLE campaign_targets ENABLE ROW LEVEL SECURITY;

-- Policy: Campaign targets are accessible to campaign owner
CREATE POLICY "Users can manage campaign targets"
ON campaign_targets FOR ALL
USING (
  campaign_id IN (
    SELECT id FROM campaigns WHERE shop_id = auth.uid()::text
  )
);

-- Enable RLS on campaign_logs table
ALTER TABLE campaign_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Campaign logs are accessible to campaign owner
CREATE POLICY "Users can view their campaign logs"
ON campaign_logs FOR SELECT
USING (
  campaign_id IN (
    SELECT id FROM campaigns WHERE shop_id = auth.uid()::text
  )
);

-- Enable RLS on campaign_analytics table
ALTER TABLE campaign_analytics ENABLE ROW LEVEL SECURITY;

-- Policy: Campaign analytics are accessible to campaign owner
CREATE POLICY "Users can view their campaign analytics"
ON campaign_analytics FOR SELECT
USING (
  campaign_id IN (
    SELECT id FROM campaigns WHERE shop_id = auth.uid()::text
  )
);

-- Note: Edge Functions use service role, which bypasses RLS
-- The send-campaign, schedule-campaign, and track-campaign-events functions
-- will have full access to all campaign tables via the service role key
