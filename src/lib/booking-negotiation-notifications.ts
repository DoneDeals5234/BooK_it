import { sendNativeNotification } from '@/lib/native-notifications';
import { scheduleAlarm } from '@/lib/alarm-scheduler';

/**
 * Send customer time selection notification to owner
 * - Sends FCM notification using user ID
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
    // Send FCM notification using user ID
    await sendNativeNotification([ownerId], {
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
 * - Sends FCM notification using user ID
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
    // Send FCM notification using user ID
    await sendNativeNotification([customerId], {
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
    await sendNativeNotification([customerId], {
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
    await sendNativeNotification([customerId], {
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
    await sendNativeNotification([customerId], {
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
    if (typeof window !== 'undefined' && (window as any).AlarmBridge?.clearAlarm) {
      (window as any).AlarmBridge.clearAlarm();
    }
  } catch (err) {
    console.error('Error clearing alarms:', err);
  }
};

/**
 * Notify shop owner that customer confirmed their booking
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
    customerName,
    serviceName,
    bookingTime,
    tokenNumber,
    bookingId,
    shopId,
  } = options;

  try {
    await sendNativeNotification([ownerId], {
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

    if (typeof window !== 'undefined' && (window as any).AlarmBridge?.sendImportantNotification) {
      (window as any).AlarmBridge.sendImportantNotification({
        title: '✅ Customer Confirmed',
        body: `${customerName} Token #${tokenNumber} will arrive at ${bookingTime}`,
        bookingId,
        tokenNumber,
      });
    }
  } catch (err) {
    console.error('Error notifying owner of customer confirmation:', err);
    throw err;
  }
};

/**
 * Notify shop owner that customer cancelled their booking
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
    customerName,
    serviceName,
    bookingTime,
    tokenNumber,
    bookingId,
    shopId,
  } = options;

  try {
    await sendNativeNotification([ownerId], {
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

    if (typeof window !== 'undefined' && (window as any).AlarmBridge?.sendImportantNotification) {
      (window as any).AlarmBridge.sendImportantNotification({
        title: '❌ Customer Cancelled',
        body: `${customerName} Token #${tokenNumber} cancelled their appointment`,
        bookingId,
        tokenNumber,
      });
    }
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
    // Notify customer
    await sendNativeNotification([customerId], {
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
    await sendNativeNotification([ownerId], {
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
  } catch (err) {
    console.error('Error updating booking confirmation status:', err);
    throw err;
  }
};
