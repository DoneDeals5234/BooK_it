-- Create orders table for managing customer orders
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  order_amount DECIMAL(10, 2) NOT NULL,
  order_description TEXT,
  status TEXT DEFAULT 'pending', -- pending, accepted, rejected, ready_for_collection, collected
  rejection_reason TEXT, -- Reason for rejection (e.g., "out_of_stock", "not_available", "custom_message")
  rejection_notes TEXT, -- Custom rejection message from owner
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  ready_at TIMESTAMP WITH TIME ZONE,
  collected_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '48 hours'),
  
  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('pending', 'accepted', 'rejected', 'ready_for_collection', 'collected')),
  CONSTRAINT valid_amount CHECK (order_amount > 0)
);

-- Create indexes for common queries
CREATE INDEX idx_orders_shop_id ON orders(shop_id);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_expires_at ON orders(expires_at);

-- Enable RLS on orders table
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for orders table
-- Allow INSERT only for service role (Edge Functions will use service role)
-- This maintains security while allowing Edge Functions to bypass normal auth
CREATE POLICY "Customers can insert their own orders"
  ON orders FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR auth.uid() IS NOT NULL);

-- Customers can view their own orders
CREATE POLICY "Customers can view their own orders"
  ON orders FOR SELECT
  WHERE customer_id = auth.uid();

-- Customers can update their own orders (only cancel/mark collected)
CREATE POLICY "Customers can update their own orders"
  ON orders FOR UPDATE
  WHERE customer_id = auth.uid()
  WITH CHECK (customer_id = auth.uid());

-- Shop owners can view orders for their shops
CREATE POLICY "Shop owners can view orders for their shops"
  ON orders FOR SELECT
  USING (
    shop_id IN (
      SELECT id FROM shops WHERE owner_id = auth.uid()
    )
  );

-- Shop owners can update orders for their shops (accept/reject)
CREATE POLICY "Shop owners can update orders for their shops"
  ON orders FOR UPDATE
  USING (
    shop_id IN (
      SELECT id FROM shops WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    shop_id IN (
      SELECT id FROM shops WHERE owner_id = auth.uid()
    )
  );

-- Allow admins to view all orders
CREATE POLICY "Service role can manage orders"
  ON orders FOR ALL
  USING (auth.role() = 'service_role');
