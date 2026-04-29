-- Add columns to track reminder time and customer confirmation from foreground service
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS reminder_time TEXT;

-- Track customer's confirmation status (pending, confirmed, cancelled)
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS customer_confirmation TEXT DEFAULT 'pending';

-- Track foreground service status (not_started, running, completed)
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS foreground_service_status TEXT DEFAULT 'not_started';

-- Track when customer confirmed or cancelled
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS customer_confirmed_at TIMESTAMP WITH TIME ZONE;

-- Store owner notification status for confirmation/cancellation
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS owner_notified_confirmation BOOLEAN DEFAULT false;

-- Create index for filtering pending confirmations
CREATE INDEX IF NOT EXISTS idx_bookings_pending_confirmations 
ON bookings(user_id, customer_confirmation) 
WHERE customer_confirmation = 'pending';

-- Create index for checking foreground service status
CREATE INDEX IF NOT EXISTS idx_bookings_foreground_service 
ON bookings(foreground_service_status, user_id);
