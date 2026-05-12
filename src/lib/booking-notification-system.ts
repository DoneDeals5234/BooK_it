import { getNativeShopOwnersByShopId } from '@/lib/supabase-native-shop-owners';
import { sendNativeNotification } from '@/lib/native-notifications';
import type { Booking } from '@/lib/bookings-storage';

/**
 * Send booking notifications to both customer and shop owner
 * Called when a new booking is created
 * Uses FCM (Firebase Cloud Messaging) via Supabase Edge Function
 */
export async function sendBookingNotifications(booking: Booking): Promise<{ success: boolean; notified: string[] }> {
  const notified: string[] = [];

  try {
    console.log('🔔 Sending booking notifications...');
    console.log(`📊 Booking:`, {
      id: booking.id,
      shopId: booking.shopId,
      customerName: booking.userName,
      timeSlot: booking.timeSlot,
    });

    // Notify Customer
    if (booking.userId) {
      console.log(`📱 Notifying customer ${booking.userId}...`);
      try {
        const customerSuccess = await sendNativeNotification([booking.userId], {
          title: '✅ Booking Confirmed!',
          body: `Your appointment is booked for ${booking.timeSlot}. Token #${booking.tokenNumber}`,
          data: {
            type: 'booking_confirmation',
            bookingId: booking.id,
            servicePrice: booking.servicePrice?.toString() || '0',
          },
        });

        if (customerSuccess) {
          console.log(`✅ Customer notified: ${booking.userId}`);
          notified.push('customer');
        } else {
          console.warn('⚠️ Failed to notify customer');
        }
      } catch (error) {
        console.error('❌ Error notifying customer:', error);
      }
    }

    // Notify Shop Owner
    console.log(`🏪 Notifying shop owner...`);
    try {
      const shopOwners = await getNativeShopOwnersByShopId(booking.shopId);

      if (!shopOwners || shopOwners.length === 0) {
        console.warn('⚠️ No shop owner found');
      } else {
        // Notify all owners for this shop
        const ownerUserIds = shopOwners.map(o => o.userId);
        const ownerSuccess = await sendNativeNotification(ownerUserIds, {
          title: '📅 New Booking!',
          body: `${booking.userName} booked ${booking.serviceName} at ${booking.timeSlot}. Token #${booking.tokenNumber}`,
          data: {
            type: 'booking_notification',
            bookingId: booking.id,
            customerName: booking.userName,
            customerPhone: booking.userPhone || '',
          },
        });

        if (ownerSuccess) {
          console.log(`✅ Shop owners notified: ${ownerUserIds.join(', ')}`);
          notified.push('owner');
        } else {
          console.warn('⚠️ Failed to notify shop owner');
        }
      }
    } catch (error) {
      console.error('❌ Error notifying shop owner:', error);
    }

    const success = notified.length > 0;
    console.log(`🎯 Booking notification result: ${success ? 'SUCCESS ✅' : 'FAILED ❌'}`);
    
    return { success, notified };
  } catch (error) {
    console.error('❌ Unexpected error in sendBookingNotifications:', error);
    return { success: false, notified };
  }
}
