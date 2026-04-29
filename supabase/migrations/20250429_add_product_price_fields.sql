
-- Add original_price and discount_percentage to featured_products
ALTER TABLE public.featured_products 
ADD COLUMN IF NOT EXISTS original_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS discount_percentage INTEGER;

COMMENT ON COLUMN public.featured_products.original_price IS 'The original price before discount (strikethrough price)';
COMMENT ON COLUMN public.featured_products.discount_percentage IS 'The discount percentage to display on the product card';
