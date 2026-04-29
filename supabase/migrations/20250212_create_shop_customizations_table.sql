-- Create shop_customizations table
CREATE TABLE IF NOT EXISTS public.shop_customizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id TEXT NOT NULL UNIQUE,
  background_color TEXT DEFAULT '#ffffff',
  primary_color TEXT DEFAULT '#3b82f6',
  text_color TEXT DEFAULT '#1f2937',
  border_radius TEXT DEFAULT 'md', -- none, sm, md, lg, full
  layout_style TEXT DEFAULT 'spacious', -- compact, spacious, card-grid
  card_style TEXT DEFAULT 'elevated', -- flat, elevated, outlined
  show_team BOOLEAN DEFAULT true,
  show_about BOOLEAN DEFAULT true,
  show_chats BOOLEAN DEFAULT true,
  show_reviews BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for shop_id lookup
CREATE INDEX idx_shop_customizations_shop_id 
ON public.shop_customizations(shop_id);

-- Enable RLS on shop_customizations table
ALTER TABLE public.shop_customizations ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read customizations (public read)
CREATE POLICY "Anyone can view shop customizations"
  ON public.shop_customizations
  FOR SELECT
  TO public
  USING (true);

-- Policy: Only shop owners can update their own customizations
CREATE POLICY "Shop owners can update their customizations"
  ON public.shop_customizations
  FOR UPDATE
  TO authenticated
  USING (
    shop_id IN (
      SELECT id FROM shops
      WHERE owner_email = auth.email()
    )
  )
  WITH CHECK (
    shop_id IN (
      SELECT id FROM shops
      WHERE owner_email = auth.email()
    )
  );

-- Policy: Only shop owners can insert customizations
CREATE POLICY "Shop owners can create customizations"
  ON public.shop_customizations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    shop_id IN (
      SELECT id FROM shops
      WHERE owner_email = auth.email()
    )
  );

-- Policy: Only shop owners can delete their customizations
CREATE POLICY "Shop owners can delete their customizations"
  ON public.shop_customizations
  FOR DELETE
  TO authenticated
  USING (
    shop_id IN (
      SELECT id FROM shops
      WHERE owner_email = auth.email()
    )
  );
