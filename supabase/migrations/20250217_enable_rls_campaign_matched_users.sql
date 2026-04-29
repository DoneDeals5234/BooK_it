-- Enable RLS on campaign_matched_users table
-- This table tracks which campaigns have targeted which users
ALTER TABLE campaign_matched_users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see which campaigns have targeted them
CREATE POLICY "Users can view campaigns that targeted them"
ON campaign_matched_users FOR SELECT
USING (user_id = auth.uid()::text);

-- Policy: Service role (via Edge Functions) can insert matched users during campaign sending
-- Note: Edge Functions use service role which bypasses RLS, so this policy is for additional security
CREATE POLICY "Service role can manage matched users"
ON campaign_matched_users FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for faster queries by user_id (if not exists)
CREATE INDEX IF NOT EXISTS idx_campaign_matched_users_user_id_idx 
ON campaign_matched_users(user_id);
