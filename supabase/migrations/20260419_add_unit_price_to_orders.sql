-- Add unit_price column to orders table to track the price at the time of purchase
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS unit_price DECIMAL(10, 2);

-- Add comment for documentation
COMMENT ON COLUMN orders.unit_price IS 'Price of a single unit of the product at the time of order';
