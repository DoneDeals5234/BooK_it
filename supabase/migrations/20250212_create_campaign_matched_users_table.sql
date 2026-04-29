-- Create campaign_matched_users table for storing pre-matched users
-- This table stores the list of users that match the campaign's target criteria
-- Pre-matching users when campaign is created ensures 100% accurate targeting
CREATE TABLE IF NOT EXISTS campaign_matched_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  matched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for querying matched users by campaign
CREATE INDEX IF NOT EXISTS idx_campaign_matched_users_campaign_id 
ON campaign_matched_users(campaign_id);

-- Create index for querying matched users by user
CREATE INDEX IF NOT EXISTS idx_campaign_matched_users_user_id 
ON campaign_matched_users(user_id);

-- Create composite index for fast counting
CREATE INDEX IF NOT EXISTS idx_campaign_matched_users_campaign_count 
ON campaign_matched_users(campaign_id, user_id);
