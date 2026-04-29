import {
  sendNotificationToPlayerIds,
  sendNotificationByUserId,
  sendNotificationToCurrentDevice,
} from '@/lib/onesignal-messaging';
import { scheduleAlarm } from '@/lib/alarm-scheduler';

interface NotificationOptions {
  title: string;
  body: string;
  data?: Record<string, any>;
  playerIds?: string[];
  userId?: string;
  alarmDurationSeconds?: number;
  useNativeAlarm?: boolean;
}

/**
 * Send customer time selection notification to owner
 * - Sends OneSignal notification using user ID (external ID)
 * - Schedules 1-minute native alarm on owner device
 */
export const notifyOwnerOfBookingRequest = async (options: {
  ownerId: string;
  customerName: string;
  serviceName: string;
  requestedTime: string;
  bookingRequestId: string;
  useNativeAlarm?: boolean;
}) => {
  const {
    ownerId,
    customerName,
    serviceName,
    requestedTime,
    bookingRequestId,
    useNativeAlarm = true,
  } = options;

  try {
    // Send OneSignal notification using user ID (external ID)
    await sendNotificationByUserId([ownerId], {
      title: `New Booking Request - ${customerName}`,
      body: `${serviceName} at ${requestedTime}`,
      data: {
        bookingRequestId,
        type: 'booking_request',
        action: 'show_booking_notification',
        customerName,
        serviceName,
        requestedTime,
      },
    });

    // Schedule native alarm (1 minute)
    if (useNativeAlarm && typeof window !== 'undefined' && (window as any).AlarmBridge) {
      await scheduleAlarm({
        title: `Booking Request - ${customerName}`,
        message: `${serviceName} at ${requestedTime}`,
        durationSeconds: 60,
        data: {
          bookingRequestId,
          type: 'booking_request',
          customerName,
          serviceName,
          requestedTime,
        },
      });
    }
  } catch (err) {
    console.error('Error notifying owner of booking request:', err);
    throw err;
  }
};

/**
 * Send owner time offer notification to customer
 * - Sends OneSignal notification using user ID (external ID)
 * - Schedules 1-minute native alarm on customer device
 */
export const notifyCustomerOfTimeOffer = async (options: {
  customerId: string;
  ownerName: string;
  serviceName: string;
  offeredTimes: string[];
  negotiationId: string;
  useNativeAlarm?: boolean;
}) => {
  const {
    customerId,
    ownerName,
    serviceName,
    offeredTimes,
    negotiationId,
    useNativeAlarm = true,
  } = options;

  try {
    // Send OneSignal notification using user ID (external ID)
    await sendNotificationByUserId([customerId], {
      title: 'Alternative Times Offered',
      body: `${ownerName} offers: ${offeredTimes.join(', ')}`,
      data: {
        negotiationId,
        type: 'time_offer',
        action: 'show_offer_response',
        ownerName,
        serviceName,
        offeredTimes: JSON.stringify(offeredTimes),
      },
    });

    // Schedule native alarm (1 minute)
    if (useNativeAlarm && typeof window !== 'undefined' && (window as any).AlarmBridge) {
      await scheduleAlarm({
        title: 'Alternative Times Offered',
        message: `${offeredTimes.join(', ')}`,
        durationSeconds: 60,
        data: {
          negotiationId,
          type: 'time_offer',
          offeredTimes: JSON.stringify(offeredTimes),
        },
      });
    }
  } catch (err) {
    console.error('Error notifying customer of time offer:', err);
    throw err;
  }
};

/**
 * Send owner not responding notification to customer
 * - Shows popup with Call and Cancel options
 */
export const notifyCustomerOwnerNotResponding = async (options: {
  customerId: string;
  serviceName: string;
  requestedTime: string;
  bookingRequestId: string;
}) => {
  const {
    customerId,
    serviceName,
    requestedTime,
    bookingRequestId,
  } = options;

  try {
    // Send OneSignal notification using user ID (external ID)
    await sendNotificationByUserId([customerId], {
      title: 'Owner Not Responding',
      body: 'The owner is not responding. You can call them or cancel the request.',
      data: {
        bookingRequestId,
        type: 'owner_not_responding',
        action: 'show_owner_not_responding',
        serviceName,
        requestedTime,
      },
    });
  } catch (err) {
    console.error('Error notifying customer of owner not responding:', err);
    throw err;
  }
};

