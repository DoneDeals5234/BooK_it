-- Add unique constraints to enable reliable upserting in Edge Functions
-- user_devices: one record per user_id is sufficient for our sync logic
ALTER TABLE public.user_devices 
ADD CONSTRAINT user_devices_user_id_key UNIQUE (user_id);

-- native_devices: unique per user and player ID
ALTER TABLE public.native_devices
ADD CONSTRAINT native_devices_user_id_player_id_key UNIQUE (user_id, player_id);
