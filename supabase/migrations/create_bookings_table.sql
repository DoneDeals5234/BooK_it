-- Create table for bookings
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id TEXT NOT NULL,
  service_name TEXT NOT NULL,
  service_price TEXT NOT NULL,
  time_slot TEXT NOT NULL,
  token_number INT NOT NULL,
  user_name TEXT NOT NULL,
  user_phone TEXT NOT NULL,
  booking_date TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  user_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for querying bookings by shop
CREATE INDEX IF NOT EXISTS idx_bookings_shop_id 
ON bookings(shop_id);

-- Create index for querying bookings by booking date
CREATE INDEX IF NOT EXISTS idx_bookings_date 
ON bookings(booking_date);

-- Create index for querying bookings by user
CREATE INDEX IF NOT EXISTS idx_bookings_user_id 
ON bookings(user_id);

-- Create composite index for availability checks
CREATE INDEX IF NOT EXISTS idx_bookings_availability 
ON bookings(shop_id, booking_date, time_slot);

-- Create index for token number queries
CREATE INDEX IF NOT EXISTS idx_bookings_token 
ON bookings(shop_id, token_number);
