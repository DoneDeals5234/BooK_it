-- Create shop_printing_settings table
CREATE TABLE IF NOT EXISTS public.shop_printing_settings (
  shop_id TEXT PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT false,
  price_bw_single DECIMAL(10, 2) DEFAULT 2.00,
  price_bw_double DECIMAL(10, 2) DEFAULT 3.00,
  is_color_available BOOLEAN DEFAULT false,
  price_color_single DECIMAL(10, 2) DEFAULT 10.00,
  price_color_double DECIMAL(10, 2) DEFAULT 15.00,
  paper_types TEXT[] DEFAULT ARRAY['A4 Standard'],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add show_printing to shop_customizations
ALTER TABLE public.shop_customizations ADD COLUMN IF NOT EXISTS show_printing BOOLEAN DEFAULT false;

-- Create printing_orders table to store document details linked to a main order
CREATE TABLE IF NOT EXISTS public.printing_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  document_url TEXT NOT NULL,
  paper_type TEXT NOT NULL,
  is_double_sided BOOLEAN DEFAULT false,
  is_color BOOLEAN DEFAULT false,
  customer_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.shop_printing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.printing_orders ENABLE ROW LEVEL SECURITY;

-- Policies for shop_printing_settings
CREATE POLICY "Anyone can view shop printing settings"
  ON public.shop_printing_settings FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Shop owners can manage their printing settings"
  ON public.shop_printing_settings FOR ALL
  TO authenticated
  USING (
    shop_id IN (
      SELECT id FROM shops WHERE owner_email = auth.email()
    )
  );

-- Policies for printing_orders
CREATE POLICY "Customers can view their own printing orders"
  ON public.printing_orders FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT id FROM orders WHERE customer_id = auth.uid()
    )
  );

CREATE POLICY "Shop owners can view printing orders for their shops"
  ON public.printing_orders FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT id FROM orders WHERE shop_id IN (
        SELECT id FROM shops WHERE owner_email = auth.email()
      )
    )
  );

CREATE POLICY "Anyone can create a printing order"
  ON public.printing_orders FOR INSERT
  TO public
  WITH CHECK (true);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_printing_orders_order_id ON public.printing_orders(order_id);
