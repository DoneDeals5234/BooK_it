-- Enable RLS on booking_requests table
ALTER TABLE booking_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Customers can view their own booking requests
CREATE POLICY "Customers can view own booking requests" ON booking_requests
FOR SELECT USING (user_id = auth.uid()::text);

-- Policy: Shop owners can view booking requests for their shop
CREATE POLICY "Shop owners can view requests for their shop" ON booking_requests
FOR SELECT USING (shop_id = auth.uid()::text);

-- Policy: Customers can create booking requests
CREATE POLICY "Customers can create booking requests" ON booking_requests
FOR INSERT WITH CHECK (user_id = auth.uid()::text);

-- Policy: Shop owners can update requests for their shop
CREATE POLICY "Shop owners can update requests for their shop" ON booking_requests
FOR UPDATE USING (shop_id = auth.uid()::text) WITH CHECK (shop_id = auth.uid()::text);

-- Policy: Customers can cancel their own requests
CREATE POLICY "Customers can cancel own requests" ON booking_requests
FOR UPDATE USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text AND status IN ('pending_owner_response', 'counter_offered', 'pending_customer_response'));

-- Enable RLS on booking_negotiations table
ALTER TABLE booking_negotiations ENABLE ROW LEVEL SECURITY;

-- Policy: Customers can view negotiations for their requests
CREATE POLICY "Customers can view own negotiations" ON booking_negotiations
FOR SELECT USING (
  booking_request_id IN (
    SELECT id FROM booking_requests WHERE user_id = auth.uid()::text
  )
);

-- Policy: Shop owners can view negotiations for their requests
CREATE POLICY "Shop owners can view negotiations for their shop" ON booking_negotiations
FOR SELECT USING (
  booking_request_id IN (
    SELECT id FROM booking_requests WHERE shop_id = auth.uid()::text
  )
);

-- Policy: Shop owners can create negotiations (counter-offers)
CREATE POLICY "Shop owners can create negotiations" ON booking_negotiations
FOR INSERT WITH CHECK (
  booking_request_id IN (
    SELECT id FROM booking_requests WHERE shop_id = auth.uid()::text
  )
  AND offered_by = 'owner'
);

-- Policy: Customers can update negotiations (respond to counter-offers)
CREATE POLICY "Customers can respond to negotiations" ON booking_negotiations
FOR UPDATE USING (
  booking_request_id IN (
    SELECT id FROM booking_requests WHERE user_id = auth.uid()::text
  )
);
