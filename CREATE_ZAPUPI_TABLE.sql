CREATE TABLE IF NOT EXISTS zapupi_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT NOT NULL UNIQUE,
    txn_id TEXT,
    status TEXT NOT NULL,
    amount DECIMAL NOT NULL,
    pay_amount DECIMAL,
    utr TEXT,
    customer_mobile TEXT,
    remark TEXT,
    remark_array JSONB,
    environment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups based on order ID and status
CREATE INDEX IF NOT EXISTS idx_zapupi_order_id ON zapupi_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_zapupi_status ON zapupi_payments(status);

-- Enable RLS
ALTER TABLE zapupi_payments ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users who own the payment (if applicable, else only service role can read/write)
-- For now, service role has all access by default in Supabase.
