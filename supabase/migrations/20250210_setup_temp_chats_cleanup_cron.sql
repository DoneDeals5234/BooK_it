-- Migration: Setup pg_cron for Temporary Chats Cleanup
-- Date: 2025-02-10
-- Description: Schedule automatic cleanup of expired temporary chats at 1 AM daily

-- ============================================
-- 1. Enable pg_cron extension (if not already enabled)
-- ============================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================
-- 2. Schedule the cleanup function to run at 1 AM UTC daily
-- ============================================
-- This will run the cleanup_expired_chats function every day at 1:00 AM UTC
-- Cron format: minute hour day month day-of-week
-- 0 1 * * * = 1:00 AM every day
SELECT cron.schedule(
  'cleanup-temporary-chats',  -- Job name
  '0 1 * * *',               -- Cron expression (1 AM UTC daily)
  'SELECT cleanup_expired_chats();' -- Function to execute
);

-- ============================================
-- 3. Optional: View all scheduled jobs
-- ============================================
-- To see all scheduled jobs:
-- SELECT * FROM cron.job;
--
-- To unschedule a job:
-- SELECT cron.unschedule('cleanup-temporary-chats');
--
-- To manually run the cleanup:
-- SELECT cleanup_expired_chats();
