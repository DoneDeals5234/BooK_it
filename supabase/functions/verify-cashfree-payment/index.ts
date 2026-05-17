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
    const { orderId } = await req.json()

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'Missing orderId' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const CASHFREE_APP_ID = Deno.env.get('CASHFREE_APP_ID');
    const CASHFREE_SECRET_KEY = Deno.env.get('CASHFREE_SECRET_KEY');
    const CASHFREE_ENVIRONMENT = Deno.env.get('CASHFREE_ENVIRONMENT') || 'PRODUCTION';

    const baseUrl = CASHFREE_ENVIRONMENT === 'PRODUCTION' 
        ? 'https://api.cashfree.com/pg' 
        : 'https://sandbox.cashfree.com/pg';

    console.log('🔐 Verifying Cashfree payment for order:', orderId)

    // Verify order status directly from Cashfree API
    const orderResponse = await fetch(`${baseUrl}/orders/${orderId}`, {
      headers: {
        'x-api-version': '2023-08-01',
        'x-client-id': CASHFREE_APP_ID || '',
        'x-client-secret': CASHFREE_SECRET_KEY || '',
      },
    })
    
    const orderDetails = await orderResponse.json()

    console.log('📋 Cashfree Payment details:', {
      order_status: orderDetails.order_status,
      amount: orderDetails.order_amount,
    })

    // Determine payment status
    let paymentStatus = 'pending'
    if (orderDetails.order_status === 'PAID') {
      paymentStatus = 'success'
    } else if (orderDetails.order_status === 'FAILED' || orderDetails.order_status === 'DROPPED') {
      paymentStatus = 'failed'
    } else if (orderDetails.order_status === 'ACTIVE') {
      // Meaning payment was initiated but not completed
      return new Response(
        JSON.stringify({ success: false, error: 'Payment is not yet completed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (paymentStatus === 'failed') {
      return new Response(
        JSON.stringify({ success: false, error: 'Payment failed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log('✅ Cashfree Payment verified as SUCCESS!')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Payment verified successfully',
        orderId: orderId,
        status: paymentStatus,
        amount: orderDetails.order_amount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('❌ Error verifying payment:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
