-- Update order status to include 'delivered'
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'order_status' AND e.enumlabel = 'delivered') THEN
        ALTER TYPE order_status ADD VALUE 'delivered';
    END IF;
EXCEPTION
    WHEN undefined_object THEN
        -- If status is just text, do nothing or handle accordingly
        NULL;
END $$;

-- Create or update user_devices table for unified tracking
DO $$ 
BEGIN
    CREATE TABLE IF NOT EXISTS public.user_devices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        email TEXT,
        password TEXT,
        player_id TEXT,
        device_info JSONB DEFAULT '{}'::jsonb,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
    );
EXCEPTION
    WHEN others THEN
        NULL;
END $$;

-- Ensure user_id is TEXT if table exists (to accommodate Firebase UIDs)
DO $$ 
BEGIN
    -- Drop policies first to allow type checks/changes if needed
    DROP POLICY IF EXISTS "Users can read their own device records" ON public.user_devices;
    DROP POLICY IF EXISTS "Users can insert their own device records" ON public.user_devices;
    DROP POLICY IF EXISTS "Users can update their own device records" ON public.user_devices;
    DROP POLICY IF EXISTS "Users can view their own devices" ON public.user_devices;
    DROP POLICY IF EXISTS "Users can insert their own devices" ON public.user_devices;
    DROP POLICY IF EXISTS "Users can update their own devices" ON public.user_devices;
    DROP POLICY IF EXISTS "Users can delete their own devices" ON public.user_devices;

    -- We ensure it's TEXT because the error showed values like Firebase UIDs which aren't UUIDs
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_devices' 
        AND column_name = 'user_id' 
        AND data_type = 'uuid'
    ) THEN
        ALTER TABLE public.user_devices ALTER COLUMN user_id TYPE TEXT USING user_id::text;
    END IF;
END $$;

-- Ensure columns exist if table was already there
ALTER TABLE public.user_devices ADD COLUMN IF NOT EXISTS device_info JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.user_devices ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.user_devices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.user_devices ADD COLUMN IF NOT EXISTS player_id TEXT;
ALTER TABLE public.user_devices ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.user_devices ADD COLUMN IF NOT EXISTS password TEXT;

-- Index for fast lookup by user_id
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON public.user_devices(user_id);

-- Enable RLS
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own devices"
    ON public.user_devices FOR SELECT
    USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own devices"
    ON public.user_devices FOR INSERT
    WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own devices"
    ON public.user_devices FOR UPDATE
    USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete their own devices"
    ON public.user_devices FOR DELETE
    USING (auth.uid()::text = user_id::text);
