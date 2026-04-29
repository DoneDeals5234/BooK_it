-- Migration: Add shop status tracking and missing columns
-- Date: 2025-02-01
-- Description: Adds columns for heartbeat-based online status tracking and missing category/time columns

BEGIN;

-- Add category column if it doesn't exist
-- Values: 'salon', 'parlour', 'restaurant'
ALTER TABLE shops
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'salon';

-- Add time columns if they don't exist
ALTER TABLE shops
ADD COLUMN IF NOT EXISTS opening_time TEXT DEFAULT '09:00';

ALTER TABLE shops
ADD COLUMN IF NOT EXISTS closing_time TEXT DEFAULT '18:00';

-- Add heartbeat tracking columns for online status
-- last_ping_time: timestamp of last heartbeat from the app
-- display_status: current status to show on home page ('online', 'recently_online', 'offline')
ALTER TABLE shops
ADD COLUMN IF NOT EXISTS last_ping_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS display_status TEXT DEFAULT 'offline';

-- Create index on display_status for faster queries
CREATE INDEX IF NOT EXISTS shops_display_status_idx ON shops(display_status);

-- Create index on last_ping_time for status checking
CREATE INDEX IF NOT EXISTS shops_last_ping_time_idx ON shops(last_ping_time DESC NULLS LAST);

-- Add constraint to ensure display_status has valid values (if it doesn't already exist)
DO $$
BEGIN
    ALTER TABLE shops
    ADD CONSTRAINT valid_display_status CHECK (display_status IN ('online', 'recently_online', 'offline'));
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

COMMIT;
