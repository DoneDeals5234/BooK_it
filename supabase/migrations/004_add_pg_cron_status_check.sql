-- Migration: Add pg_cron scheduled job for shop status checking
-- Date: 2025-02-01
-- Description: Automatically check shop online/offline status every minute using pg_cron

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a SQL function to check and update shop status
CREATE OR REPLACE FUNCTION check_shop_status()
RETURNS void AS $$
DECLARE
  v_online_count INT := 0;
  v_recently_online_count INT := 0;
  v_offline_count INT := 0;
BEGIN
  -- Get current timestamps for threshold checks
  -- 2 minutes grace period for "online" status
  -- 10 minutes before marking as "offline"
  
  -- Update shops to 'online' if last ping was within 2 minutes
  UPDATE shops
  SET display_status = 'online'
  WHERE last_ping_time > NOW() - INTERVAL '2 minutes'
  AND display_status != 'online';
  
  GET DIAGNOSTICS v_online_count = ROW_COUNT;

  -- Update shops to 'recently_online' if last ping was 2-10 minutes ago
  UPDATE shops
  SET display_status = 'recently_online'
  WHERE last_ping_time > NOW() - INTERVAL '10 minutes'
  AND last_ping_time <= NOW() - INTERVAL '2 minutes'
  AND display_status != 'recently_online';
  
  GET DIAGNOSTICS v_recently_online_count = ROW_COUNT;

  -- Update shops to 'offline' if last ping was more than 10 minutes ago or is null
  UPDATE shops
  SET display_status = 'offline'
  WHERE (last_ping_time IS NULL OR last_ping_time <= NOW() - INTERVAL '10 minutes')
  AND display_status != 'offline';
  
  GET DIAGNOSTICS v_offline_count = ROW_COUNT;

  -- Log the status check results
  RAISE NOTICE 'Shop status check completed - Online: %, Recently Online: %, Offline: %',
    v_online_count, v_recently_online_count, v_offline_count;
END;
$$ LANGUAGE plpgsql;

-- Schedule the status check to run every minute (adjust as needed)
-- Remove existing job if it exists to avoid duplicates
SELECT cron.unschedule('check-shop-status') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'check-shop-status'
);

-- Schedule the job to run every 1 minute
SELECT cron.schedule(
  'check-shop-status',
  '* * * * *',  -- Every minute: minute hour day month day-of-week
  'SELECT check_shop_status()'
);

-- Note: You can adjust the frequency by changing the cron expression:
-- '* * * * *' = every minute (current)
-- '*/5 * * * *' = every 5 minutes
-- '*/30 * * * *' = every 30 seconds
-- '0 * * * *' = every hour

-- Comment: pg_cron runs in the database server's timezone
-- All timestamps are stored in UTC (TIMESTAMP WITH TIME ZONE)
