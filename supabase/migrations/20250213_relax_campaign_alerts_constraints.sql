-- Drop the foreign key constraint on shop_id
-- This allows storing alert information independently of shop validity
-- We'll keep the campaign_id foreign key for data integrity

ALTER TABLE user_campaign_alerts
DROP CONSTRAINT IF EXISTS "user_campaign_alerts_shop_id_fkey";
