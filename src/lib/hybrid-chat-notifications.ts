import { supabase } from '@/lib/supabase';
import { getShopById } from '@/lib/shops-storage';
import { sendNotificationToPlayerIds, type NotificationPayload } from '@/lib/onesignal-messaging';
import { getPlayerIdFromNativeDevices } from '@/lib/supabase-native-devices';

interface ChatNotificationContext {
  shopId: string;
  senderName: string;
  message: string;
  senderEmail?: string;
}

/**
 * OneSignal notification system for temporary chat messages
 * Sends notifications via OneSignal API to the shop owner
 */
export async function sendChatNotificationHybrid(context: ChatNotificationContext): Promise<{ success: boolean; layers: string[] }> {
  const successfulLayers: string[] = [];
  let lastError: Error | null = null;

  console.log('🔔 Starting chat notification system...');
  console.log(`📊 Context:`, { shopId: context.shopId, senderName: context.senderName });

  // OneSignal Push Notification
  try {
    console.log('📱 Attempting OneSignal push notification...');
    const success = await sendChatNotificationViaOneSignal(context);
    if (success) {
      successfulLayers.push('OneSignal');
      console.log('✅ SUCCESS: OneSignal notification sent');
    } else {
      console.warn('⚠️ FAILED: OneSignal notification could not be sent');
    }
  } catch (error) {
    lastError = error instanceof Error ? error : new Error(String(error));
    console.error('❌ ERROR:', lastError.message);
  }

  const success = successfulLayers.length > 0;
  console.log(`🎯 Notification result: ${success ? 'SUCCESS ✅' : 'FAILED ❌'}`);
  console.log(`📊 Notification method: ${successfulLayers.join(', ') || 'None'}`);

  if (!success && lastError) {
    console.error('💥 Final error:', lastError.message);
  }

  return { success, layers: successfulLayers };
}

/**
 * Send OneSignal Push Notification to shop owner
 * Notifies shop owner about new temporary chat messages
 */
async function sendChatNotificationViaOneSignal(context: ChatNotificationContext): Promise<boolean> {
  try {
    console.log('🔍 Fetching shop details...');
    const shop = await getShopById(context.shopId);
    if (!shop) {
      console.warn('⚠️ Shop not found');
      return false;
    }

    // Get shop owner's user ID from user_profiles table
    console.log(`🔍 Looking up shop owner for ${shop.ownerEmail}...`);

    const { data: shopOwner, error: shopOwnerError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', shop.ownerEmail)
      .single();

    if (shopOwnerError || !shopOwner) {
      console.warn('⚠️ Shop owner profile not found', shopOwnerError?.message);
      return false;
    }

    console.log(`✅ Found shop owner with ID: ${shopOwner.id}`);

    // Get shop owner's player ID from native_devices
    console.log(`📱 Fetching player ID for shop owner...`);
    const playerId = await getPlayerIdFromNativeDevices(shopOwner.id);

    if (!playerId) {
      console.warn('⚠️ No player ID found - shop owner may not have notifications enabled');
      return false;
    }

    console.log(`✅ Found player ID: ${playerId}`);

    // Prepare OneSignal notification payload
    const notificationPayload: NotificationPayload = {
      title: `💬 New message from ${context.senderName}`,
      body: context.message.substring(0, 100) + (context.message.length > 100 ? '...' : ''),
      shopName: shop.name,
      userName: context.senderName,
    };

    console.log(`📤 Sending OneSignal notification...`, notificationPayload);

    // Send via OneSignal
    const success = await sendNotificationToPlayerIds([playerId], notificationPayload);

    if (success) {
      console.log('✅ OneSignal notification sent successfully');
      return true;
    } else {
      console.warn('⚠️ OneSignal API call failed');
      return false;
    }
  } catch (error) {
    console.error('❌ Exception:', error instanceof Error ? error.message : String(error));
    return false;
  }
}
