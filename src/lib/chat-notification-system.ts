import { getNativeShopOwnersByShopId, getAllNativeShopOwners } from '@/lib/supabase-native-shop-owners';
import { getShopOwnersByShopId, getAllShopOwners } from '@/lib/supabase-shop-owners';
import { sendNativeNotification } from '@/lib/native-notifications';

interface ChatNotificationContext {
  shopId: string;
  senderName: string;
  message: string;
  senderEmail?: string;
}

interface WorldChatNotificationContext {
  senderName: string;
  message: string;
  senderEmail?: string;
  imageUrl?: string;
}

interface ProfileChatNotificationContext {
  profileUserId: string;
  senderName: string;
  message: string;
  senderEmail?: string;
}

/**
 * Send temporary chat notification to shop owner
 */
export async function sendTemporaryChatNotification(
  context: ChatNotificationContext
): Promise<{ success: boolean; method: string }> {
  try {
    console.log('🔔 Sending temporary chat notification...');
    
    const nativeShopOwners = await getNativeShopOwnersByShopId(context.shopId);
    const webShopOwners = await getShopOwnersByShopId(context.shopId);

    const allShopOwners = [...(nativeShopOwners || []), ...(webShopOwners || [])];

    if (allShopOwners.length === 0) {
      console.warn('⚠️ No shop owner found for this shop');
      return { success: false, method: 'none' };
    }

    // Get unique user IDs
    const userIds = Array.from(new Set(allShopOwners.map(o => o.userId)));

    const notificationSuccess = await sendNativeNotification(userIds, {
      title: `💬 New message from ${context.senderName}`,
      body: context.message.substring(0, 100) + (context.message.length > 100 ? '...' : ''),
      data: {
        type: 'temporary_chat',
        shopId: context.shopId,
        senderName: context.senderName,
      },
      channelId: 'chat_popup_channel',
    });

    if (notificationSuccess) {
      return { success: true, method: 'FCM' };
    } else {
      return { success: false, method: 'none' };
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    return { success: false, method: 'none' };
  }
}

/**
 * Send world chat notification to ALL shop owners
 */
export async function sendWorldChatNotification(
  context: WorldChatNotificationContext
): Promise<{ success: boolean; method: string }> {
  try {
    console.log('🌍 Sending world chat notification to all shop owners...');
    
    const allNativeShopOwners = await getAllNativeShopOwners();
    const allWebShopOwners = await getAllShopOwners();

    const allShopOwnersCombined = [...(allNativeShopOwners || []), ...(allWebShopOwners || [])];

    if (allShopOwnersCombined.length === 0) {
      console.warn('⚠️ No shop owners found in the system');
      return { success: false, method: 'none' };
    }

    const userIds = Array.from(new Set(allShopOwnersCombined.map(owner => owner.userId).filter(Boolean)));

    if (userIds.length === 0) {
      console.warn('⚠️ No valid user IDs found for shop owners');
      return { success: false, method: 'none' };
    }

    const notificationSuccess = await sendNativeNotification(userIds, {
      title: `🌍 New World Chat from ${context.senderName}`,
      body: context.message.substring(0, 100) + (context.message.length > 100 ? '...' : ''),
      data: {
        type: 'world_chat',
        senderName: context.senderName,
        imageUrl: context.imageUrl,
      },
    });

    if (notificationSuccess) {
      return { success: true, method: 'FCM' };
    } else {
      return { success: false, method: 'none' };
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    return { success: false, method: 'none' };
  }
}

/**
 * Send profile chat notification to a specific user
 */
export async function sendProfileChatNotification(
  context: ProfileChatNotificationContext
): Promise<{ success: boolean; method: string }> {
  try {
    console.log('💬 Sending profile chat notification...');
    
    const userId = context.profileUserId;

    if (!userId) {
      console.warn('⚠️ No profile user ID provided');
      return { success: false, method: 'none' };
    }

    const notificationSuccess = await sendNativeNotification([userId], {
      title: `💬 New message from ${context.senderName}`,
      body: context.message.substring(0, 100) + (context.message.length > 100 ? '...' : ''),
      data: {
        type: 'profile_chat',
        senderName: context.senderName,
        profileUserId: context.profileUserId,
      },
    });

    if (notificationSuccess) {
      return { success: true, method: 'FCM' };
    } else {
      return { success: false, method: 'none' };
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    return { success: false, method: 'none' };
  }
}
