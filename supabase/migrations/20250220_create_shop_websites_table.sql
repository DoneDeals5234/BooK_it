-- Create shop_websites table
CREATE TABLE IF NOT EXISTS public.shop_websites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id TEXT NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    shop_name TEXT NOT NULL UNIQUE,
    layout_json JSONB NOT NULL DEFAULT '{"components": []}'::jsonb,
    is_published BOOLEAN DEFAULT false,
    published_at TIMESTAMP WITH TIME ZONE,
    views_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add unique constraint on shop_id to allow only one website per shop
ALTER TABLE public.shop_websites ADD CONSTRAINT shop_websites_shop_id_key UNIQUE (shop_id);

-- Enable RLS
ALTER TABLE public.shop_websites ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Public websites are viewable by everyone" 
    ON public.shop_websites 
    FOR SELECT 
    USING (is_published = true);

CREATE POLICY "Shop owners can manage their own website"
    ON public.shop_websites
    FOR ALL
    USING (
        auth.uid()::text IN (
            SELECT user_id FROM public.shop_owners WHERE shop_id = shop_websites.shop_id::text
            UNION
            SELECT user_id FROM public.native_shop_owners WHERE shop_id = shop_websites.shop_id::text
        )
    );

-- Function to increment views
CREATE OR REPLACE FUNCTION public.increment_website_views(website_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.shop_websites
    SET views_count = views_count + 1
    WHERE id = website_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
