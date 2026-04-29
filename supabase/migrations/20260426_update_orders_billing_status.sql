-- Add new columns to support billing and delivery tracking
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS delivery_cost DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS distance DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS book_it_status TEXT DEFAULT NULL, -- 'accepted', 'picking_up', 'delivering', 'delivered'
ADD COLUMN IF NOT EXISTS customer_lat DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS customer_lng DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS shop_lat DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS shop_lng DECIMAL(11, 8);

-- Add comments for documentation
COMMENT ON COLUMN orders.delivery_cost IS 'Calculated delivery fee based on distance';
COMMENT ON COLUMN orders.total_amount IS 'Total amount including product price and delivery cost';
COMMENT ON COLUMN orders.distance IS 'Distance between shop and customer in kilometers';
COMMENT ON COLUMN orders.book_it_status IS 'Specific status for Book It delivery service';
COMMENT ON COLUMN orders.customer_lat IS 'Latitude of the customer at order time';
COMMENT ON COLUMN orders.customer_lng IS 'Longitude of the customer at order time';
COMMENT ON COLUMN orders.shop_lat IS 'Latitude of the shop at order time';
COMMENT ON COLUMN orders.shop_lng IS 'Longitude of the shop at order time';