/**
 * Send booking confirmation notification
 */
export const notifyBookingConfirmed = async (options: {
  customerId: string;
  shopName: string;
  serviceName: string;
  confirmedTime: string;
  bookingRequestId: string;
}) => {
  const {
    customerId,
    shopName,
    serviceName,
    confirmedTime,
    bookingRequestId,
  } = options;

  try {
    // Send OneSignal notification using user ID (external ID)
    await sendNotificationByUserId([customerId], {
      title: 'Booking Confirmed!',
      body: `${shopName} confirmed your booking for ${serviceName} at ${confirmedTime}`,
      data: {
        bookingRequestId,
        type: 'booking_confirmed',
        action: 'show_booking_confirmation',
      },
    });
  } catch (err) {
    console.error('Error notifying booking confirmation:', err);
    throw err;
  }
};

/**
 * Send booking rejected notification
 */
export const notifyBookingRejected = async (options: {
  customerId: string;
  shopName: string;
  serviceName: string;
  bookingRequestId: string;
}) => {
  const {
    customerId,
    shopName,
    serviceName,
    bookingRequestId,
  } = options;

  try {
    // Send OneSignal notification using user ID (external ID)
    await sendNotificationByUserId([customerId], {
      title: 'Booking Rejected',
      body: `${shopName} rejected your booking request for ${serviceName}`,
      data: {
        bookingRequestId,
        type: 'booking_rejected',
        action: 'show_booking_rejected',
      },
    });
  } catch (err) {
    console.error('Error notifying booking rejection:', err);
    throw err;
  }
};

/**
 * Clear active alarms when booking is completed or cancelled
 */
export const clearBookingAlarms = async () => {
  try {
    // Native alarm clearing (if available)
    if (typeof window !== 'undefined' && (window as any).AlarmBridge?.clearAlarm) {
      (window as any).AlarmBridge.clearAlarm();
    }
  } catch (err) {
    console.error('Error clearing alarms:', err);
  }
};

/**
 * Notify shop owner that customer confirmed their booking via foreground service
 * Called when customer taps "Yes" on the foreground service reminder
 */
export const notifyOwnerCustomerConfirmed = async (options: {
  ownerId: string;
  ownerName: string;
  customerName: string;
  serviceName: string;
  bookingTime: string;
  tokenNumber: number;
  bookingId: string;
  shopId: string;
}) => {
  const {
    ownerId,
    ownerName,
    customerName,
    serviceName,
    bookingTime,
    tokenNumber,
    bookingId,
    shopId,
  } = options;

  try {
    console.log(`✅ Notifying owner ${ownerName} that ${customerName} confirmed booking ${bookingId}`);

    // Send OneSignal notification using user ID (external ID)
    await sendNotificationByUserId([ownerId], {
      title: '✅ Customer Confirmed',
      body: `${customerName} confirmed they're coming! Token #${tokenNumber} will arrive at ${bookingTime}`,
      data: {
        bookingId,
        shopId,
        type: 'customer_confirmed',
        action: 'show_customer_confirmation',
        customerName,
        serviceName,
        bookingTime,
        tokenNumber: tokenNumber.toString(),
      },
    });

    // Also send a mobile notification via native alarm to ensure owner sees it
    if (typeof window !== 'undefined' && (window as any).AlarmBridge?.sendImportantNotification) {
      (window as any).AlarmBridge.sendImportantNotification({
        title: '✅ Customer Confirmed',
        body: `${customerName} Token #${tokenNumber} will arrive at ${bookingTime}`,
        bookingId,
        tokenNumber,
      });
    }

    console.log(`✅ Owner notification sent for booking ${bookingId}`);
  } catch (err) {
    console.error('Error notifying owner of customer confirmation:', err);
    throw err;
  }
};

