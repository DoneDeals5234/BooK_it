import { getNativeShopOwnersByShopId, getAllNativeShopOwners } from '@/lib/supabase-native-shop-owners';
import { sendNotificationByUserId } from '@/lib/onesignal-messaging';

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
}

interface ProfileChatNotificationContext {
  profileUserId: string;
  senderName: string;
  message: string;
  senderEmail?: string;
}

/**
 * Send temporary chat notification to shop owner
 * Uses sendNotificationByUserId for direct OneSignal delivery
 */
export async function sendTemporaryChatNotification(
  context: ChatNotificationContext
): Promise<{ success: boolean; method: string }> {
  try {
    console.log('🔔 Sending temporary chat notification...');
    console.log(`📊 Context:`, { shopId: context.shopId, senderName: context.senderName });

    // Get shop owner's user ID from native_shop_owners table
    console.log(`🔍 Looking up shop owner for shop ${context.shopId}...`);
    const shopOwners = await getNativeShopOwnersByShopId(context.shopId);

    if (!shopOwners || shopOwners.length === 0) {
      console.warn('⚠️ No shop owner found for this shop');
      return { success: false, method: 'none' };
    }

    const shopOwner = shopOwners[0]; // Get first owner
    const userId = shopOwner.userId;

    console.log(`✅ Found shop owner with user ID: ${userId}`);

    // Send notification directly via sendNotificationByUserId
    console.log(`📱 Sending OneSignal notification to user ${userId}...`);
    
    const notificationSuccess = await sendNotificationByUserId([userId], {
      title: `💬 New message from ${context.senderName}`,
      body: context.message.substring(0, 100) + (context.message.length > 100 ? '...' : ''),
      data: {
        type: 'temporary_chat',
        shopId: context.shopId,
        senderName: context.senderName,
      },
    });

    if (notificationSuccess) {
      console.log('✅ SUCCESS: OneSignal notification sent directly');
      return { success: true, method: 'OneSignal' };
    } else {
      console.warn('⚠️ FAILED: Direct notification failed');
      return { success: false, method: 'none' };
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    return { success: false, method: 'none' };
  }
}

/**
 * Send world chat notification to ALL shop owners
 * Gets all unique shop owners and notifies them of the world chat message
 */
export async function sendWorldChatNotification(
  context: WorldChatNotificationContext
): Promise<{ success: boolean; method: string }> {
  try {
    console.log('🌍 Sending world chat notification to all shop owners...');
    console.log(`📊 Context:`, { senderName: context.senderName });

    // Get all shop owners from the entire system
    console.log(`🔍 Looking up all shop owners...`);
    const allShopOwners = await getAllNativeShopOwners();

    if (!allShopOwners || allShopOwners.length === 0) {
      console.warn('⚠️ No shop owners found in the system');
      return { success: false, method: 'none' };
    }

    // Extract unique user IDs to avoid duplicate notifications
    const userIds = Array.from(new Set(allShopOwners.map(owner => owner.userId).filter(Boolean)));

    if (userIds.length === 0) {
      console.warn('⚠️ No valid user IDs found for shop owners');
      return { success: false, method: 'none' };
    }

    console.log(`✅ Found ${userIds.length} unique shop owner(s)`);

    // Send notification to all shop owners via sendNotificationByUserId
    console.log(`📱 Sending OneSignal notification to ${userIds.length} shop owner(s)...`);

    const notificationSuccess = await sendNotificationByUserId(userIds, {
      title: `🌍 New World Chat from ${context.senderName}`,
      body: context.message.substring(0, 100) + (context.message.length > 100 ? '...' : ''),
      data: {
        type: 'world_chat',
        senderName: context.senderName,
      },
    });

    if (notificationSuccess) {
      console.log(`✅ SUCCESS: OneSignal notifications sent to ${userIds.length} shop owner(s)`);
      return { success: true, method: 'OneSignal' };
    } else {
      console.warn('⚠️ FAILED: Direct notification failed');
      return { success: false, method: 'none' };
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    return { success: false, method: 'none' };
  }
}

/**
 * Send profile chat notification to a specific user
 * Sends a notification when someone sends a direct message to a user's profile
 */
export async function sendProfileChatNotification(
  context: ProfileChatNotificationContext
): Promise<{ success: boolean; method: string }> {
  try {
    console.log('💬 Sending profile chat notification...');
    console.log(`📊 Context:`, { profileUserId: context.profileUserId, senderName: context.senderName });

    // The profileUserId is the user ID of the profile owner
    const userId = context.profileUserId;

    if (!userId) {
      console.warn('⚠️ No profile user ID provided');
      return { success: false, method: 'none' };
    }

    console.log(`✅ Found profile user with ID: ${userId}`);

    // Send notification directly via sendNotificationByUserId
    console.log(`📱 Sending OneSignal notification to user ${userId}...`);

    const notificationSuccess = await sendNotificationByUserId([userId], {
      title: `💬 New message from ${context.senderName}`,
      body: context.message.substring(0, 100) + (context.message.length > 100 ? '...' : ''),
      data: {
        type: 'profile_chat',
        senderName: context.senderName,
        profileUserId: context.profileUserId,
      },
    });

    if (notificationSuccess) {
      console.log('✅ SUCCESS: OneSignal notification sent to profile user');
      return { success: true, method: 'OneSignal' };
    } else {
      console.warn('⚠️ FAILED: Direct notification failed');
      return { success: false, method: 'none' };
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    return { success: false, method: 'none' };
  }
}
