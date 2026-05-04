-- 1. Add missing columns to the orders table to support delivery and payment details
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS delivery_cost DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS customer_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS customer_lng DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS shop_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS shop_lng DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS shop_name TEXT;

-- Update total_amount for existing orders if it's null
UPDATE orders SET total_amount = order_amount WHERE total_amount IS NULL;

-- 2. Fix broken RLS policy for shop owners to view orders
-- The previous policy tried to use a non-existent owner_id column on shops table
DROP POLICY IF EXISTS "Shop owners can view orders for their shops" ON public.orders;

CREATE POLICY "Shop owners can view orders for their shops"
  ON public.orders
  FOR SELECT
  USING (
    shop_id IN (
      SELECT shop_id FROM public.shop_owners WHERE user_id = auth.uid()::text
    )
    OR
    shop_id IN (
      SELECT shop_id FROM public.native_shop_owners WHERE user_id = auth.uid()::text
    )
  );

-- Also fix the update policy
DROP POLICY IF EXISTS "Shop owners can update orders for their shops" ON public.orders;

CREATE POLICY "Shop owners can update orders for their shops"
  ON public.orders
  FOR UPDATE
  USING (
    shop_id IN (
      SELECT shop_id FROM public.shop_owners WHERE user_id = auth.uid()::text
    )
    OR
    shop_id IN (
      SELECT shop_id FROM public.native_shop_owners WHERE user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    shop_id IN (
      SELECT shop_id FROM public.shop_owners WHERE user_id = auth.uid()::text
    )
    OR
    shop_id IN (
      SELECT shop_id FROM public.native_shop_owners WHERE user_id = auth.uid()::text
    )
  );

-- Add comments for documentation
COMMENT ON COLUMN orders.delivery_cost IS 'Cost of delivery charged to the customer';
COMMENT ON COLUMN orders.total_amount IS 'Total order amount including delivery cost';
COMMENT ON COLUMN orders.customer_lat IS 'Latitude of the customer delivery location';
COMMENT ON COLUMN orders.customer_lng IS 'Longitude of the customer delivery location';
COMMENT ON COLUMN orders.shop_lat IS 'Latitude of the shop location at the time of order';
COMMENT ON COLUMN orders.shop_lng IS 'Longitude of the shop location at the time of order';
COMMENT ON COLUMN orders.shop_name IS 'Name of the shop at the time of order (snapshot)';

-- 3. Update status constraint to include delivery-related statuses
-- We drop both common names for this constraint to be safe
ALTER TABLE orders DROP CONSTRAINT IF EXISTS valid_status;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT valid_status CHECK (status IN ('pending', 'accepted', 'rejected', 'ready_for_collection', 'ready_for_delivery', 'out_for_delivery', 'collected', 'delivered'));

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
