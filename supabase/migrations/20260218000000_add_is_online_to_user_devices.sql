-- Migration to add is_online column to user_devices for tracking active sessions
-- This allows preventing multiple concurrent logins with the same ID

ALTER TABLE public.user_devices 
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE;

-- Add a comment to the column for clarity
COMMENT ON COLUMN public.user_devices.is_online IS 'Tracks whether a user is currently logged in to prevent multiple sessions.';
