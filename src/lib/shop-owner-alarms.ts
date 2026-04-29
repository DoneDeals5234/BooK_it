/**
 * Shop Owner Alarms System
 * Handles scheduling alarms for shop owners at booking time to confirm if customers are coming
 */

import { sendScheduledReminderNotification } from '@/lib/onesignal-messaging';

interface ShopOwnerAlarmOptions {
  shopOwnerId: string;
  shopId: string;
  shopName: string;
  bookingId: string;
  customerName: string;
  customerPhone: string;
  bookingTime: string; // HH:MM format
  bookingDate: string; // YYYY-MM-DD format
  tokenNumber: number;
  serviceName: string;
}

/**
 * Schedule an alarm for a shop owner at booking time
 * The shop owner will receive a local reminder/alarm at the booking time to confirm if the customer is coming
 */
export async function scheduleShopOwnerAlarm(
  options: ShopOwnerAlarmOptions
): Promise<{ success: boolean; message: string }> {
  try {
    console.log('⏰ Scheduling shop owner alarm for booking:', options.bookingId);
    console.log(`   Time: ${options.bookingTime} on ${options.bookingDate}`);
    console.log(`   Customer: ${options.customerName} (${options.customerPhone})`);
    console.log(`   Service: ${options.serviceName}`);

    // Schedule a reminder for the shop owner at the booking time
    // This will trigger a local alarm/notification on the shop owner's device
    const success = await sendScheduledReminderNotification(
      options.shopOwnerId,
      {
        bookingId: options.bookingId,
        shopId: options.shopId,
        shopName: options.shopName,
        tokenNumber: options.tokenNumber,
        userName: options.customerName, // Used as customer name in the notification
        timeSlot: options.bookingTime,
        bookingDate: options.bookingDate,
        reminderTime: options.bookingTime, // Schedule alarm for booking time, not before
      },
      {
        isShopOwnerAlarm: true, // Mark this as a shop owner alarm
      }
    );

    if (success) {
      console.log('✅ Shop owner alarm scheduled successfully');
      return {
        success: true,
        message: `Shop owner alarm scheduled for ${options.bookingTime}`,
      };
    } else {
      console.warn('⚠️ Failed to schedule shop owner alarm');
      return {
        success: false,
        message: 'Failed to schedule shop owner alarm',
      };
    }
  } catch (error) {
    console.error('❌ Error scheduling shop owner alarm:', error);
    return {
      success: false,
      message: `Error scheduling shop owner alarm: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Send notification to customer that shop owner confirmed they're coming
 * Get booking details from Supabase and send notification to customer
 */
export async function notifyCustomerShopOwnerConfirmed(
  bookingId: string,
  shopName: string,
  timeSlot: string,
  tokenNumber: number
): Promise<boolean> {
  try {
    console.log('📤 Notifying customer that shop owner confirmed their booking');

    // Import functions needed to fetch booking and send notification
    const { supabase } = await import('@/lib/supabase');
    const { sendNotificationByUserId } = await import('@/lib/onesignal-messaging');

    // Fetch the booking to get customer details
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('user_id, user_name, user_phone')
      .eq('id', bookingId)
      .single();

    if (error || !booking || !booking.user_id) {
      console.warn('⚠️ Could not fetch booking or customer user ID:', error);
      return false;
    }

    console.log(`✅ Found booking for customer: ${booking.user_name}`);

    // Send notification to customer
    const success = await sendNotificationByUserId(
      [booking.user_id],
      {
        title: '✅ Shop Owner Confirmed',
        body: `Go to ${shopName} at your earliest! Your token #${tokenNumber} is ready for ${timeSlot}.`,
        tokenNumber,
        shopName,
        userName: booking.user_name,
      }
    );

    if (success) {
      console.log('✅ Customer notification sent successfully');
      return true;
    } else {
      console.error('❌ Failed to send customer notification');
      return false;
    }
  } catch (error) {
    console.error('❌ Error notifying customer of shop owner confirmation:', error);
    return false;
  }
}

/**
 * Send notification to customer that shop owner is busy (booking denied)
 * Also deletes the booking
 */
export async function notifyCustomerShopOwnerDenied(
  bookingId: string,
  shopName: string
): Promise<boolean> {
  try {
    console.log('📤 Notifying customer that shop owner is busy and deleting booking');

    // Import functions needed
    const { supabase } = await import('@/lib/supabase');
    const { sendNotificationByUserId } = await import('@/lib/onesignal-messaging');
    const { deleteBookingFromSupabase } = await import('@/lib/supabase-bookings');

    // Fetch the booking to get customer details
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('user_id, user_name')
      .eq('id', bookingId)
      .single();

    if (error || !booking || !booking.user_id) {
      console.warn('⚠️ Could not fetch booking or customer user ID:', error);
      // Still try to delete the booking even if we can't notify
      await deleteBookingFromSupabase(bookingId);
      return false;
    }

    console.log(`✅ Found booking for customer: ${booking.user_name}`);

    // Send notification to customer
    const notificationSent = await sendNotificationByUserId(
      [booking.user_id],
      {
        title: '⏸️ Shop Unavailable',
        body: `Sorry! ${shopName} is busy right now. Please try booking another time.`,
        shopName,
        userName: booking.user_name,
      }
    );

    // Delete the booking
    console.log('🗑️ Deleting booking due to shop owner denial');
    const bookingDeleted = await deleteBookingFromSupabase(bookingId);

    if (bookingDeleted) {
      console.log('✅ Booking deleted successfully');
    } else {
      console.error('❌ Failed to delete booking');
    }

    return notificationSent;
  } catch (error) {
    console.error('❌ Error handling shop owner denial:', error);
    return false;
  }
}
