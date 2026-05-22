-- Migration: Create table for orders transferred to fulfillment emails
-- This table stores all information for orders that are forwarded to a fulfillment center

CREATE TABLE IF NOT EXISTS transferred_fulfillment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  fulfillment_email TEXT NOT NULL,
  transferred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Copied from original orders table
  shop_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  order_amount DECIMAL(10, 2) NOT NULL,
  order_description TEXT,
  status TEXT,
  rejection_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  ready_at TIMESTAMP WITH TIME ZONE,
  collected_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '48 hours'),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Extra columns from later migrations
  fulfillment_status TEXT,
  delivery_type TEXT,
  delivery_choice TEXT,
  unit_price DECIMAL(10, 2),
  delivery_cost DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2),
  customer_lat DOUBLE PRECISION,
  customer_lng DOUBLE PRECISION,
  shop_lat DOUBLE PRECISION,
  shop_lng DOUBLE PRECISION,
  shop_name TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transferred_orders_shop_id ON transferred_fulfillment_orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_transferred_orders_email ON transferred_fulfillment_orders(fulfillment_email);
CREATE INDEX IF NOT EXISTS idx_transferred_orders_orig_id ON transferred_fulfillment_orders(original_order_id);

-- Enable RLS
ALTER TABLE transferred_fulfillment_orders ENABLE ROW LEVEL SECURITY;

-- Policies
-- 1. Shop owners can view transferred orders for their shops
DROP POLICY IF EXISTS "Shop owners can view their transferred orders" ON transferred_fulfillment_orders;
CREATE POLICY "Shop owners can view their transferred orders"
  ON transferred_fulfillment_orders FOR SELECT
  USING (
    shop_id IN (
      SELECT shop_id FROM public.shop_owners WHERE user_id = auth.uid()::text
    )
    OR
    shop_id IN (
      SELECT shop_id FROM public.native_shop_owners WHERE user_id = auth.uid()::text
    )
  );

-- 2. Service role (Edge Functions/Admins) has full access
DROP POLICY IF EXISTS "Service role can manage transferred orders" ON transferred_fulfillment_orders;
CREATE POLICY "Service role can manage transferred orders"
  ON transferred_fulfillment_orders FOR ALL
  USING (auth.role() = 'service_role');
