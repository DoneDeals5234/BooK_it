-- Migration: Add fulfillment_status column to orders table
-- Run this in your Supabase SQL editor

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS fulfillment_status TEXT
  CHECK (fulfillment_status IN ('order_accepted', 'product_picking', 'delivery', 'order_complete'));

-- Optional: Add a comment for clarity
COMMENT ON COLUMN orders.fulfillment_status IS 
  'Shop owner internal order processing pipeline: order_accepted -> product_picking -> delivery -> order_complete';
