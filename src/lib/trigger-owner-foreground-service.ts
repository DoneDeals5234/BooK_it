import { sendNativeNotification } from '@/lib/native-notifications';

interface TriggerForegroundServiceOptions {
  shopId: string;
  ownerUserIds: string[];
  customerName: string;
  serviceName: string;
  timeSlot: string;
  bookingRequestId: string;
  customerPhone: string;
}

/**
 * Trigger the owner's device to start foreground service when a customer books
 * Uses FCM (Firebase Cloud Messaging) via Supabase Edge Function
 */
export async function triggerOwnerForegroundService(
  options: TriggerForegroundServiceOptions
): Promise<boolean> {
  try {
    console.log('📱 Triggering foreground service for owner devices via FCM...');
    
    const payload = {
      title: `🔔 Booking Alert - ${options.customerName}`,
      body: `${options.serviceName} at ${options.timeSlot}`,
      data: {
        bookingRequestId: options.bookingRequestId,
        type: 'booking_request',
        action: 'start_foreground_service',
        customerName: options.customerName,
        serviceName: options.serviceName,
        timeSlot: options.timeSlot,
        customerPhone: options.customerPhone,
        startForegroundService: 'true', // Signal to native app to start foreground service
      },
    };

    const result = await sendNativeNotification(options.ownerUserIds, payload);

    if (result) {
      console.log('✅ Foreground service trigger sent successfully');
      return true;
    } else {
      console.warn('⚠️ FCM notification trigger failed');
      return false;
    }
  } catch (error) {
    console.error('❌ Error in triggerOwnerForegroundService:', error);
    return false;
  }
}
