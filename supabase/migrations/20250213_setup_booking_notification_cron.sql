-- Enable pg_cron extension for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Grant usage to postgres user (needed for pg_cron)
GRANT USAGE ON SCHEMA cron TO postgres;

-- Create a function that calls the notification processing edge function
CREATE OR REPLACE FUNCTION trigger_booking_notification_processor()
RETURNS void AS $$
DECLARE
  response_text TEXT;
  supabase_url TEXT;
  edge_function_url TEXT;
BEGIN
  -- Get Supabase URL from environment
  supabase_url := current_setting('app.settings.supabase_url', true);
  
  IF supabase_url IS NULL THEN
    -- Fallback: construct from environment
    -- In a real scenario, you would set this in your Supabase project settings
    RAISE NOTICE 'Supabase URL not configured in settings';
    RETURN;
  END IF;

  edge_function_url := supabase_url || '/functions/v1/process-booking-notifications';

  -- Call the edge function to process the queue
  -- This uses pg_net to make an async HTTP request
  PERFORM net.http_post(
    url := edge_function_url,
    body := '{"action": "process_queue"}'::text,
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    timeout_milliseconds := 30000
  );

  RAISE LOG 'Booking notification processor triggered at %', NOW();
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error in trigger_booking_notification_processor: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule the notification processor to run every minute
-- This will check the queue and send pending notifications
SELECT cron.schedule(
  'process-booking-notifications',
  '* * * * *', -- Every minute
  'SELECT trigger_booking_notification_processor()'
);

-- Alternative: Less frequent schedule (every 5 minutes)
-- SELECT cron.schedule(
--   'process-booking-notifications',
--   '*/5 * * * *', -- Every 5 minutes
--   'SELECT trigger_booking_notification_processor()'
-- );

-- Add documentation
COMMENT ON FUNCTION trigger_booking_notification_processor() IS 
'Scheduled function that calls the process-booking-notifications edge function to send queued notifications. Runs every minute.';
