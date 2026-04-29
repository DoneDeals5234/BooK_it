-- Add reminder fields to bookings table
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS reminder_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reminder_minutes_before INT DEFAULT 30,
ADD COLUMN IF NOT EXISTS reminder_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS customer_confirmed BOOLEAN,
ADD COLUMN IF NOT EXISTS reminder_triggered_at TIMESTAMP WITH TIME ZONE;

-- Create index for querying pending reminders
CREATE INDEX IF NOT EXISTS idx_bookings_pending_reminders 
ON bookings(reminder_time, status) 
WHERE reminder_enabled = true AND customer_confirmed IS NULL;

-- Add comment to document the reminder flow
COMMENT ON TABLE bookings IS 'Bookings table with reminder support. Reminders trigger at reminder_time, customer gets full-screen alert with Yes/No buttons. Yes = confirmed arrival, No = cancel booking.';
