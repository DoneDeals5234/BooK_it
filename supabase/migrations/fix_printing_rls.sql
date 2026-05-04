-- Fix RLS policies for shop_printing_settings to allow UPSERT
DROP POLICY IF EXISTS "Shop owners can manage their printing settings" ON public.shop_printing_settings;

CREATE POLICY "Shop owners can manage their printing settings"
  ON public.shop_printing_settings FOR ALL
  TO authenticated
  USING (
    shop_id IN (
      SELECT id FROM shops WHERE owner_email = auth.email()
    )
  )
  WITH CHECK (
    shop_id IN (
      SELECT id FROM shops WHERE owner_email = auth.email()
    )
  );

-- Also ensure shop owners can manage their own printing orders
DROP POLICY IF EXISTS "Shop owners can view printing orders for their shops" ON public.printing_orders;

CREATE POLICY "Shop owners can manage printing orders for their shops"
  ON public.printing_orders FOR ALL
  TO authenticated
  USING (
    order_id IN (
      SELECT id FROM orders WHERE shop_id IN (
        SELECT id FROM shops WHERE owner_email = auth.email()
      )
    )
  );