/**
 * Notify shop owner that customer cancelled their booking via foreground service
 * Called when customer taps "No" on the foreground service reminder
 */
export const notifyOwnerCustomerCancelled = async (options: {
  ownerId: string;
  ownerName: string;
  customerName: string;
  serviceName: string;
  bookingTime: string;
  tokenNumber: number;
  bookingId: string;
  shopId: string;
}) => {
  const {
    ownerId,
    ownerName,
    customerName,
    serviceName,
    bookingTime,
    tokenNumber,
    bookingId,
    shopId,
  } = options;

  try {
    console.log(`❌ Notifying owner ${ownerName} that ${customerName} cancelled booking ${bookingId}`);

    // Send OneSignal notification using user ID (external ID)
    await sendNotificationByUserId([ownerId], {
      title: '❌ Customer Cancelled',
      body: `${customerName} cancelled their booking for ${serviceName} at ${bookingTime}`,
      data: {
        bookingId,
        shopId,
        type: 'customer_cancelled',
        action: 'show_customer_cancellation',
        customerName,
        serviceName,
        bookingTime,
        tokenNumber: tokenNumber.toString(),
      },
    });

    // Also send a mobile notification via native alarm
    if (typeof window !== 'undefined' && (window as any).AlarmBridge?.sendImportantNotification) {
      (window as any).AlarmBridge.sendImportantNotification({
        title: '❌ Customer Cancelled',
        body: `${customerName} Token #${tokenNumber} cancelled their appointment`,
        bookingId,
        tokenNumber,
      });
    }

    console.log(`❌ Owner notification sent for cancellation of booking ${bookingId}`);
  } catch (err) {
    console.error('Error notifying owner of customer cancellation:', err);
    throw err;
  }
};

/**
 * Notify both customer and owner that booking is completed
 */
export const notifyBookingCompleted = async (options: {
  customerId: string;
  ownerId: string;
  customerName: string;
  shopName: string;
  serviceName: string;
  bookingTime: string;
  tokenNumber: number;
  bookingId: string;
}) => {
  const {
    customerId,
    ownerId,
    customerName,
    shopName,
    serviceName,
    bookingTime,
    tokenNumber,
    bookingId,
  } = options;

  try {
    console.log(`✅ Notifying both parties that booking ${bookingId} is completed`);

    // Notify customer
    await sendNotificationByUserId([customerId], {
      title: '✅ Booking Completed',
      body: `Your ${serviceName} appointment at ${shopName} at ${bookingTime} is now complete. Thank you!`,
      data: {
        bookingId,
        type: 'booking_completed',
        action: 'show_completion_confirmation',
        shopName,
        serviceName,
        bookingTime,
      },
    });

    // Notify owner
    await sendNotificationByUserId([ownerId], {
      title: '✅ Booking Completed',
      body: `${customerName}'s ${serviceName} booking (Token #${tokenNumber}) at ${bookingTime} is completed.`,
      data: {
        bookingId,
        type: 'booking_completed',
        action: 'show_completion_confirmation',
        customerName,
        serviceName,
        bookingTime,
        tokenNumber: tokenNumber.toString(),
      },
    });

    console.log(`✅ Completion notifications sent to both customer and owner for booking ${bookingId}`);
  } catch (err) {
    console.error('Error notifying booking completion:', err);
    throw err;
  }
};

/**
 * Update booking confirmation status in database
 */
export const updateBookingConfirmationStatus = async (
  bookingId: string,
  status: 'confirmed' | 'cancelled' | 'pending',
  supabase: any
) => {
  try {
    const { error } = await supabase
      .from('bookings')
      .update({
        customer_confirmation: status,
        customer_confirmed_at: new Date().toISOString(),
      })
      .eq('id', bookingId);

    if (error) {
      console.error('Error updating booking confirmation status:', error);
      throw error;
    }

    console.log(`✅ Booking ${bookingId} confirmation status updated to: ${status}`);
  } catch (err) {
    console.error('Error updating booking confirmation status:', err);
    throw err;
  }
};
