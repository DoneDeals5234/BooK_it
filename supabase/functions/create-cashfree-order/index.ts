import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept, x-requested-with',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { amount, userEmail, userPhone, userId, customerName } = await req.json()

    if (!amount || !userEmail) {
      return new Response(
        JSON.stringify({ error: 'amount and userEmail are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const CASHFREE_APP_ID = Deno.env.get('CASHFREE_APP_ID');
    const CASHFREE_SECRET_KEY = Deno.env.get('CASHFREE_SECRET_KEY');
    // Use SANDBOX for testing, PRODUCTION for live
    const CASHFREE_ENVIRONMENT = Deno.env.get('CASHFREE_ENVIRONMENT') || 'PRODUCTION';

    const baseUrl = CASHFREE_ENVIRONMENT === 'PRODUCTION' 
        ? 'https://api.cashfree.com/pg' 
        : 'https://sandbox.cashfree.com/pg';

    const orderId = `order_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    console.log('💳 Creating Cashfree order for:', { orderId, amount, userEmail })

    // Format amount properly (Cashfree expects standard format e.g. 99.00 not paise)
    // If your frontend sends paise (e.g. 9900 for 99 Rs), divide by 100
    // Assuming frontend sends paise based on PLAN_DETAILS
    const orderAmount = (amount / 100).toFixed(2);

    const payload = {
      order_amount: parseFloat(orderAmount),
      order_currency: "INR",
      order_id: orderId,
      customer_details: {
        customer_id: userId || `cust_${Date.now()}`,
        customer_phone: userPhone || "9999999999",
        customer_name: customerName || "Shop Owner",
        customer_email: userEmail
      },
      order_meta: {
        // You can put a return URL if you want full page redirect, but we'll use modal
        return_url: "https://your-website.com/payment/status?order_id={order_id}"
      }
    };

    const orderResponse = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-version': '2023-08-01',
        'x-client-id': CASHFREE_APP_ID || '',
        'x-client-secret': CASHFREE_SECRET_KEY || '',
      },
      body: JSON.stringify(payload),
    });

    const order = await orderResponse.json();

    if (!orderResponse.ok) {
      console.error('❌ Cashfree Error:', order)
      return new Response(
        JSON.stringify({ error: 'Cashfree order creation failed', details: order }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    console.log('✅ Cashfree order created:', order.order_id)

    return new Response(
      JSON.stringify({
        success: true,
        orderId: order.order_id,
        paymentSessionId: order.payment_session_id,
        amount: order.order_amount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('❌ Error creating order:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
