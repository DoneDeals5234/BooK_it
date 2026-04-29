/**
 * Example: How to integrate native notifications with BookingModal
 * 
 * This shows how to update your existing booking notification code
 * to support both web and native notifications.
 */

import { supabase } from '@/lib/supabase';
import { getShopOwnersByShopId } from '@/lib/supabase-shop-owners';
import { getPlayerId, sendNotificationToCurrentDevice } from '@/lib/onesignal-messaging';
import { isCapacitor } from '@/lib/capacitor-notifications';

interface BookingData {
  id: string;
  shopId: string;
  userId: string;
  shopName: string;
  timeSlot: string;
  serviceName: string;
  userName: string;
  userPhone: string;
}

/**
 * APPROACH 1: Using detect-and-route-notification (RECOMMENDED)
 * 
 * This is the simplest approach - the function automatically handles
 * both web and native devices based on the target user IDs.
 */
export async function notifyShopOwnersOfBooking_Approach1(
  bookingData: BookingData
) {
  try {
    console.log('📨 Sending booking notification to shop owners...');

    const shopOwners = await getShopOwnersByShopId(bookingData.shopId);
    
    if (shopOwners.length === 0) {
      console.log('❌ No shop owners found for this shop');
      return;
    }

    const shopOwnerIds = shopOwners.map(owner => owner.userId);
    console.log(`📤 Notifying ${shopOwnerIds.length} shop owner(s)`);

    const response = await supabase.functions.invoke('detect-and-route-notification', {
      body: {
        targetPlatform: 'both',
        title: '🆕 New Token Booking!',
        body: `New booking from ${bookingData.userName} at ${bookingData.shopName}`,
        userIds: shopOwnerIds,
        data: {
          bookingId: bookingData.id,
          shopId: bookingData.shopId,
          userName: bookingData.userName,
          userPhone: bookingData.userPhone,
          timeSlot: bookingData.timeSlot,
          serviceName: bookingData.serviceName,
        },
      },
    });

    if (response.error) {
      console.error('❌ Error notifying shop owners:', response.error);
      return;
    }

    console.log('✅ Shop owners notified successfully:', response.data);
  } catch (error) {
    console.error('❌ Error in notifyShopOwnersOfBooking:', error);
  }
}

/**
 * APPROACH 2: Sending to Web AND Native Separately
 * 
 * If you want more control over how each platform is notified,
 * you can send to each separately.
 */
export async function notifyShopOwnersOfBooking_Approach2(
  bookingData: BookingData
) {
  try {
    console.log('📨 Sending booking notification to shop owners...');

    const shopOwners = await getShopOwnersByShopId(bookingData.shopId);
    
    if (shopOwners.length === 0) {
      console.log('❌ No shop owners found for this shop');
      return;
    }

    const notificationData = {
      bookingId: bookingData.id,
      shopId: bookingData.shopId,
      userName: bookingData.userName,
      userPhone: bookingData.userPhone,
      timeSlot: bookingData.timeSlot,
      serviceName: bookingData.serviceName,
    };

    const title = '🆕 New Token Booking!';
    const body = `New booking from ${bookingData.userName} at ${bookingData.shopName}`;

    const promises: Promise<any>[] = [];

    const webOwners = shopOwners.filter(owner => owner.playerId && !isCapacitor());
    if (webOwners.length > 0) {
      console.log(`📧 Sending to ${webOwners.length} web shop owner(s)`);
      promises.push(
        supabase.functions.invoke('send-notification', {
          body: {
            title,
            body,
            playerIds: webOwners.map(o => o.playerId).filter(Boolean),
            data: notificationData,
          },
        })
      );
    }

    const nativeOwnerIds = shopOwners.map(owner => owner.userId);
    if (nativeOwnerIds.length > 0) {
      console.log(`📱 Sending to ${nativeOwnerIds.length} native shop owner(s)`);
      promises.push(
        supabase.functions.invoke('send-native-notification', {
          body: {
            title,
            body,
            userIds: nativeOwnerIds,
            data: notificationData,
          },
        })
      );
    }

    const results = await Promise.all(promises);
    console.log('✅ All notifications sent:', results);
  } catch (error) {
    console.error('❌ Error in notifyShopOwnersOfBooking:', error);
  }
}

/**
 * APPROACH 3: Environment-Aware Approach
 * 
 * Send to web if running in web, native if running in native.
 */
