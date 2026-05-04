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
    const { orderId, status } = await req.json()

    if (!orderId || !status) {
      return new Response(
        JSON.stringify({ error: 'Missing orderId or status' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const validStatuses = ['accepted', 'picking_up', 'delivering', 'delivered']
    if (!validStatuses.includes(status)) {
      return new Response(
        JSON.stringify({ error: 'Invalid status value' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Use SERVICE ROLE KEY to bypass RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log(`🚚 Updating book_it_status to "${status}" for order: ${orderId}`)

    const { data: order, error: updateError } = await supabase
      .from('orders')
      .update({
        book_it_status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .select()
      .single()

    if (updateError) {
      console.error('❌ Error updating book_it_status:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update status', details: updateError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    console.log('✅ book_it_status updated successfully:', order.id)

    // Notify customer
    if (order?.customer_id) {
      try {
        let title = 'Delivery Update'
        let body = 'Your delivery status has been updated.'

        if (status === 'accepted') {
          title = 'Delivery Accepted! 🚚'
          body = 'Book It has accepted your delivery request and is assigning a rider.'
        } else if (status === 'picking_up') {
          title = 'Picking Up! 📦'
          body = 'The rider is picking up your order from the store.'
        } else if (status === 'delivering') {
          title = 'On the Way! 🛵'
          body = 'Your order is being delivered to your location.'
        } else if (status === 'delivered') {
          title = 'Delivered! 🎉'
          body = 'Your order has been successfully delivered by Book It. Enjoy!'
        }

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
            data: { type: 'delivery_update', order_id: orderId, status }
          }),
        })
      } catch (notifyError) {
        console.warn('⚠️ Failed to notify customer:', notifyError)
      }
    }

    return new Response(
      JSON.stringify({ success: true, order }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('❌ Error in update-book-it-status:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
