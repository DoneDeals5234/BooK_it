-- Update order status to include delivery-related statuses
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'order_status' AND e.enumlabel = 'ready_for_delivery') THEN
        ALTER TYPE order_status ADD VALUE 'ready_for_delivery';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'order_status' AND e.enumlabel = 'out_for_delivery') THEN
        ALTER TYPE order_status ADD VALUE 'out_for_delivery';
    END IF;
EXCEPTION
    WHEN undefined_object THEN
        -- If status is just text, do nothing or handle accordingly
        NULL;
END $$;

-- Ensure user_devices table has correct columns for local storage sync
ALTER TABLE IF EXISTS public.user_devices 
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS password TEXT;

-- Create index for email in user_devices for lookup
CREATE INDEX IF NOT EXISTS idx_user_devices_email ON public.user_devices(email);
