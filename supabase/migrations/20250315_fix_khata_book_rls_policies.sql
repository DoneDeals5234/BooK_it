-- Fix RLS policies for khata_book_customers table
DROP POLICY IF EXISTS "Shop owners can view their khata book customers" ON khata_book_customers;
DROP POLICY IF EXISTS "Shop owners can insert khata book customers" ON khata_book_customers;
DROP POLICY IF EXISTS "Shop owners can update their khata book customers" ON khata_book_customers;
DROP POLICY IF EXISTS "Shop owners can delete their khata book customers" ON khata_book_customers;

-- Create corrected RLS policies for khata_book_customers
CREATE POLICY "Shop owners can view their khata book customers"
  ON khata_book_customers FOR SELECT
  USING (
    auth.uid()::text IN (
      SELECT user_id FROM public.shop_owners WHERE shop_id = khata_book_customers.shop_id::text
      UNION
      SELECT user_id FROM public.native_shop_owners WHERE shop_id = khata_book_customers.shop_id::text
    )
  );

CREATE POLICY "Shop owners can insert khata book customers"
  ON khata_book_customers FOR INSERT
  WITH CHECK (
    auth.uid()::text IN (
      SELECT user_id FROM public.shop_owners WHERE shop_id = khata_book_customers.shop_id::text
      UNION
      SELECT user_id FROM public.native_shop_owners WHERE shop_id = khata_book_customers.shop_id::text
    )
  );

CREATE POLICY "Shop owners can update their khata book customers"
  ON khata_book_customers FOR UPDATE
  USING (
    auth.uid()::text IN (
      SELECT user_id FROM public.shop_owners WHERE shop_id = khata_book_customers.shop_id::text
      UNION
      SELECT user_id FROM public.native_shop_owners WHERE shop_id = khata_book_customers.shop_id::text
    )
  )
  WITH CHECK (
    auth.uid()::text IN (
      SELECT user_id FROM public.shop_owners WHERE shop_id = khata_book_customers.shop_id::text
      UNION
      SELECT user_id FROM public.native_shop_owners WHERE shop_id = khata_book_customers.shop_id::text
    )
  );

CREATE POLICY "Shop owners can delete their khata book customers"
  ON khata_book_customers FOR DELETE
  USING (
    auth.uid()::text IN (
      SELECT user_id FROM public.shop_owners WHERE shop_id = khata_book_customers.shop_id::text
      UNION
      SELECT user_id FROM public.native_shop_owners WHERE shop_id = khata_book_customers.shop_id::text
    )
  );

-- Fix RLS policies for khata_book_payments table
DROP POLICY IF EXISTS "Shop owners can view their khata book payments" ON khata_book_payments;
DROP POLICY IF EXISTS "Shop owners can insert khata book payments" ON khata_book_payments;
DROP POLICY IF EXISTS "Shop owners can update their khata book payments" ON khata_book_payments;

CREATE POLICY "Shop owners can view their khata book payments"
  ON khata_book_payments FOR SELECT
  USING (
    auth.uid()::text IN (
      SELECT user_id FROM public.shop_owners WHERE shop_id = khata_book_payments.shop_id::text
      UNION
      SELECT user_id FROM public.native_shop_owners WHERE shop_id = khata_book_payments.shop_id::text
    )
  );

CREATE POLICY "Shop owners can insert khata book payments"
  ON khata_book_payments FOR INSERT
  WITH CHECK (
    auth.uid()::text IN (
      SELECT user_id FROM public.shop_owners WHERE shop_id = khata_book_payments.shop_id::text
      UNION
      SELECT user_id FROM public.native_shop_owners WHERE shop_id = khata_book_payments.shop_id::text
    )
  );

CREATE POLICY "Shop owners can update their khata book payments"
  ON khata_book_payments FOR UPDATE
  USING (
    auth.uid()::text IN (
      SELECT user_id FROM public.shop_owners WHERE shop_id = khata_book_payments.shop_id::text
      UNION
      SELECT user_id FROM public.native_shop_owners WHERE shop_id = khata_book_payments.shop_id::text
    )
  )
  WITH CHECK (
    auth.uid()::text IN (
      SELECT user_id FROM public.shop_owners WHERE shop_id = khata_book_payments.shop_id::text
      UNION
      SELECT user_id FROM public.native_shop_owners WHERE shop_id = khata_book_payments.shop_id::text
    )
  );
