-- Migration: Add order_code and otp_code to orders table
-- This supports 6-digit numeric order IDs for customer verification

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS order_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS otp_code TEXT;

-- Add index for faster verification lookups
CREATE INDEX IF NOT EXISTS idx_orders_order_code ON orders(order_code);
CREATE INDEX IF NOT EXISTS idx_orders_otp_code ON orders(otp_code);

-- Add comments
COMMENT ON COLUMN orders.order_code IS '6-digit numeric code for customer order identification';
COMMENT ON COLUMN orders.otp_code IS '6-digit numeric code for delivery verification';
