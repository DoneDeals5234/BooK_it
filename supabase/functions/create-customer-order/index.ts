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
      shopLng
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

    // Initialize Supabase client with service role key (bypasses RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Assign OTP for delivery orders
    let otpCode = null;
    if (deliveryType === 'delivery') {
      const { data: otpData } = await supabase
        .from('otps')
        .select('code');
      
      if (otpData && otpData.length > 0) {
        const randomIndex = Math.floor(Math.random() * otpData.length);
        otpCode = otpData[randomIndex].code;
      }
    }

    // 2. Insert the order
    const { data: order, error } = await supabase
      .from('orders')
      .insert([
        {
          shop_id: shopId,
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
          expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
        }
      ])
      .select()
      .single()

    if (error) {
      console.error('❌ Supabase error inserting order:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to create order', details: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // TRIGGER NOTIFICATIONS
    try {
      // 1. Notify Customer (Order Confirmation)
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification-by-userid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          user_ids: [customerId],
          title: 'Order Placed! 🛒',
          body: `Your order of ₹${amount} has been placed. Waiting for shop owner to confirm...`,
          data: { type: 'order_update', order_id: order.id }
        }),
      });

      // 2. Notify Shop Owner (The "Ringing" Alert)
      const { data: shopData } = await supabase
        .from('shops')
        .select('owner_email, name')
        .eq('id', shopId)
        .single();

      if (shopData?.owner_email) {
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('user_id')
          .eq('email', shopData.owner_email)
          .single();

        if (profileData?.user_id) {
          console.log(`🔔 Sending ringing notification to owner: ${profileData.user_id}`);
          
          // Call the send-notification-by-userid function
          await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification-by-userid`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              user_ids: [profileData.user_id],
              title: '🆕 New Order Received!',
              body: `${customerName} ordered ${productName || 'items'} for ₹${amount}.`,
              data: {
                type: 'new_order', // This triggers the OrderNotificationExtension in Android
                order_id: order.id,
                customer_name: customerName,
                amount: (totalAmount || amount).toString(),
                quantity: (quantity || 1).toString(),
                delivery_type: deliveryType || 'pickup'
              }
            }),
          });
        }
      }
    } catch (notifyError) {
      console.error('⚠️ Failed to send ringing notification to shop owner:', notifyError);
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
