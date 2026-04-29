-- Create khata_book_customers table for storing customer ledger information
CREATE TABLE IF NOT EXISTS khata_book_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20),
  total_amount_to_collect DECIMAL(10, 2) NOT NULL,
  remaining_amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'settled'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create khata_book_payments table for tracking individual payments
CREATE TABLE IF NOT EXISTS khata_book_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES khata_book_customers(id) ON DELETE CASCADE,
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  amount_paid DECIMAL(10, 2) NOT NULL,
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_khata_book_customers_shop_id 
ON khata_book_customers(shop_id);

CREATE INDEX IF NOT EXISTS idx_khata_book_customers_shop_status 
ON khata_book_customers(shop_id, status);

CREATE INDEX IF NOT EXISTS idx_khata_book_payments_customer_id 
ON khata_book_payments(customer_id);

CREATE INDEX IF NOT EXISTS idx_khata_book_payments_shop_id 
ON khata_book_payments(shop_id);

CREATE INDEX IF NOT EXISTS idx_khata_book_payments_payment_date 
ON khata_book_payments(payment_date);

-- Enable RLS for khata_book_customers
ALTER TABLE khata_book_customers ENABLE ROW LEVEL SECURITY;

-- Enable RLS for khata_book_payments
ALTER TABLE khata_book_payments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for khata_book_customers
-- Allow shop owners to view their own customers
CREATE POLICY "Shop owners can view their khata book customers"
  ON khata_book_customers FOR SELECT
  USING (shop_id = auth.uid()::text);

-- Allow shop owners to insert customers
CREATE POLICY "Shop owners can insert khata book customers"
  ON khata_book_customers FOR INSERT
  WITH CHECK (shop_id = auth.uid()::text);

-- Allow shop owners to update their customers
CREATE POLICY "Shop owners can update their khata book customers"
  ON khata_book_customers FOR UPDATE
  USING (shop_id = auth.uid()::text)
  WITH CHECK (shop_id = auth.uid()::text);

-- Allow shop owners to delete their customers
CREATE POLICY "Shop owners can delete their khata book customers"
  ON khata_book_customers FOR DELETE
  USING (shop_id = auth.uid()::text);

-- Create RLS policies for khata_book_payments
-- Allow shop owners to view payments for their customers
CREATE POLICY "Shop owners can view their khata book payments"
  ON khata_book_payments FOR SELECT
  USING (
    shop_id = auth.uid()::text
  );

-- Allow shop owners to insert payments
CREATE POLICY "Shop owners can insert khata book payments"
  ON khata_book_payments FOR INSERT
  WITH CHECK (
    shop_id = auth.uid()::text
  );

-- Allow shop owners to update payments
CREATE POLICY "Shop owners can update their khata book payments"
  ON khata_book_payments FOR UPDATE
  USING (shop_id = auth.uid()::text)
  WITH CHECK (shop_id = auth.uid()::text);
