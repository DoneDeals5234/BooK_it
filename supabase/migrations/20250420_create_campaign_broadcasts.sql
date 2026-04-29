-- Create campaign_broadcasts table for Realtime notification triggers
-- Corrected: shop_id is TEXT to match the shops table schema
CREATE TABLE IF NOT EXISTS public.campaign_broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    shop_id TEXT NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    image_url TEXT,
    target JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.campaign_broadcasts ENABLE ROW LEVEL SECURITY;

-- Allow users to read broadcasts (they will filter by location in the frontend)
CREATE POLICY "Anyone can read campaign broadcasts" 
ON public.campaign_broadcasts FOR SELECT 
USING (true);

-- Allow service role to manage broadcasts
CREATE POLICY "Service role can manage broadcasts" 
ON public.campaign_broadcasts FOR ALL 
USING (auth.jwt()->>'role' = 'service_role');

-- Enable Realtime for this table
-- Use safety check to avoid error if already exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'campaign_broadcasts'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_broadcasts;
    END IF;
END $$;
