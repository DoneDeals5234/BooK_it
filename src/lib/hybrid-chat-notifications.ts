import { supabase } from '@/lib/supabase';
import { getShopById } from '@/lib/shops-storage';
import { sendNativeNotification } from '@/lib/native-notifications';

interface ChatNotificationContext {
  shopId: string;
  senderName: string;
  message: string;
  senderEmail?: string;
}

/**
 * Hybrid notification system for temporary chat messages
 * Sends notifications via FCM to the shop owner
 */
export async function sendChatNotificationHybrid(context: ChatNotificationContext): Promise<{ success: boolean; layers: string[] }> {
  const successfulLayers: string[] = [];
  let lastError: Error | null = null;

  console.log('🔔 Starting chat notification system...');

  try {
    const success = await sendChatNotificationViaFCM(context);
    if (success) {
      successfulLayers.push('FCM');
    }
  } catch (error) {
    lastError = error instanceof Error ? error : new Error(String(error));
    console.error('❌ ERROR:', lastError.message);
  }

  const success = successfulLayers.length > 0;
  return { success, layers: successfulLayers };
}

/**
 * Send FCM Push Notification to shop owner
 */
async function sendChatNotificationViaFCM(context: ChatNotificationContext): Promise<boolean> {
  try {
    const shop = await getShopById(context.shopId);
    if (!shop) {
      console.warn('⚠️ Shop not found');
      return false;
    }

    const { data: shopOwner, error: shopOwnerError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', shop.ownerEmail)
      .single();

    if (shopOwnerError || !shopOwner) {
      console.warn('⚠️ Shop owner profile not found');
      return false;
    }

    const success = await sendNativeNotification([shopOwner.id], {
      title: `💬 New message from ${context.senderName}`,
      body: context.message.substring(0, 100) + (context.message.length > 100 ? '...' : ''),
      data: {
        type: 'temporary_chat',
        shopId: context.shopId,
        senderName: context.senderName,
        shopName: shop.name
      }
    });

    return success;
  } catch (error) {
    console.error('❌ Exception:', error instanceof Error ? error.message : String(error));
    return false;
  }
}
