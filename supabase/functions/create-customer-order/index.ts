import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      shopId,
      customerId,
      customerName,
      customerPhone,
      amount,
      description,
      quantity,
      address,
      locationLink,
      productName,
      productImage,
      unitPrice,
      deliveryType,
      deliveryCost,
      totalAmount,
      distance,
      customerLat,
      customerLng,
      shopLat,
      shopLng,
      houseNo,
      landmark
    } = await req.json()

    // Validate required fields
    if (!shopId || !customerId || !customerName || !customerPhone || !amount) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: shopId, customerId, customerName, customerPhone, amount'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseKey) {
      console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Server configuration error', 
          details: 'SUPABASE_SERVICE_ROLE_KEY is not set on the server.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Initialize Supabase client with service role key (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Generate 6-digit numerical order code for verification/display
    const orderCode = Math.floor(100000 + Math.random() * 900000).toString();

    // 2. Assign OTP for delivery orders (ensure it matches orderCode)
    const otpCode = orderCode;

    // 3. Fetch shop data for notification and snapshot
    const { data: shopData } = await supabase
      .from('shops')
      .select('owner_email, name')
      .eq('id', shopId)
      .single();

    // 4. Insert the order
    const { data: order, error } = await supabase
      .from('orders')
      .insert([
        {
          shop_id: shopId,
          shop_name: shopData?.name || 'Shop',
          customer_id: customerId,
          customer_name: customerName,
          customer_phone: customerPhone,
          order_amount: amount,
          order_description: description,
          status: 'pending',
          delivery_type: deliveryType || 'pickup',
          quantity: quantity || 1,
          customer_address: address,
          location_link: locationLink,
          product_name: productName,
          product_image: productImage,
          unit_price: unitPrice,
          delivery_cost: deliveryCost || 0,
          total_amount: totalAmount || amount,
          distance: distance || 0,
          customer_lat: customerLat,
          customer_lng: customerLng,
          shop_lat: shopLat,
          shop_lng: shopLng,
          otp_code: otpCode,
          order_code: orderCode,
          house_no: houseNo,
          landmark: landmark,
          expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
        }
      ])
      .select()
      .single()

    if (error) {
      console.error('❌ Supabase error inserting order:', JSON.stringify(error, null, 2))
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to create order',
          details: error.message,
          code: error.code,
          hint: error.hint
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // TRIGGER NOTIFICATIONS
    try {
      // 1. Notify Customer (Order Confirmation)
      const customerNotifRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-native-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          userIds: [customerId],
          title: '🛒 Order Placed Successfully!',
          body: `Your order for ₹${totalAmount || amount} from ${shopData?.name || 'the shop'} has been placed. Waiting for confirmation...`,
          data: { type: 'order_placed', order_id: order.id, order_code: orderCode }
        }),
      });
      console.log(`📱 Customer notification status: ${customerNotifRes.status}`);

      // 2. Notify Shop Owner — try shop_owners table first (most reliable)
      let ownerUserIds: string[] = [];

      // Method A: shop_owners table (preferred)
      const { data: shopOwners } = await supabase
        .from('shop_owners')
        .select('user_id')
        .eq('shop_id', shopId);

      if (shopOwners && shopOwners.length > 0) {
        ownerUserIds = shopOwners.map((o: any) => o.user_id).filter(Boolean);
        console.log(`✅ Found ${ownerUserIds.length} owner(s) via shop_owners table`);
      }

      // Method B: fallback — user_profiles by email
      if (ownerUserIds.length === 0 && shopData?.owner_email) {
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('user_id')
          .eq('email', shopData.owner_email)
          .single();

        if (profileData?.user_id) {
          ownerUserIds = [profileData.user_id];
          console.log(`✅ Found owner via user_profiles fallback: ${profileData.user_id}`);
        }
      }

      if (ownerUserIds.length > 0) {
        console.log(`🔔 Sending NEW ORDER notification to ${ownerUserIds.length} owner(s)...`);
        const ownerNotifRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-native-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            userIds: ownerUserIds,
            title: '🆕 New Order Received!',
            body: `${customerName} ordered ${productName || 'items'} — ₹${totalAmount || amount}. Tap to confirm.`,
            data: {
              type: 'new_order',
              order_id: order.id,
              customer_name: customerName,
              amount: (totalAmount || amount).toString(),
              quantity: (quantity || 1).toString(),
              delivery_type: deliveryType || 'pickup',
              order_code: orderCode
            }
          }),
        });
        const ownerNotifText = await ownerNotifRes.text();
        console.log(`📩 Owner notification result: ${ownerNotifRes.status} — ${ownerNotifText}`);
      } else {
        console.warn(`⚠️ No owner user IDs found for shop ${shopId}. Owner notification skipped.`);
      }
    } catch (notifyError) {
      console.error('⚠️ Notification error (non-fatal):', notifyError);
    }

    return new Response(
      JSON.stringify({ success: true, order }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('❌ Error in Edge Function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
