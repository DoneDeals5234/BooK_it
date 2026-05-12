import { supabase } from '@/lib/supabase';
import { sendNativeNotification } from '@/lib/native-notifications';

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
 */
export const checkPendingReminders = async (): Promise<PendingReminder[]> => {
  try {
    const now = new Date();
    const currentTime = now.toISOString();
    const twoMinutesAgo = new Date(now.getTime() - 2 * 60000).toISOString();

    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('id, shop_id, service_name, user_id, reminder_time, reminder_triggered_at')
      .eq('reminder_enabled', true)
      .is('customer_confirmed', null)
      .is('reminder_triggered_at', null)
      .gte('reminder_time', twoMinutesAgo)
      .lte('reminder_time', currentTime);

    if (error) return [];
    if (!bookings || bookings.length === 0) return [];

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
    return [];
  }
};

/**
 * Trigger a reminder
 */
export const triggerReminder = async (bookingId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('bookings')
      .update({
        reminder_triggered_at: new Date().toISOString(),
      })
      .eq('id', bookingId);

    return !error;
  } catch (error) {
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
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        customer_confirmed: true,
      })
      .eq('id', bookingId);

    if (updateError) return false;

    // Send notification to shop owner via FCM
    await sendNativeNotification([shopOwnerId], {
      title: '📞 Customer Confirmed!',
      body: `${customerName} confirmed they are coming for ${serviceName}`,
      data: {
        type: 'customer_confirmation',
        bookingId,
        customerName
      }
    });

    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Handle customer cancellation
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

    return !error;
  } catch (error) {
    return false;
  }
};

/**
 * Start monitoring for reminders
 */
export const startReminderMonitoring = (
  onReminderReady: (reminder: PendingReminder) => void
) => {
  const intervalId = setInterval(async () => {
    try {
      const pendingReminders = await checkPendingReminders();
      pendingReminders.forEach((reminder) => {
        onReminderReady(reminder);
        triggerReminder(reminder.bookingId);
      });
    } catch (error) {}
  }, 30000);

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

    return data || [];
  } catch (error) {
    return [];
  }
};

/**
 * Cancel a booking
 */
export const cancelCustomerBooking = async (bookingId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
      })
      .eq('id', bookingId);

    return !error;
  } catch (error) {
    return false;
  }
};
