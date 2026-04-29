-- Create shops table
CREATE TABLE IF NOT EXISTS shops (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  owner_phone TEXT NOT NULL,
  about TEXT,
  shop_image_url TEXT,
  location_image_url TEXT,
  location_map_link TEXT,
  password TEXT NOT NULL,
  barber_members JSONB DEFAULT '[]'::jsonb,
  services JSONB DEFAULT '[]'::jsonb,
  is_open BOOLEAN DEFAULT true,
  token_booking_paused BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index on created_at for efficient ordering
CREATE INDEX IF NOT EXISTS shops_created_at_idx ON shops(created_at DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;

-- Allow all users to read shops
CREATE POLICY IF NOT EXISTS "Allow public read access to shops"
  ON shops
  FOR SELECT
  TO public
  USING (true);

-- Allow authenticated users to update shops (for barber portal)
CREATE POLICY IF NOT EXISTS "Allow authenticated users to update their shops"
  ON shops
  FOR UPDATE
  TO authenticated
  USING (true);

-- Allow authenticated users to insert shops (for staff portal)
CREATE POLICY IF NOT EXISTS "Allow authenticated users to insert shops"
  ON shops
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to delete shops (for staff portal)
CREATE POLICY IF NOT EXISTS "Allow authenticated users to delete shops"
  ON shops
  FOR DELETE
  TO authenticated
  USING (true);
