-- Enable RLS on featured_products table
ALTER TABLE featured_products ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (in case they are wrong)
DROP POLICY IF EXISTS "Anyone can view active featured products" ON featured_products;
DROP POLICY IF EXISTS "Shop owners can view their own featured products" ON featured_products;
DROP POLICY IF EXISTS "Shop owners can create featured products" ON featured_products;
DROP POLICY IF EXISTS "Shop owners can update their own featured products" ON featured_products;
DROP POLICY IF EXISTS "Shop owners can delete their own featured products" ON featured_products;

-- Policy: Anyone can view active featured products (public read)
CREATE POLICY "Anyone can view active featured products" ON featured_products
FOR SELECT USING (is_active = true);

-- Policy: Shop owners can view all their own featured products
CREATE POLICY "Shop owners can view their own featured products" ON featured_products
FOR SELECT USING (
  shop_id IN (
    SELECT shop_id FROM shop_owners WHERE user_id = auth.uid()::text
  )
);

-- Policy: Shop owners can create featured products for their shop
CREATE POLICY "Shop owners can create featured products" ON featured_products
FOR INSERT WITH CHECK (
  shop_id IN (
    SELECT shop_id FROM shop_owners WHERE user_id = auth.uid()::text
  )
);

-- Policy: Shop owners can update their own featured products
CREATE POLICY "Shop owners can update their own featured products" ON featured_products
FOR UPDATE USING (
  shop_id IN (
    SELECT shop_id FROM shop_owners WHERE user_id = auth.uid()::text
  )
) WITH CHECK (
  shop_id IN (
    SELECT shop_id FROM shop_owners WHERE user_id = auth.uid()::text
  )
);

-- Policy: Shop owners can delete their own featured products
CREATE POLICY "Shop owners can delete their own featured products" ON featured_products
FOR DELETE USING (
  shop_id IN (
    SELECT shop_id FROM shop_owners WHERE user_id = auth.uid()::text
  )
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS featured_products_shop_id_idx ON featured_products(shop_id);
CREATE INDEX IF NOT EXISTS featured_products_is_active_idx ON featured_products(is_active);
CREATE INDEX IF NOT EXISTS featured_products_shop_id_is_active_idx ON featured_products(shop_id, is_active);
