-- Drop table if exists to recreate
DROP TABLE IF EXISTS public.user_messages CASCADE;

-- Create user_messages table
CREATE TABLE IF NOT EXISTS public.user_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL, -- Changed from UUID to TEXT to support Firebase UIDs
    sender_name TEXT NOT NULL,
    sender_email TEXT NOT NULL,
    sender_phone TEXT,
    message TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'thought', -- 'thought', 'feedback', 'support'
    admin_reply TEXT,
    admin_reply_by TEXT, -- Stores email or name of the staff who replied
    is_read BOOLEAN DEFAULT false,
    reply_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_messages ENABLE ROW LEVEL SECURITY;

-- Temporary permissive policies to ensure it works regardless of auth state
-- These can be tightened once basic functionality is confirmed
CREATE POLICY "Enable read access for all" ON public.user_messages
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all" ON public.user_messages
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all" ON public.user_messages
    FOR UPDATE USING (true);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_messages_user_id ON public.user_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_user_messages_is_read ON public.user_messages(is_read);
CREATE INDEX IF NOT EXISTS idx_user_messages_created_at ON public.user_messages(created_at DESC);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_messages_user_id ON public.user_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_user_messages_is_read ON public.user_messages(is_read);
CREATE INDEX IF NOT EXISTS idx_user_messages_created_at ON public.user_messages(created_at DESC);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_messages_user_id ON public.user_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_user_messages_is_read ON public.user_messages(is_read);
CREATE INDEX IF NOT EXISTS idx_user_messages_created_at ON public.user_messages(created_at DESC);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_messages_user_id ON public.user_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_user_messages_is_read ON public.user_messages(is_read);
CREATE INDEX IF NOT EXISTS idx_user_messages_created_at ON public.user_messages(created_at DESC);
