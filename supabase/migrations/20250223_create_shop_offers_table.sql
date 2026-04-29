-- Create shop_offers table for storing shop offers/promotions
CREATE TABLE IF NOT EXISTS public.shop_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id TEXT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  image_url TEXT,
  discount_percentage DECIMAL(5, 2),
  discount_amount DECIMAL(10, 2),
  valid_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_shop_id FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

-- Enable RLS on shop_offers table
ALTER TABLE shop_offers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (in case they are wrong)
DROP POLICY IF EXISTS "Anyone can view active shop offers" ON shop_offers;
DROP POLICY IF EXISTS "Shop owners can view their own offers" ON shop_offers;
DROP POLICY IF EXISTS "Shop owners can create offers" ON shop_offers;
DROP POLICY IF EXISTS "Shop owners can update their own offers" ON shop_offers;
DROP POLICY IF EXISTS "Shop owners can delete their own offers" ON shop_offers;

-- Policy: Anyone can view active shop offers (public read)
CREATE POLICY "Anyone can view active shop offers" ON shop_offers
FOR SELECT USING (is_active = true AND valid_until > NOW());

-- Policy: Shop owners can view all their own offers
CREATE POLICY "Shop owners can view their own offers" ON shop_offers
FOR SELECT USING (
  shop_id IN (
    SELECT shop_id FROM shop_owners WHERE user_id = auth.uid()::text
  )
);

-- Policy: Shop owners can create offers for their shop
CREATE POLICY "Shop owners can create offers" ON shop_offers
FOR INSERT WITH CHECK (
  shop_id IN (
    SELECT shop_id FROM shop_owners WHERE user_id = auth.uid()::text
  )
);

-- Policy: Shop owners can update their own offers
CREATE POLICY "Shop owners can update their own offers" ON shop_offers
FOR UPDATE USING (
  shop_id IN (
    SELECT shop_id FROM shop_owners WHERE user_id = auth.uid()::text
  )
) WITH CHECK (
  shop_id IN (
    SELECT shop_id FROM shop_owners WHERE user_id = auth.uid()::text
  )
);

-- Policy: Shop owners can delete their own offers
CREATE POLICY "Shop owners can delete their own offers" ON shop_offers
FOR DELETE USING (
  shop_id IN (
    SELECT shop_id FROM shop_owners WHERE user_id = auth.uid()::text
  )
);

-- Create indices for better query performance
CREATE INDEX IF NOT EXISTS shop_offers_shop_id_idx ON shop_offers(shop_id);
CREATE INDEX IF NOT EXISTS shop_offers_is_active_idx ON shop_offers(is_active);
CREATE INDEX IF NOT EXISTS shop_offers_valid_until_idx ON shop_offers(valid_until);
CREATE INDEX IF NOT EXISTS shop_offers_shop_id_is_active_idx ON shop_offers(shop_id, is_active);
CREATE INDEX IF NOT EXISTS shop_offers_shop_id_active_valid_idx ON shop_offers(shop_id, is_active, valid_until);
