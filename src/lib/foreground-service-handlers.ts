import { supabase } from '@/lib/supabase';
import {
  notifyOwnerCustomerConfirmed,
  notifyOwnerCustomerCancelled,
  updateBookingConfirmationStatus,
} from '@/lib/booking-negotiation-notifications';

/**
 * Handle customer confirming from foreground service (taps "Yes")
 * This is called when user confirms their attendance from the foreground service reminder
 */
export const handleForegroundServiceConfirmation = async (bookingId: string): Promise<boolean> => {
  try {
    console.log(`✅ Handling foreground service confirmation for booking: ${bookingId}`);

    // 1. Fetch the booking details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      console.error('❌ Booking not found:', bookingError);
      throw new Error('Booking not found');
    }

    console.log('📋 Booking details:', {
      id: booking.id,
      customerName: booking.user_name,
      timeSlot: booking.time_slot,
      shopId: booking.shop_id,
    });

    // 2. Get shop owner details
    const { data: shopOwners, error: shopError } = await supabase
      .from('native_shop_owners')
      .select('user_id')
      .eq('shop_id', booking.shop_id)
      .limit(1);

    if (shopError) {
      console.error('⚠️ Error fetching shop owner:', shopError);
    }

    const ownerId = shopOwners?.[0]?.user_id || booking.shop_id;

    // 3. Update booking status in database
    await updateBookingConfirmationStatus(bookingId, 'confirmed', supabase);

    // 4. Notify shop owner about confirmation
    await notifyOwnerCustomerConfirmed({
      ownerId,
      ownerName: 'Shop Owner',
      customerName: booking.user_name,
      serviceName: booking.service_name,
      bookingTime: booking.time_slot,
      tokenNumber: booking.token_number,
      bookingId: booking.id,
      shopId: booking.shop_id,
    });

    console.log(`✅ Customer confirmation processed and owner notified for booking: ${bookingId}`);
    return true;
  } catch (error) {
    console.error('❌ Error handling foreground service confirmation:', error);
    return false;
  }
};

/**
 * Handle customer cancelling from foreground service (taps "No")
 * This is called when user cancels their attendance from the foreground service reminder
 */
export const handleForegroundServiceCancellation = async (bookingId: string): Promise<boolean> => {
  try {
    console.log(`❌ Handling foreground service cancellation for booking: ${bookingId}`);

    // 1. Fetch the booking details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      console.error('❌ Booking not found:', bookingError);
      throw new Error('Booking not found');
    }

    console.log('📋 Booking details:', {
      id: booking.id,
      customerName: booking.user_name,
      timeSlot: booking.time_slot,
      shopId: booking.shop_id,
    });

    // 2. Get shop owner details
    const { data: shopOwners, error: shopError } = await supabase
      .from('native_shop_owners')
      .select('user_id')
      .eq('shop_id', booking.shop_id)
      .limit(1);

    if (shopError) {
      console.error('⚠️ Error fetching shop owner:', shopError);
    }

    const ownerId = shopOwners?.[0]?.user_id || booking.shop_id;

    // 3. Update booking status to cancelled
    await updateBookingConfirmationStatus(bookingId, 'cancelled', supabase);

    // 4. Notify shop owner about cancellation
    await notifyOwnerCustomerCancelled({
      ownerId,
      ownerName: 'Shop Owner',
      customerName: booking.user_name,
      serviceName: booking.service_name,
      bookingTime: booking.time_slot,
      tokenNumber: booking.token_number,
      bookingId: booking.id,
      shopId: booking.shop_id,
    });

    // 5. Optional: Delete the booking from the system
    const { error: deleteError } = await supabase
      .from('bookings')
      .delete()
      .eq('id', bookingId);

    if (deleteError) {
      console.warn('⚠️ Error deleting cancelled booking:', deleteError);
    } else {
      console.log(`✅ Cancelled booking deleted from system: ${bookingId}`);
    }

    console.log(`✅ Customer cancellation processed and owner notified for booking: ${bookingId}`);
    return true;
  } catch (error) {
    console.error('❌ Error handling foreground service cancellation:', error);
    return false;
  }
};

/**
 * Called from native foreground service to notify web of confirmation/cancellation
 * The native side will call this function when user taps Yes or No button
 */
export const processForegroundServiceResponse = async (
  bookingId: string,
  response: 'confirmed' | 'cancelled'
): Promise<{ success: boolean; message: string }> => {
  try {
    console.log(`📱 Processing foreground service response: ${response} for booking: ${bookingId}`);

    const success =
      response === 'confirmed'
        ? await handleForegroundServiceConfirmation(bookingId)
        : await handleForegroundServiceCancellation(bookingId);

    if (success) {
      return {
        success: true,
        message: `Booking ${response} successfully - owner has been notified`,
      };
    } else {
      return {
        success: false,
        message: `Failed to process booking ${response}`,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error processing foreground service response:', errorMessage);
    return {
      success: false,
      message: `Error: ${errorMessage}`,
    };
  }
};

/**
 * Check pending confirmations for a booking (called periodically from foreground service)
 */
export const getPendingBookingConfirmations = async (
  userId: string
): Promise<
  Array<{
    bookingId: string;
    customerName: string;
    timeSlot: string;
    shopName: string;
    tokenNumber: number;
    confirmationStatus: string;
  }>
> => {
  try {
    const { data: pendingBookings, error } = await supabase
      .from('bookings')
      .select('id, user_name, time_slot, shop_id, token_number, customer_confirmation')
      .eq('user_id', userId)
      .eq('customer_confirmation', 'pending')
      .eq('foreground_service_status', 'running');

    if (error) {
      console.error('Error fetching pending bookings:', error);
      return [];
    }

    // Fetch shop names for each booking
    const bookingsWithShopNames = await Promise.all(
      (pendingBookings || []).map(async (booking: any) => {
        const { data: shop } = await supabase
          .from('shops')
          .select('name')
          .eq('id', booking.shop_id)
          .single();

        return {
          bookingId: booking.id,
          customerName: booking.user_name,
          timeSlot: booking.time_slot,
          shopName: shop?.name || 'Unknown Shop',
          tokenNumber: booking.token_number,
          confirmationStatus: booking.customer_confirmation,
        };
      })
    );

    console.log(`📋 Found ${bookingsWithShopNames.length} pending confirmations for user: ${userId}`);
    return bookingsWithShopNames;
  } catch (error) {
    console.error('Error getting pending confirmations:', error);
    return [];
  }
};
