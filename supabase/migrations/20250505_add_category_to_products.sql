
-- Add category column to featured_products
ALTER TABLE public.featured_products 
ADD COLUMN IF NOT EXISTS category TEXT;

COMMENT ON COLUMN public.featured_products.category IS 'The grocery category (e.g., dairy, snacks, beverages)';
