-- Create plans table for subscription tiers
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
