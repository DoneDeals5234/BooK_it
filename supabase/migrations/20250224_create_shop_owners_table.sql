-- Create shop_owners table to store owner email and password credentials
CREATE TABLE IF NOT EXISTS shop_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(email, shop_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_shop_owners_email ON shop_owners(email);
CREATE INDEX IF NOT EXISTS idx_shop_owners_shop_id ON shop_owners(shop_id);

-- Enable RLS
ALTER TABLE shop_owners ENABLE ROW LEVEL SECURITY;

-- Create policy to allow inserting own owner record (during signup)
CREATE POLICY "Anyone can create their own shop owner record"
  ON shop_owners FOR INSERT
  WITH CHECK (true);

-- Note: Authentication will be handled at the application level or through Supabase Auth
-- We'll not expose the password_hash in queries by default
