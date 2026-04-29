-- Add plan_id column to shops table to link shops to subscription plans
ALTER TABLE shops
ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES plans(id) ON DELETE SET NULL;

-- Create index on plan_id for faster queries
CREATE INDEX IF NOT EXISTS idx_shops_plan_id ON shops(plan_id);

-- Set a default value for existing shops (if plans table has a 'Free' plan)
-- This will be updated after plans are seeded
-- UPDATE shops SET plan_id = (SELECT id FROM plans WHERE name = 'Free' LIMIT 1) WHERE plan_id IS NULL;
