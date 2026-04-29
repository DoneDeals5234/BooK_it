-- Enable pg_net extension for async HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create a notification queue table for reliable async processing
CREATE TABLE IF NOT EXISTS booking_notification_queue (
  id BIGSERIAL PRIMARY KEY,
  booking_id UUID NOT NULL,
  event_type TEXT NOT NULL, -- 'created', 'updated', 'deleted'
  shop_id TEXT NOT NULL,
  shop_owner_user_id TEXT NOT NULL,
  notification_title TEXT NOT NULL,
  notification_body TEXT NOT NULL,
  notification_data JSONB,
  status TEXT DEFAULT 'pending', -- pending, sent, failed
  retry_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_booking_notification_queue_status 
ON booking_notification_queue(status) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_booking_notification_queue_booking_id 
ON booking_notification_queue(booking_id);

CREATE INDEX IF NOT EXISTS idx_booking_notification_queue_created_at 
ON booking_notification_queue(created_at DESC);

-- Enable RLS on notification queue
ALTER TABLE booking_notification_queue ENABLE ROW LEVEL SECURITY;

-- Create a policy for service role to insert notifications
CREATE POLICY "Service role can insert notifications on queue"
  ON booking_notification_queue FOR INSERT
  WITH CHECK (TRUE);

-- Create a policy to allow reading by authenticated users (optional)
CREATE POLICY "Users can view their own shop notifications"
  ON booking_notification_queue FOR SELECT
  USING (TRUE);

-- Create the trigger function that queues notifications
CREATE OR REPLACE FUNCTION notify_shop_owner_of_booking_change()
RETURNS TRIGGER AS $$
DECLARE
  shop_owner_user_id TEXT;
  notification_title TEXT;
  notification_body TEXT;
  notification_type TEXT;
  notification_data JSONB;
  booking_record RECORD;
BEGIN
  -- Determine the booking data based on the trigger event
  IF TG_OP = 'DELETE' THEN
    booking_record := OLD;
  ELSE
    booking_record := NEW;
  END IF;

  -- Fetch the shop owner's user ID from native_shop_owners table
  SELECT user_id INTO shop_owner_user_id
  FROM native_shop_owners
  WHERE shop_id = booking_record.shop_id
  LIMIT 1;

  -- If no shop owner found, log and exit gracefully
  IF shop_owner_user_id IS NULL THEN
    RAISE LOG 'No shop owner found for shop_id: %', booking_record.shop_id;
    RETURN booking_record;
  END IF;

  -- Determine notification content based on event type
  IF TG_OP = 'INSERT' THEN
    notification_type := 'created';
    notification_title := '📅 New Booking!';
    notification_body := booking_record.user_name || ' booked ' || booking_record.service_name || 
                        ' at ' || booking_record.time_slot || '. Token #' || booking_record.token_number;
    notification_data := jsonb_build_object(
      'type', 'booking_notification',
      'event', 'booking_created',
      'bookingId', booking_record.id,
      'customerName', booking_record.user_name,
      'customerPhone', booking_record.user_phone,
      'serviceName', booking_record.service_name,
      'timeSlot', booking_record.time_slot,
      'tokenNumber', booking_record.token_number,
      'bookingDate', booking_record.booking_date,
      'shopId', booking_record.shop_id
    );

  ELSIF TG_OP = 'UPDATE' THEN
    -- Only notify if status changed
    IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
      RETURN booking_record;
    END IF;

    notification_type := 'updated';
    
    CASE NEW.status
      WHEN 'in-progress' THEN
        notification_title := '⏳ Booking In Progress';
        notification_body := booking_record.user_name || '''s booking is now being served. Token #' || booking_record.token_number;
      WHEN 'completed' THEN
        notification_title := '✅ Booking Completed';
        notification_body := booking_record.user_name || '''s booking for ' || booking_record.service_name || ' is completed!';
      WHEN 'cancelled' THEN
        notification_title := '❌ Booking Cancelled';
        notification_body := booking_record.user_name || '''s booking has been cancelled.';
      ELSE
        notification_title := '📝 Booking Updated';
        notification_body := 'Booking status changed to: ' || NEW.status;
    END CASE;

    notification_data := jsonb_build_object(
      'type', 'booking_notification',
      'event', 'booking_status_changed',
      'bookingId', booking_record.id,
      'customerName', booking_record.user_name,
      'oldStatus', OLD.status,
      'newStatus', NEW.status,
      'serviceName', booking_record.service_name,
      'shopId', booking_record.shop_id
    );

  ELSIF TG_OP = 'DELETE' THEN
    notification_type := 'deleted';
    notification_title := '❌ Booking Cancelled';
    notification_body := 'Booking for ' || booking_record.user_name || ' (' || booking_record.service_name || 
                        ' at ' || booking_record.time_slot || ') has been deleted.';
    notification_data := jsonb_build_object(
      'type', 'booking_notification',
      'event', 'booking_deleted',
      'bookingId', booking_record.id,
      'customerName', booking_record.user_name,
      'serviceName', booking_record.service_name,
      'timeSlot', booking_record.time_slot,
      'shopId', booking_record.shop_id
    );
  ELSE
    RETURN booking_record;
  END IF;

  -- Queue the notification for async processing
  INSERT INTO booking_notification_queue (
    booking_id, event_type, shop_id, shop_owner_user_id,
    notification_title, notification_body, notification_data
  ) VALUES (
    booking_record.id, notification_type, booking_record.shop_id,
    shop_owner_user_id, notification_title, notification_body, notification_data
  );

  RAISE LOG 'Booking notification queued - Event: %, Owner: %, Booking: %', 
    notification_type, shop_owner_user_id, booking_record.id;

  RETURN booking_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_booking_deleted ON bookings;
DROP TRIGGER IF EXISTS trigger_booking_updated ON bookings;
DROP TRIGGER IF EXISTS trigger_booking_created ON bookings;

-- Create trigger for new bookings
CREATE TRIGGER trigger_booking_created
AFTER INSERT ON bookings
FOR EACH ROW
EXECUTE FUNCTION notify_shop_owner_of_booking_change();

-- Create trigger for booking updates
CREATE TRIGGER trigger_booking_updated
AFTER UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION notify_shop_owner_of_booking_change();

-- Create trigger for booking deletions
CREATE TRIGGER trigger_booking_deleted
AFTER DELETE ON bookings
FOR EACH ROW
EXECUTE FUNCTION notify_shop_owner_of_booking_change();

-- Add documentation comments
COMMENT ON FUNCTION notify_shop_owner_of_booking_change() IS 
'Triggered on INSERT, UPDATE, or DELETE of bookings. Automatically queues notifications to be sent to the shop owner. The queue is processed by the process-booking-notifications edge function.';

COMMENT ON TABLE booking_notification_queue IS 
'Stores pending booking notifications. Processed asynchronously by edge functions. Includes retry logic.';

COMMENT ON TRIGGER trigger_booking_created ON bookings IS 
'Queues shop owner notification when a new booking is created';

COMMENT ON TRIGGER trigger_booking_updated ON bookings IS 
'Queues shop owner notification when booking status changes';

COMMENT ON TRIGGER trigger_booking_deleted ON bookings IS 
'Queues shop owner notification when a booking is deleted/cancelled';
