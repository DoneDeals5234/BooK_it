import { getNativeShopOwnersByShopId } from '@/lib/supabase-native-shop-owners';
import { sendNotificationByUserId } from '@/lib/onesignal-messaging';
import type { Booking } from '@/lib/bookings-storage';

/**
 * Send booking notifications to both customer and shop owner
 * Called when a new booking is created
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
      console.log(`📱 Layer 1: Notifying customer ${booking.userId}...`);
      try {
        const customerSuccess = await sendNotificationByUserId([booking.userId], {
          title: '✅ Booking Confirmed!',
          body: `Your appointment is booked for ${booking.timeSlot}. Token #${booking.tokenNumber}`,
          data: {
            type: 'booking_confirmation',
            bookingId: booking.id,
            servicePrice: booking.servicePrice,
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
    console.log(`🏪 Layer 2: Notifying shop owner...`);
    try {
      const shopOwners = await getNativeShopOwnersByShopId(booking.shopId);

      if (!shopOwners || shopOwners.length === 0) {
        console.warn('⚠️ No shop owner found');
      } else {
        const shopOwner = shopOwners[0];
        const ownerSuccess = await sendNotificationByUserId([shopOwner.userId], {
          title: '📅 New Booking!',
          body: `${booking.userName} booked ${booking.serviceName} at ${booking.timeSlot}. Token #${booking.tokenNumber}`,
          data: {
            type: 'booking_notification',
            bookingId: booking.id,
            customerName: booking.userName,
            customerPhone: booking.userPhone,
          },
        });

        if (ownerSuccess) {
          console.log(`✅ Shop owner notified: ${shopOwner.userId}`);
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
    console.log(`📊 Notified: ${notified.join(', ') || 'None'}`);

    return { success, notified };
  } catch (error) {
    console.error('❌ Unexpected error in sendBookingNotifications:', error);
    return { success: false, notified };
  }
}
