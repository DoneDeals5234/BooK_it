-- Add fcm_token column to user_devices table (for web users)
ALTER TABLE public.user_devices ADD COLUMN IF NOT EXISTS fcm_token text;

-- Index for faster FCM token lookups
CREATE INDEX IF NOT EXISTS idx_user_devices_fcm_token ON public.user_devices(fcm_token) WHERE fcm_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_native_devices_fcm_token ON public.native_devices(fcm_token) WHERE fcm_token IS NOT NULL;
