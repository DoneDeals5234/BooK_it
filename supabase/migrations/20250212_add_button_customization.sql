-- Add button customization columns to shop_customizations table
ALTER TABLE public.shop_customizations ADD COLUMN IF NOT EXISTS button_shape TEXT DEFAULT 'rounded'; -- square, rounded, pill
ALTER TABLE public.shop_customizations ADD COLUMN IF NOT EXISTS button_color TEXT DEFAULT '#3b82f6';
ALTER TABLE public.shop_customizations ADD COLUMN IF NOT EXISTS button_text_color TEXT DEFAULT '#ffffff';
ALTER TABLE public.shop_customizations ADD COLUMN IF NOT EXISTS button_size TEXT DEFAULT 'md'; -- sm, md, lg
ALTER TABLE public.shop_customizations ADD COLUMN IF NOT EXISTS button_position TEXT DEFAULT 'bottom'; -- top, bottom, floating
ALTER TABLE public.shop_customizations ADD COLUMN IF NOT EXISTS last_updated BIGINT;

-- Create index for last_updated for sorting recent customizations
CREATE INDEX IF NOT EXISTS idx_shop_customizations_updated 
ON public.shop_customizations(last_updated DESC);

-- Add helpful comments
COMMENT ON COLUMN public.shop_customizations.button_shape IS 'Button shape: square, rounded, or pill (full round)';
COMMENT ON COLUMN public.shop_customizations.button_color IS 'Button background color in hex format (e.g., #3b82f6)';
COMMENT ON COLUMN public.shop_customizations.button_text_color IS 'Button text color in hex format (e.g., #ffffff)';
COMMENT ON COLUMN public.shop_customizations.button_size IS 'Button size: sm (small), md (medium), or lg (large)';
COMMENT ON COLUMN public.shop_customizations.button_position IS 'Button position on page: top, bottom, or floating (fixed position)';
COMMENT ON COLUMN public.shop_customizations.last_updated IS 'Timestamp when customization was last updated (milliseconds since epoch)';
