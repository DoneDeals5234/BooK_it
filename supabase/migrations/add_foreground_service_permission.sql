-- Add auto_start_foreground_service permission column to native_shop_owners table
-- APPROACH 1: Shop owners must explicitly grant permission for automatic foreground service

ALTER TABLE native_shop_owners
ADD COLUMN IF NOT EXISTS auto_start_foreground_service BOOLEAN DEFAULT false;

-- Add comment explaining the column
COMMENT ON COLUMN native_shop_owners.auto_start_foreground_service IS 
'APPROACH 1: Permission flag. When true, system can automatically start foreground service on owner device when customer books. Owner must explicitly grant this during onboarding or in settings.';

-- Create an index for faster permission checks
CREATE INDEX IF NOT EXISTS idx_native_shop_owners_permission 
ON native_shop_owners(shop_id, auto_start_foreground_service) 
WHERE auto_start_foreground_service = true;
