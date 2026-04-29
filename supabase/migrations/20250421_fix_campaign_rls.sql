-- Fix RLS policies for campaigns table
-- The original policies were comparing shop_id (numeric string) directly to User ID (UUID string)
-- which resulted in no data being visible to shop owners.

-- 1. Drop existing policies
DROP POLICY IF EXISTS "Users can create campaigns for their shops" ON public.campaigns;
DROP POLICY IF EXISTS "Users can read their own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can update their own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can delete their own campaigns" ON public.campaigns;

-- 2. Create updated policies for 'campaigns'
CREATE POLICY "Users can create campaigns for their shops"
ON public.campaigns FOR INSERT
WITH CHECK (
  shop_id IN (SELECT shop_id FROM public.shop_owners WHERE user_id = auth.uid()::text) OR
  shop_id IN (SELECT shop_id FROM public.native_shop_owners WHERE user_id = auth.uid()::text)
);

CREATE POLICY "Users can read their own campaigns"
ON public.campaigns FOR SELECT
USING (
  shop_id IN (SELECT shop_id FROM public.shop_owners WHERE user_id = auth.uid()::text) OR
  shop_id IN (SELECT shop_id FROM public.native_shop_owners WHERE user_id = auth.uid()::text)
);

CREATE POLICY "Users can update their own campaigns"
ON public.campaigns FOR UPDATE
USING (
  shop_id IN (SELECT shop_id FROM public.shop_owners WHERE user_id = auth.uid()::text) OR
  shop_id IN (SELECT shop_id FROM public.native_shop_owners WHERE user_id = auth.uid()::text)
)
WITH CHECK (
  shop_id IN (SELECT shop_id FROM public.shop_owners WHERE user_id = auth.uid()::text) OR
  shop_id IN (SELECT shop_id FROM public.native_shop_owners WHERE user_id = auth.uid()::text)
);

CREATE POLICY "Users can delete their own campaigns"
ON public.campaigns FOR DELETE
USING (
  shop_id IN (SELECT shop_id FROM public.shop_owners WHERE user_id = auth.uid()::text) OR
  shop_id IN (SELECT shop_id FROM public.native_shop_owners WHERE user_id = auth.uid()::text)
);

-- 3. Fix policies for 'campaign_targets'
DROP POLICY IF EXISTS "Users can manage campaign targets" ON public.campaign_targets;
CREATE POLICY "Users can manage campaign targets"
ON public.campaign_targets FOR ALL
USING (
  campaign_id IN (
    SELECT id FROM public.campaigns 
    WHERE 
      shop_id IN (SELECT shop_id FROM public.shop_owners WHERE user_id = auth.uid()::text) OR
      shop_id IN (SELECT shop_id FROM public.native_shop_owners WHERE user_id = auth.uid()::text)
  )
);

-- 4. Fix policies for 'campaign_logs'
DROP POLICY IF EXISTS "Users can view their campaign logs" ON public.campaign_logs;
CREATE POLICY "Users can view their campaign logs"
ON public.campaign_logs FOR SELECT
USING (
  campaign_id IN (
    SELECT id FROM public.campaigns 
    WHERE 
      shop_id IN (SELECT shop_id FROM public.shop_owners WHERE user_id = auth.uid()::text) OR
      shop_id IN (SELECT shop_id FROM public.native_shop_owners WHERE user_id = auth.uid()::text)
  )
);

-- 5. Fix policies for 'campaign_analytics'
DROP POLICY IF EXISTS "Users can view their campaign analytics" ON public.campaign_analytics;
CREATE POLICY "Users can view their campaign analytics"
ON public.campaign_analytics FOR SELECT
USING (
  campaign_id IN (
    SELECT id FROM public.campaigns 
    WHERE 
      shop_id IN (SELECT shop_id FROM public.shop_owners WHERE user_id = auth.uid()::text) OR
      shop_id IN (SELECT shop_id FROM public.native_shop_owners WHERE user_id = auth.uid()::text)
  )
);
