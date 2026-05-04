-- Allow staff (anon) to update book_it_status
DROP POLICY IF EXISTS "Allow book_it_status update by staff" ON public.orders;

CREATE POLICY "Allow book_it_status update by staff"
  ON public.orders
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Allow staff (anon) to read orders
DROP POLICY IF EXISTS "Allow anon read orders for staff" ON public.orders;

CREATE POLICY "Allow anon read orders for staff"
  ON public.orders
  FOR SELECT
  USING (true);

-- RELOAD SCHEMA CACHE (Fix for PGRST204 error)
NOTIFY pgrst, 'reload schema';
