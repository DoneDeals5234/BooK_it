-- Add shop ordering fields to the shops table
ALTER TABLE shops ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS pin_order INTEGER DEFAULT 999;

-- Create an index for faster filtering of pinned shops
CREATE INDEX IF NOT EXISTS idx_shops_is_pinned ON shops(is_pinned DESC, pin_order ASC);
