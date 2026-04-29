-- Migration: Update shop categories from old format to new format
-- NOTE: This migration requires that the category column exists on the shops table
-- It should be run AFTER supabase_migrations/002_add_category_to_shops.sql
--
-- Date: 2025-01-28
-- Description: The beauty parlour and girl saloon categories have been consolidated into a single 'parlour' category

-- Start transaction
BEGIN;

-- Check if any shops have the old category values and migrate them
-- (This would only happen if the category column was previously populated with old values)
UPDATE shops
SET category = 'parlour',
    updated_at = NOW()
WHERE category IN ('beauty-parlour', 'girl-saloon');

-- Verify migration results
SELECT
  category,
  COUNT(*) as shop_count
FROM shops
GROUP BY category
ORDER BY shop_count DESC;

-- Commit transaction
COMMIT;
