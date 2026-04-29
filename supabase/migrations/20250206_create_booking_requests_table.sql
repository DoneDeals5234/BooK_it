-- Create booking_requests table to track booking negotiation state
CREATE TABLE IF NOT EXISTS booking_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  service_name TEXT NOT NULL,
  service_price TEXT NOT NULL,
  requested_time_slots JSONB NOT NULL, -- Array of time slots requested by customer
  status TEXT DEFAULT 'pending_owner_response', -- pending_owner_response, owner_confirmed, owner_rejected, counter_offered, pending_customer_response, confirmed, expired, cancelled
  last_notification_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 minute')
);

-- Create indexes for common queries
CREATE INDEX idx_booking_requests_shop_id ON booking_requests(shop_id);
CREATE INDEX idx_booking_requests_user_id ON booking_requests(user_id);
CREATE INDEX idx_booking_requests_status ON booking_requests(status);
CREATE INDEX idx_booking_requests_expires_at ON booking_requests(expires_at);
CREATE INDEX idx_booking_requests_created_at ON booking_requests(created_at DESC);
