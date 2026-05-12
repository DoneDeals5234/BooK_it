import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);


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
 * Send FCM notification for a chat message
 */
async function sendNotificationForChat(notification: ChatNotification): Promise<boolean> {
  try {
    console.log(`📤 Sending FCM for shop ${notification.shop_id}...`);

    const userId = (notification as any).user_id;
    if (!userId) {
      console.warn('⚠️ No user_id in notification record');
      return false;
    }

    // Get shop details for context
    const { data: shop } = await supabase
      .from('shops')
      .select('name')
      .eq('id', notification.shop_id)
      .single();

    // TRIGGER FCM NOTIFICATION
    console.log(`🔔 Sending FCM trigger to user ${userId}...`);
    
    const notifyUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification-by-userid`;
    const resp = await fetch(notifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        user_ids: [userId],
        title: `💬 New message from ${notification.sender_name}`,
        body: notification.message.substring(0, 100) + (notification.message.length > 100 ? '...' : ''),
        data: {
          shop_id: notification.shop_id,
          shop_name: shop?.name || 'Unknown Shop',
          sender_name: notification.sender_name,
          notification_type: 'chat_message',
        }
      }),
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      console.error(`❌ FCM error: ${resp.status} - ${errorText}`);
      return false;
    }

    console.log('✅ FCM notification sent successfully');
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
