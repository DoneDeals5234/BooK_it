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
      .select('customer_id, order_amount, shop_id, customer_name, shop_name')
      .single();

    if (updateError) {
      console.error('❌ Error updating order:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update order', details: updateError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const shopName = order.shop_name || 'the shop';
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Notify Customer
    try {
      const title = action === 'accept' ? '✅ Order Accepted!' : '❌ Order Rejected';
      const body = action === 'accept' 
        ? `Great news! Your order of ₹${order.order_amount} from ${shopName} has been accepted.`
        : `Your order of ₹${order.order_amount} from ${shopName} was declined. ${rejectionNotes || 'Please try again.'}`;

      console.log(`🔔 Notifying customer: ${order.customer_id}`);
      const custRes = await fetch(`${SUPABASE_URL}/functions/v1/send-native-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({
          userIds: [order.customer_id],
          title,
          body,
          data: { type: 'order_update', order_id: orderId, status }
        }),
      });
      console.log(`📱 Customer notification: ${custRes.status}`);
    } catch (e) {
      console.error('⚠️ Customer notification failed:', e);
    }

    // Notify Shop Owner (confirmation of their own action)
    try {
      const { data: shopOwners } = await supabase
        .from('shop_owners')
        .select('user_id')
        .eq('shop_id', order.shop_id);

      if (shopOwners && shopOwners.length > 0) {
        const ownerUserIds = shopOwners.map((o: any) => o.user_id).filter(Boolean);
        const ownerTitle = action === 'accept' ? '✅ Order Confirmed' : '🗑️ Order Declined';
        const ownerBody = action === 'accept'
          ? `You accepted ${order.customer_name}'s order for ₹${order.order_amount}.`
          : `You declined ${order.customer_name}'s order for ₹${order.order_amount}.`;

        const ownerRes = await fetch(`${SUPABASE_URL}/functions/v1/send-native-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_KEY}` },
          body: JSON.stringify({ userIds: ownerUserIds, title: ownerTitle, body: ownerBody, data: { type: 'order_action', order_id: orderId, status } }),
        });
        console.log(`📩 Owner notification: ${ownerRes.status}`);
      }
    } catch (e) {
      console.error('⚠️ Owner notification failed:', e);
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
