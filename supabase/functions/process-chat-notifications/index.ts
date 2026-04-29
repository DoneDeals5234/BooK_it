import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);

const ONESIGNAL_API_KEY = Deno.env.get('ONESIGNAL_API_KEY') || '';
const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID') || '';
const ONESIGNAL_API_URL = 'https://onesignal.com/api/v1/notifications';

interface ChatNotification {
  id: string;
  shop_id: string;
  sender_name: string;
  message: string;
  status: string;
}

export async function processChatNotifications() {
  console.log('🔔 Processing pending chat notifications...');

  try {
    // Fetch pending notifications
    const { data: pendingNotifications, error: fetchError } = await supabase
      .from('chat_notifications')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(100); // Process in batches

    if (fetchError) {
      console.error('❌ Error fetching notifications:', fetchError.message);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to fetch notifications' }),
      };
    }

    if (!pendingNotifications || pendingNotifications.length === 0) {
      console.log('✅ No pending notifications to process');
      return {
        statusCode: 200,
        body: JSON.stringify({ processed: 0, message: 'No pending notifications' }),
      };
    }

    console.log(`📊 Found ${pendingNotifications.length} pending notification(s)`);

    let processedCount = 0;
    let failedCount = 0;

    // Process each notification
    for (const notification of pendingNotifications as ChatNotification[]) {
      try {
        const success = await sendNotificationForChat(notification);
        if (success) {
          // Mark as sent
          await supabase
            .from('chat_notifications')
            .update({ 
              status: 'sent',
              sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', notification.id);

          processedCount++;
          console.log(`✅ Notification ${notification.id} sent successfully`);
        } else {
          // Mark as failed
          await supabase
            .from('chat_notifications')
            .update({ 
              status: 'failed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', notification.id);

          failedCount++;
          console.warn(`⚠️ Notification ${notification.id} failed`);
        }
      } catch (error) {
        console.error(`❌ Error processing notification ${notification.id}:`, error);
        failedCount++;
      }
    }

    console.log(`📊 Processing complete: ${processedCount} sent, ${failedCount} failed`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        processed: processedCount,
        failed: failedCount,
        total: pendingNotifications.length,
      }),
    };
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Unexpected error occurred' }),
    };
  }
}

/**
 * Send OneSignal notification for a chat message
 */
async function sendNotificationForChat(notification: ChatNotification): Promise<boolean> {
  try {
    console.log(`📤 Sending notification for shop ${notification.shop_id}...`);

    // If user_id is already in the notification, use it directly
    const userId = (notification as any).user_id;

    if (!userId) {
      console.warn('⚠️ No user_id in notification record');
      return false;
    }

    // Get shop details for context
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .select('id, name')
      .eq('id', notification.shop_id)
      .single();

    if (shopError) {
      console.warn('⚠️ Shop not found:', shopError?.message);
      // Continue anyway - we have the user_id
    }

    // Get shop owner's player ID from native_devices
    const { data: deviceData, error: deviceError } = await supabase
      .from('native_devices')
      .select('player_id')
      .eq('user_id', userId)
      .single();

    if (deviceError || !deviceData?.player_id) {
      console.warn('⚠️ No player ID found for user:', deviceError?.message);
      return false;
    }

    // Send OneSignal notification
    const payload = {
      app_id: ONESIGNAL_APP_ID,
      include_player_ids: [deviceData.player_id],
      headings: { en: `💬 New message from ${notification.sender_name}` },
      contents: { en: notification.message.substring(0, 100) + (notification.message.length > 100 ? '...' : '') },
      data: {
        shop_id: notification.shop_id,
        shop_name: shop?.name || 'Unknown Shop',
        sender_name: notification.sender_name,
        notification_type: 'chat_message',
      },
    };

    console.log('📡 Calling OneSignal API...');
    const response = await fetch(ONESIGNAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Basic ${ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const responseText = await response.text();
      console.error(`❌ OneSignal API error: ${response.status} - ${responseText}`);
      return false;
    }

    console.log('✅ OneSignal API call successful');
    return true;
  } catch (error) {
    console.error('❌ Error in sendNotificationForChat:', error);
    return false;
  }
}

// Main handler for HTTP requests
Deno.serve(async (req) => {
  console.log('🚀 Chat notification processor invoked');

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const result = await processChatNotifications();
  return new Response(JSON.stringify(result), {
    status: result.statusCode,
    headers: { 'Content-Type': 'application/json' },
  });
});

// Optional: Export for use as a cron job or scheduled function
export { processChatNotifications };
