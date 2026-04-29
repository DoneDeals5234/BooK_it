-- Migration: Update shop category constraint to include all new categories
-- Date: 2025-02-10
-- Description: Expands allowed shop categories beyond just salon, parlour, restaurant

BEGIN;

-- Drop the old constraint if it exists
ALTER TABLE shops
DROP CONSTRAINT IF EXISTS category_check;

-- Add new constraint with all allowed categories
ALTER TABLE shops
ADD CONSTRAINT category_check CHECK (
  category IN (
    'salon',
    'parlour',
    'restaurant',
    'shoes',
    'clothes',
    'cosmetics',
    'groceries',
    'stationery'
  )
);

COMMIT;
