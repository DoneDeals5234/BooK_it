DO $$ 
DECLARE
  pol RECORD;
BEGIN
  -- Drop foreign keys if they exist
  ALTER TABLE IF EXISTS public.cart_items DROP CONSTRAINT IF EXISTS cart_items_user_id_fkey;
  ALTER TABLE IF EXISTS public.product_reviews DROP CONSTRAINT IF EXISTS product_reviews_user_id_fkey;

  -- Drop all policies on cart_items to free up the user_id column
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'cart_items' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.cart_items', pol.policyname);
  END LOOP;

  -- Drop all policies on product_reviews to free up the user_id column
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'product_reviews' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.product_reviews', pol.policyname);
  END LOOP;
END $$;

-- Now that policies and constraints are cleared, alter the columns to text for Firebase UIDs
ALTER TABLE public.cart_items ALTER COLUMN user_id TYPE text;
ALTER TABLE public.product_reviews ALTER COLUMN user_id TYPE text;

-- Recreate basic permissive policies so your app continues to work with Firebase Auth
CREATE POLICY "Enable all operations for cart_items" ON public.cart_items FOR ALL USING (true);
CREATE POLICY "Enable all operations for product_reviews" ON public.product_reviews FOR ALL USING (true);
