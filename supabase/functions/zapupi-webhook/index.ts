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
    const payload = await req.json();

    const {
      order_id,
      txn_id,
      status,
      amount,
      pay_amount,
      utr,
      customer_mobile,
      remark,
      remark_array,
      environment
    } = payload;

    if (!order_id) {
      return new Response(JSON.stringify({ error: "Missing order_id" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`Received ZapUPI Webhook for order: ${order_id} | Status: ${status}`);

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Upsert into zapupi_payments table
    const { data, error } = await supabase
      .from('zapupi_payments')
      .upsert({
        order_id,
        txn_id,
        status,
        amount: parseFloat(amount || "0"),
        pay_amount: pay_amount ? parseFloat(pay_amount) : null,
        utr,
        customer_mobile,
        remark,
        remark_array,
        environment,
        updated_at: new Date().toISOString()
      }, { onConflict: 'order_id' })
      .select();

    if (error) {
      console.error('❌ Error updating payment in Supabase:', error);
      throw error;
    }

    console.log('✅ Successfully tracked ZapUPI payment:', order_id);

    // Endpoint must respond with HTTP 200 within 10 seconds for successful delivery
    return new Response(
      JSON.stringify({ success: true }), 
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})
