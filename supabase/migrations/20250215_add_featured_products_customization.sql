-- Add missing show_featured_products column to shop_customizations table
ALTER TABLE public.shop_customizations ADD COLUMN IF NOT EXISTS show_featured_products BOOLEAN DEFAULT true;

-- Update existing rows to have the default value
UPDATE public.shop_customizations SET show_featured_products = true WHERE show_featured_products IS NULL;

-- Add a comment for documentation
COMMENT ON COLUMN public.shop_customizations.show_featured_products IS 'Whether to show the featured products section on the shop view page';
