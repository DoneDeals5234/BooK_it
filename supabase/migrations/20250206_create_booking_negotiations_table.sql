-- Create booking_negotiations table to track back-and-forth offers
CREATE TABLE IF NOT EXISTS booking_negotiations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_request_id UUID NOT NULL REFERENCES booking_requests(id) ON DELETE CASCADE,
  offered_times JSONB NOT NULL, -- Array of time options offered
  offered_by TEXT NOT NULL, -- 'owner' or 'customer'
  response_status TEXT DEFAULT 'pending', -- pending, accepted, rejected, expired
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 minute')
);

-- Create indexes for common queries
CREATE INDEX idx_booking_negotiations_booking_request_id ON booking_negotiations(booking_request_id);
CREATE INDEX idx_booking_negotiations_response_status ON booking_negotiations(response_status);
CREATE INDEX idx_booking_negotiations_expires_at ON booking_negotiations(expires_at);
CREATE INDEX idx_booking_negotiations_created_at ON booking_negotiations(created_at DESC);
