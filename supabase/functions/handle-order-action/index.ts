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
    const { orderId, action, rejectionNotes } = await req.json()

    if (!orderId || !action) {
      return new Response(
        JSON.stringify({ error: 'Missing orderId or action' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log(`📦 Processing order action: ${action} for order: ${orderId}`);

    // Update order status
    const status = action === 'accept' ? 'accepted' : 'rejected';
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (action === 'accept') {
      updateData.accepted_at = new Date().toISOString();
    } else {
      updateData.rejected_at = new Date().toISOString();
      updateData.rejection_notes = rejectionNotes || 'Order declined by shop owner.';
    }

    const { data: order, error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .select('customer_id, order_amount, shop_id')
      .single();

    if (updateError) {
      console.error('❌ Error updating order:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update order', details: updateError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Get Shop Name for notification
    const { data: shopData } = await supabase
      .from('shops')
      .select('name')
      .eq('id', order.shop_id)
      .single();

    const shopName = shopData?.name || 'the shop';

    // Notify Customer
    try {
      console.log(`🔔 Notifying customer: ${order.customer_id} about ${action}`);
      
      const title = action === 'accept' ? 'Order Accepted! ✅' : 'Order Rejected ❌';
      const body = action === 'accept' 
        ? `Your order of ₹${order.order_amount} has been accepted by ${shopName}. Get ready to collect it!`
        : `Your order of ₹${order.order_amount} has been declined. ${rejectionNotes || 'Please try again later.'}`;

      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification-by-userid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          user_ids: [order.customer_id],
          title,
          body,
          data: { 
            type: 'order_update', 
            order_id: orderId,
            status
          }
        }),
      });
    } catch (notifyError) {
      console.error('⚠️ Failed to notify customer about order action:', notifyError);
    }

    return new Response(
      JSON.stringify({ success: true, status }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('❌ Error in handle-order-action:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
