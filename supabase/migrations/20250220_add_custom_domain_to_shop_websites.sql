-- Add custom_domain column to shop_websites
ALTER TABLE public.shop_websites ADD COLUMN IF NOT EXISTS custom_domain TEXT;
CREATE INDEX IF NOT EXISTS idx_shop_websites_custom_domain ON public.shop_websites(custom_domain);
