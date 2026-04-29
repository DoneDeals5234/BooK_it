import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    const { amount, userId, userEmail } = await req.json()

    if (!amount || !userId) {
      return new Response(
        JSON.stringify({ error: 'amount and userId are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')
    const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')

    console.log('💳 Creating Razorpay order for:', { amount, userId, userEmail })

    // Create order in Razorpay using REST API
    const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)
    const orderResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount: amount,
        currency: 'INR',
        receipt: `order_${userId.substring(0, 15)}_${Date.now()}`,
        notes: {
          userId: userId,
          userEmail: userEmail,
        },
      }),
    })

    const order = await orderResponse.json()

    if (!orderResponse.ok) {
      console.error('❌ Razorpay Error:', order)
      return new Response(
        JSON.stringify({ error: 'Razorpay order creation failed', details: order }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    console.log('✅ Razorpay order created:', order.id)

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Insert pending payment record
    const { data, error } = await supabase
      .from('payments')
      .insert({
        user_id: userId,
        razorpay_order_id: order.id,
        amount: amount,
        status: 'pending',
        notes: {
          userEmail: userEmail,
          createdAt: new Date().toISOString(),
        },
      })
      .select()

    if (error) {
      console.error('❌ Error inserting payment record:', error)
      // We still return the order ID so the user can pay, but log the error
    } else {
      console.log('✅ Payment record created in Supabase:', data?.[0]?.id)
    }

    return new Response(
      JSON.stringify({
        success: true,
        orderId: order.id,
        keyId: RAZORPAY_KEY_ID,
        amount: order.amount,
        paymentRecordId: data?.[0]?.id,
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
