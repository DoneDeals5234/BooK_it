import { supabase } from './supabase';

interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  channelId?: string;
}

/**
 * Send a native push notification using the Supabase Edge Function (FCM-only)
 */
export async function sendNativeNotification(
  userIds: string[],
  payload: NotificationPayload
): Promise<boolean> {
  try {
    console.log(`📡 Sending native notification to ${userIds.length} user(s)...`);
    
    const { data: result, error } = await supabase.functions.invoke('send-native-notification', {
      body: {
        userIds,
        title: payload.title,
        body: payload.body,
        data: payload.data,
        channelId: payload.channelId
      }
    });

    if (error) {
      console.error('❌ Error invoking send-native-notification:', error);
      return false;
    }

    console.log('✅ Native notification response:', result);
    return result?.success || false;
  } catch (error) {
    console.error('❌ Error in sendNativeNotification:', error);
    return false;
  }
}

/**
 * Send a broadcast notification to all native devices
 */
export async function sendBroadcastNotification(
  title: string,
  body: string,
  imageUrl?: string,
  shopId?: string,
  extraData?: Record<string, string>
): Promise<boolean> {
  try {
    console.log('📢 Sending broadcast notification to all native devices...');
    
    // 1. Fetch all user IDs from native_devices
    const { data: devices, error: fetchError } = await supabase
      .from('native_devices')
      .select('user_id')
      .not('user_id', 'is', null);

    if (fetchError) {
      console.error('❌ Error fetching native devices for broadcast:', fetchError);
      return false;
    }

    if (!devices || devices.length === 0) {
      console.warn('⚠️ No native devices found for broadcast');
      return false;
    }

    const allUserIds = [...new Set(devices.map(d => d.user_id))];
    console.log(`👥 Targeted ${allUserIds.length} unique users for broadcast`);

    // 2. Send via Edge Function
    const data: Record<string, string> = { type: 'broadcast', ...extraData };
    if (imageUrl) data.imageUrl = imageUrl;
    if (shopId) data.shopId = shopId;

    return await sendNativeNotification(allUserIds, { title, body, data });
  } catch (error) {
    console.error('❌ Error in sendBroadcastNotification:', error);
    return false;
  }
}
