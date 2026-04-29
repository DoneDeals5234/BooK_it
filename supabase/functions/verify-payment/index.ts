import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts"

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
    const { orderId, paymentId, signature, userId } = await req.json()

    if (!orderId || !paymentId || !signature || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')
    const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')

    console.log('🔐 Verifying payment signature:', { orderId, paymentId, userId })

    // Verify signature using Web Crypto API
    const secret = RAZORPAY_KEY_SECRET
    const text = orderId + '|' + paymentId
    
    // Helper to sign for Razorpay signature verification
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const data = encoder.encode(text)
    
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    )
    
    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      data
    )
    
    const hmacHex = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    const isSignatureValid = hmacHex === signature

    if (!isSignatureValid) {
      console.error('❌ Invalid signature - possible fraud attempt')
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid payment signature' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log('✅ Signature verified! Payment is authentic')

    // Fetch payment details from Razorpay
    const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)
    const paymentResponse = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    })
    
    const payment = await paymentResponse.json()

    console.log('📋 Payment details:', {
      status: payment.status,
      amount: payment.amount,
      method: payment.method,
    })

    // Determine payment status
    let paymentStatus = 'pending'
    if (payment.status === 'captured' || payment.status === 'authorized') {
      paymentStatus = 'success'
    } else if (payment.status === 'failed') {
      paymentStatus = 'failed'
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Update Supabase with payment status
    const { data: updateData, error: updateError } = await supabase
      .from('payments')
      .update({
        razorpay_payment_id: paymentId,
        status: paymentStatus,
        payment_method: payment.method,
        updated_at: new Date().toISOString(),
      })
      .eq('razorpay_order_id', orderId)
      .select()

    if (updateError) {
      console.error('❌ Error updating payment in Supabase:', updateError)
    } else {
      console.log('✅ Payment updated in Supabase:', updateData?.[0]?.id)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Payment verified successfully',
        paymentId: paymentId,
        orderId: orderId,
        status: paymentStatus,
        amount: payment.amount,
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
