-- 1. Create a table for campaigns that should be broadcasted to everyone
CREATE TABLE IF NOT EXISTS public.campaign_broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    image_url TEXT,
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    target JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Enable Realtime for this table
-- Use the specific publication for realtime
BEGIN;
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND tablename = 'campaign_broadcasts'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_broadcasts;
    END IF;
  END $$;
COMMIT;

-- 3. Set up Row Level Security (RLS)
ALTER TABLE public.campaign_broadcasts ENABLE ROW LEVEL SECURITY;

-- 4. Allow authenticated users to read notifications (needed for Realtime)
CREATE POLICY "Allow authenticated users to read broadcasts" 
ON public.campaign_broadcasts FOR SELECT 
USING (true); -- Everyone should be able to hear a broadcast

-- 5. Only service role or authorized senders can insert (Edge Function handles this)
-- No public INSERT allowed
