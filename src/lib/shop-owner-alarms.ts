/**
 * Shop Owner Alarms System
 * Handles scheduling alarms for shop owners at booking time to confirm if customers are coming
 */

import { sendNativeNotification } from '@/lib/native-notifications';

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
 * Uses FCM (Firebase Cloud Messaging) via Supabase Edge Function
 */
export async function scheduleShopOwnerAlarm(
  options: ShopOwnerAlarmOptions
): Promise<{ success: boolean; message: string }> {
  try {
    console.log('⏰ Scheduling shop owner alarm for booking:', options.bookingId);
    
    // NOTE: True server-side scheduling requires a background worker.
    // For now, we send an immediate notification that the native app will handle
    // to show an alarm or reminder if appropriate.
    
    const payload = {
      title: '⏰ Booking Reminder',
      body: `${options.customerName} has a booking for ${options.serviceName} at ${options.bookingTime}`,
      data: {
        bookingId: options.bookingId,
        shopId: options.shopId,
        shopName: options.shopName,
        tokenNumber: options.tokenNumber.toString(),
        userName: options.customerName,
        timeSlot: options.bookingTime,
        bookingDate: options.bookingDate,
        isShopOwnerAlarm: 'true',
        type: 'booking_reminder'
      }
    };

    const success = await sendNativeNotification([options.shopOwnerId], payload);

    if (success) {
      console.log('✅ Shop owner alarm notification sent successfully');
      return {
        success: true,
        message: `Shop owner notification sent for ${options.bookingTime}`,
      };
    } else {
      console.warn('⚠️ Failed to send shop owner alarm notification');
      return {
        success: false,
        message: 'Failed to send shop owner notification',
      };
    }
  } catch (error) {
    console.error('❌ Error in scheduleShopOwnerAlarm:', error);
    return {
      success: false,
      message: `Error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Send notification to customer that shop owner confirmed they're coming
 */
export async function notifyCustomerShopOwnerConfirmed(
  bookingId: string,
  shopName: string,
  timeSlot: string,
  tokenNumber: number
): Promise<boolean> {
  try {
    console.log('📤 Notifying customer that shop owner confirmed their booking');

    const { supabase } = await import('@/lib/supabase');

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

    // Send notification to customer via FCM
    const success = await sendNativeNotification(
      [booking.user_id],
      {
        title: '✅ Shop Owner Confirmed',
        body: `Go to ${shopName} at your earliest! Your token #${tokenNumber} is ready for ${timeSlot}.`,
        data: {
          type: 'booking_confirmed',
          tokenNumber: tokenNumber.toString(),
          shopName,
          userName: booking.user_name,
          timeSlot
        }
      }
    );

    return success;
  } catch (error) {
    console.error('❌ Error notifying customer:', error);
    return false;
  }
}

/**
 * Send notification to customer that shop owner is busy (booking denied)
 */
export async function notifyCustomerShopOwnerDenied(
  bookingId: string,
  shopName: string
): Promise<boolean> {
  try {
    console.log('📤 Notifying customer that shop owner is busy');

    const { supabase } = await import('@/lib/supabase');
    const { deleteBookingFromSupabase } = await import('@/lib/supabase-bookings');

    // Fetch the booking to get customer details
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('user_id, user_name')
      .eq('id', bookingId)
      .single();

    let notificationSent = false;
    if (booking && booking.user_id) {
      notificationSent = await sendNativeNotification(
        [booking.user_id],
        {
          title: '⏸️ Shop Unavailable',
          body: `Sorry! ${shopName} is busy right now. Please try booking another time.`,
          data: {
            type: 'booking_denied',
            shopName,
            userName: booking.user_name
          }
        }
      );
    }

    // Delete the booking
    console.log('🗑️ Deleting booking due to shop owner denial');
    await deleteBookingFromSupabase(bookingId);

    return notificationSent;
  } catch (error) {
    console.error('❌ Error handling shop owner denial:', error);
    return false;
  }
}
