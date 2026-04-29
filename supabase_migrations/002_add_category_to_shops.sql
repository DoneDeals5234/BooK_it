-- Migration: Add category column to shops table
-- This migration adds support for shop categories (salon, parlour, restaurant)
-- Date: 2025-01-28

-- Add category column with default value
ALTER TABLE shops
ADD COLUMN category TEXT DEFAULT 'salon' NOT NULL;

-- Add check constraint to ensure valid category values
ALTER TABLE shops
ADD CONSTRAINT category_check CHECK (category IN ('salon', 'parlour', 'restaurant'));

-- Create index for efficient category filtering
CREATE INDEX IF NOT EXISTS idx_shops_category ON shops(category);

-- Log migration completion
SELECT 'Category column added to shops table successfully' as migration_status;
