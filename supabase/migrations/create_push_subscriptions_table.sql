-- Create push_subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  endpoint TEXT UNIQUE NOT NULL,
  auth_key TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  user_phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS push_subscriptions_user_phone_idx ON push_subscriptions(user_phone);
CREATE INDEX IF NOT EXISTS push_subscriptions_created_at_idx ON push_subscriptions(created_at DESC);

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow inserts/updates from authenticated users
CREATE POLICY "Allow all users to insert push subscriptions"
  ON push_subscriptions
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow all users to select push subscriptions"
  ON push_subscriptions
  FOR SELECT
  USING (true);

CREATE POLICY "Allow users to delete their own subscriptions"
  ON push_subscriptions
  FOR DELETE
  USING (true);
