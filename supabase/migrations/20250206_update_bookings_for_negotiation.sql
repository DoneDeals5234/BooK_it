-- Add booking_request_id column to bookings table to track the negotiation that led to this booking
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_request_id UUID REFERENCES booking_requests(id) ON DELETE SET NULL;

-- Create index for the new column
CREATE INDEX IF NOT EXISTS idx_bookings_booking_request_id ON bookings(booking_request_id);
