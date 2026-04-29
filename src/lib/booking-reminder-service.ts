import { supabase } from '@/lib/supabase';
import { sendNotificationToPlayerIds } from '@/lib/onesignal-messaging';
import { getPlayerIdFromNativeDevices } from '@/lib/supabase-native-devices';

export interface PendingReminder {
  id: string;
  bookingId: string;
  shopId: string;
  shopName: string;
  serviceName: string;
  userId: string;
  reminderTime: string;
  reminderTriggeredAt: string | null;
}

/**
 * Check for pending reminders that need to be triggered
 * Should be called periodically (e.g., every minute)
 */
export const checkPendingReminders = async (): Promise<PendingReminder[]> => {
  try {
    const now = new Date();
    const currentTime = now.toISOString();

    // Fetch bookings with reminders that should trigger soon (within 2 minutes window)
    const twoMinutesAgo = new Date(now.getTime() - 2 * 60000).toISOString();

    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('id, shop_id, service_name, user_id, reminder_time, reminder_triggered_at')
      .eq('reminder_enabled', true)
      .is('customer_confirmed', null) // Not yet confirmed
      .is('reminder_triggered_at', null) // Not yet triggered
      .gte('reminder_time', twoMinutesAgo)
      .lte('reminder_time', currentTime);

    if (error) {
      console.error('Error fetching pending reminders:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return [];
    }

    if (!bookings || bookings.length === 0) {
      return [];
    }

    // Get shop details for each booking
    const reminders = await Promise.all(
      bookings.map(async (booking) => {
        const { data: shop } = await supabase
          .from('shops')
          .select('name')
          .eq('id', booking.shop_id)
          .single();

        return {
          id: booking.id,
          bookingId: booking.id,
          shopId: booking.shop_id,
          shopName: shop?.name || 'Barber Shop',
          serviceName: booking.service_name,
          userId: booking.user_id,
          reminderTime: booking.reminder_time,
          reminderTriggeredAt: booking.reminder_triggered_at,
        };
      })
    );

    return reminders;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error checking pending reminders:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return [];
  }
};

/**
 * Trigger a reminder for a specific booking
 * This updates the booking to mark reminder as triggered
 */
export const triggerReminder = async (bookingId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('bookings')
      .update({
        reminder_triggered_at: new Date().toISOString(),
      })
      .eq('id', bookingId);

    if (error) {
      console.error('Error triggering reminder:', error);
      return false;
    }

    console.log('✅ Reminder triggered for booking:', bookingId);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error triggering reminder:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return false;
  }
};

/**
 * Handle customer confirmation - sends notification to shop owner
 */
export const handleCustomerConfirmation = async (
  bookingId: string,
  shopOwnerId: string,
  customerName: string,
  serviceName: string
): Promise<boolean> => {
  try {
    // Update booking status
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        customer_confirmed: true,
      })
      .eq('id', bookingId);

    if (updateError) {
      console.error('Error updating booking:', updateError);
      return false;
    }

    // Send notification to shop owner
    try {
      const playerId = await getPlayerIdFromNativeDevices(shopOwnerId);
      if (playerId) {
        await sendNotificationToPlayerIds(
          [playerId],
          {
            headings: { en: '📞 Customer Confirmed!' },
            contents: {
              en: `${customerName} confirmed they are coming for ${serviceName}`,
            },
          }
        );
      }
    } catch (notificationError) {
      console.warn('Could not send notification to owner:', notificationError);
      // Don't fail the whole operation if notification fails
    }

    console.log('✅ Customer confirmation recorded for booking:', bookingId);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error handling customer confirmation:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return false;
  }
};

/**
 * Handle customer cancellation - silently cancel the booking
 */
export const handleCustomerCancellation = async (
  bookingId: string
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('bookings')
      .update({
        customer_confirmed: false,
        status: 'cancelled',
      })
      .eq('id', bookingId);

    if (error) {
      console.error('Error cancelling booking:', error);
      return false;
    }

    console.log('✅ Booking cancelled: ', bookingId);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error cancelling booking:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return false;
  }
};

/**
 * Start monitoring for reminders in the background
 * This should be called when the app initializes
 */
export const startReminderMonitoring = (
  onReminderReady: (reminder: PendingReminder) => void
) => {
  // Check for pending reminders every 30 seconds
  const intervalId = setInterval(async () => {
    try {
      const pendingReminders = await checkPendingReminders();
      pendingReminders.forEach((reminder) => {
        onReminderReady(reminder);
        triggerReminder(reminder.bookingId);
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error in reminder monitoring:', {
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }, 30000); // Check every 30 seconds

  // Return function to stop monitoring
  return () => clearInterval(intervalId);
};

/**
 * Get all bookings for a customer
 */
export const getCustomerBookings = async (
  userId: string
): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('user_id', userId)
      .order('booking_date', { ascending: false });

    if (error) {
      console.error('Error fetching customer bookings:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error getting customer bookings:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return [];
  }
};

/**
 * Cancel a booking (for customers)
 */
export const cancelCustomerBooking = async (bookingId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
      })
      .eq('id', bookingId);

    if (error) {
      console.error('Error cancelling booking:', error);
      return false;
    }

    console.log('✅ Booking cancelled by customer:', bookingId);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error cancelling booking:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return false;
  }
};
