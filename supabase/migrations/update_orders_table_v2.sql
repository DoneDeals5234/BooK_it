-- Add new columns to the orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS customer_address TEXT,
ADD COLUMN IF NOT EXISTS location_link TEXT,
ADD COLUMN IF NOT EXISTS product_name TEXT,
ADD COLUMN IF NOT EXISTS product_image TEXT;

-- Add comments for documentation
COMMENT ON COLUMN orders.quantity IS 'Number of items ordered';
COMMENT ON COLUMN orders.customer_address IS 'Delivery address provided by the customer';
COMMENT ON COLUMN orders.location_link IS 'Google Maps link generated from GPS coordinates';
COMMENT ON COLUMN orders.product_name IS 'Name of the product being ordered';
COMMENT ON COLUMN orders.product_image IS 'URL of the product image';
