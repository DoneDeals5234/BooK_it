-- Create table for alert reminders (processed by be-alert-reminders function)
CREATE TABLE IF NOT EXISTS alert_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  booking_id TEXT NOT NULL,
  shop_id TEXT NOT NULL,
  shop_name TEXT NOT NULL,
  token_number INT NOT NULL,
  user_name TEXT NOT NULL,
  time_slot TEXT NOT NULL,
  booking_date TEXT NOT NULL,
  reminder_time TEXT NOT NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  timezone_offset_hours FLOAT DEFAULT 0,
  sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient querying of pending reminders
-- Note: WHERE clause with NOW() is not allowed (NOW() is volatile)
-- Instead, we index the columns and let the query filter on NOW() at runtime
CREATE INDEX IF NOT EXISTS idx_alert_reminders_pending
ON alert_reminders(sent, scheduled_for)
WHERE sent = FALSE;

-- Create index for querying by user
CREATE INDEX IF NOT EXISTS idx_alert_reminders_user 
ON alert_reminders(user_id);

-- Create index for querying by booking
CREATE INDEX IF NOT EXISTS idx_alert_reminders_booking 
ON alert_reminders(booking_id);
