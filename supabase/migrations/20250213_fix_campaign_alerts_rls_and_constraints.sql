-- Drop the foreign key constraint on shop_id to avoid issues with invalid shop references
ALTER TABLE user_campaign_alerts
DROP CONSTRAINT IF EXISTS "user_campaign_alerts_shop_id_fkey";

-- Make shop_id nullable since campaigns may not have a valid shop reference
ALTER TABLE user_campaign_alerts
ALTER COLUMN shop_id DROP NOT NULL;

-- Add INSERT policy to allow authenticated users to create campaign alerts
-- This is needed for campaign sending functionality
CREATE POLICY "Allow authenticated users to insert campaign alerts"
  ON user_campaign_alerts
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Add DELETE policy for users to manage their own alerts
CREATE POLICY "Allow users to delete their own alerts"
  ON user_campaign_alerts
  FOR DELETE
  USING (auth.uid()::text = user_id);