export async function notifyShopOwnersOfBooking_Approach3(
  bookingData: BookingData
) {
  try {
    console.log('📨 Sending booking notification to shop owners...');

    const shopOwners = await getShopOwnersByShopId(bookingData.shopId);
    
    if (shopOwners.length === 0) {
      console.log('❌ No shop owners found for this shop');
      return;
    }

    const notificationData = {
      bookingId: bookingData.id,
      shopId: bookingData.shopId,
      userName: bookingData.userName,
      userPhone: bookingData.userPhone,
      timeSlot: bookingData.timeSlot,
      serviceName: bookingData.serviceName,
    };

    const title = '🆕 New Token Booking!';
    const body = `New booking from ${bookingData.userName} at ${bookingData.shopName}`;

    if (isCapacitor()) {
      console.log('📱 Running in native environment, sending native notification');
      
      const response = await supabase.functions.invoke('send-native-notification', {
        body: {
          title,
          body,
          userIds: shopOwners.map(owner => owner.userId),
          data: notificationData,
        },
      });

      if (response.error) {
        console.error('❌ Native notification error:', response.error);
      } else {
        console.log('✅ Native notification sent:', response.data);
      }
    } else {
      console.log('📧 Running in web environment, sending web notification');
      
      const response = await supabase.functions.invoke('send-notification', {
        body: {
          title,
          body,
          playerIds: shopOwners
            .map(owner => owner.playerId)
            .filter((id): id is string => id !== null && id !== undefined),
          data: notificationData,
        },
      });

      if (response.error) {
        console.error('❌ Web notification error:', response.error);
      } else {
        console.log('✅ Web notification sent:', response.data);
      }
    }
  } catch (error) {
    console.error('❌ Error in notifyShopOwnersOfBooking:', error);
  }
}

/**
 * APPROACH 4: With Current User Exclusion
 * 
 * Exclude the current user from notifications (don't notify yourself).
 */
export async function notifyShopOwnersOfBooking_Approach4(
  bookingData: BookingData,
  currentUserId: string,
  currentUserPlayerId: string | null
) {
  try {
    console.log('📨 Sending booking notification to shop owners...');

    const shopOwners = await getShopOwnersByShopId(bookingData.shopId);
    
    if (shopOwners.length === 0) {
      console.log('❌ No shop owners found for this shop');
      return;
    }

    const otherShopOwnerIds = shopOwners
      .filter(owner => owner.userId !== currentUserId)
      .map(owner => owner.userId);

    if (otherShopOwnerIds.length === 0) {
      console.log('ℹ️ No other shop owners to notify');
      return;
    }

    const notificationData = {
      bookingId: bookingData.id,
      shopId: bookingData.shopId,
      userName: bookingData.userName,
      userPhone: bookingData.userPhone,
      timeSlot: bookingData.timeSlot,
      serviceName: bookingData.serviceName,
    };

    const title = '🆕 New Token Booking!';
    const body = `New booking from ${bookingData.userName} at ${bookingData.shopName}`;

    const response = await supabase.functions.invoke('detect-and-route-notification', {
      body: {
        targetPlatform: 'both',
        title,
        body,
        userIds: otherShopOwnerIds,
        data: notificationData,
        excludeCurrentUser: true,
        currentUserPlayerId,
      },
    });

    if (response.error) {
      console.error('❌ Error notifying shop owners:', response.error);
    } else {
      console.log('✅ Shop owners notified successfully:', response.data);
    }
  } catch (error) {
    console.error('❌ Error in notifyShopOwnersOfBooking:', error);
  }
}

/**
 * USAGE IN BOOKING MODAL
 * 
 * Here's how to use in your BookingModal component.
 * In your BookingModal.tsx, in the booking submit handler:
 * 
 * const handleBookingSubmit = async () => {
 *   try {
 *     const savedBooking = await createBooking(bookingData);
 *     
 *     await sendNotificationToCurrentDevice({
 *       title: 'Booking Confirmed',
 *       body: `Your booking at ${shop.name} is confirmed`,
 *     });
 *     
 *     await notifyShopOwnersOfBooking_Approach1({
 *       id: savedBooking.id,
 *       shopId: shop.id,
 *       userId: user.uid,
 *       shopName: shop.name,
 *       timeSlot: selectedTimeSlot,
 *       serviceName: selectedService?.name || 'Haircut',
 *       userName: user.displayName || 'Guest',
 *       userPhone: phoneNumber,
 *     });
 *     
 *     toast.success('Booking confirmed');
 *     setOpen(false);
 *   } catch (error) {
 *     console.error('Booking error:', error);
 *     toast.error('Failed to create booking');
 *   }
 * };
 */

/**
 * MIGRATION CHECKLIST
 * 
 * If you're updating existing notification code:
 * 
 * 1. Remove direct send-notification calls for shop owners
 * 2. Replace with detect-and-route-notification (supports both)
 * 3. Pass userIds instead of playerIds (function fetches them)
 * 4. Keep sendNotificationToCurrentDevice for user confirmations
 * 5. Test on both web and native
 * 6. Update BookingModal.tsx with new notification code
 * 7. Verify shop owners receive notifications on both platforms
 */

export function showMigrationGuide() {
  console.log('🔄 Migration Guide:');
  console.log('');
  console.log('OLD CODE (web only):');
  console.log('const response = await supabase.functions.invoke("send-notification", { body: { playerIds, title, body } });');
  console.log('');
  console.log('NEW CODE (web + native):');
  console.log('const response = await supabase.functions.invoke("detect-and-route-notification", { body: { targetPlatform: "both", userIds, title, body } });');
  console.log('');
  console.log('✨ Now works for both web AND native!');
}
