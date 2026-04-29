-- Add INSERT policy to allow authenticated users to create campaign alerts
-- This is needed for campaign sending functionality
CREATE POLICY "Allow authenticated users to create campaign alerts"
  ON user_campaign_alerts
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Add DELETE policy for admins/system to manage alerts
CREATE POLICY "Allow deletion of campaign alerts"
  ON user_campaign_alerts
  FOR DELETE
  USING (auth.role() = 'authenticated');
