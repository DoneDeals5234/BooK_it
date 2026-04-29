-- Add is_free_plan column to shop_owner_plans to track free tier registrations
ALTER TABLE shop_owner_plans
ADD COLUMN IF NOT EXISTS is_free_plan BOOLEAN DEFAULT false;

-- Create index for faster lookups of free plan registrations
CREATE INDEX IF NOT EXISTS idx_shop_owner_plans_is_free ON shop_owner_plans(is_free_plan);

-- Verify column was added
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'shop_owner_plans' AND column_name = 'is_free_plan';
