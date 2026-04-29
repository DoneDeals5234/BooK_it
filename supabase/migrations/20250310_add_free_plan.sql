-- Create plans table if it doesn't exist
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  features JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on plan name for faster lookups
CREATE INDEX IF NOT EXISTS idx_plans_name ON plans(name);

-- Enable RLS
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access (plans should be visible to everyone during signup)
CREATE POLICY "Plans are publicly readable"
  ON plans FOR SELECT
  USING (true);

-- Insert FREE plan into plans table
INSERT INTO plans (name, description, features) VALUES
  (
    'Free',
    'Free plan for shop registration',
    '["Register Your Shop", "Basic Settings", "Shop Location", "Contact Information", "Services Management", "Staff Members", "Time Slot Configuration", "Booking System"]'::jsonb
  )
ON CONFLICT (name) DO NOTHING;

-- Verify FREE plan was created
SELECT id, name, description FROM plans WHERE name = 'Free';
