import { sendDirectNotificationByUserId } from '@/lib/onesignal-direct-notification';

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
 * Uses multiple fallback methods:
 * 1. Direct OneSignal API (primary - 100% reliable)
 * 2. Firebase Cloud Function (secondary backup)
 *
 * The notification includes data that the owner's native app will recognize and use to start the foreground service
 */
export async function triggerOwnerForegroundService(
  options: TriggerForegroundServiceOptions
): Promise<boolean> {
  try {
    console.log('📱 Triggering foreground service for owner devices...');
    console.log('  Shop ID:', options.shopId);
    console.log('  Owner user IDs:', options.ownerUserIds);
    console.log('  Customer:', options.customerName);
    console.log('  Service:', options.serviceName);
    console.log('  Time slot:', options.timeSlot);
    console.log('  Booking request ID:', options.bookingRequestId);

    const notificationPayload = {
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

    // METHOD 1: Direct OneSignal API (Primary - 100% reliable)
    console.log('🚀 Method 1: Direct OneSignal API...');
    try {
      const directResult = await sendDirectNotificationByUserId(
        options.ownerUserIds,
        notificationPayload
      );

      if (directResult) {
        console.log('✅ Foreground service trigger sent via Direct OneSignal API');
        return true;
      } else {
        console.warn('⚠️ Direct method failed, trying Firebase Cloud Function...');
      }
    } catch (error) {
      console.warn('⚠️ Direct method error, trying Firebase Cloud Function:', error);
    }

    // METHOD 2: Firebase Cloud Function (Secondary backup)
    console.log('🔄 Method 2: Firebase Cloud Function...');
    try {
      const firebaseResponse = await fetch(
        'https://us-central1-bookbarber-b3cf8.cloudfunctions.net/triggerOwnerForegroundService',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ownerUserIds: options.ownerUserIds,
            customerName: options.customerName,
            serviceName: options.serviceName,
            timeSlot: options.timeSlot,
            bookingRequestId: options.bookingRequestId,
            customerPhone: options.customerPhone,
          }),
        }
      );

      const responseText = await firebaseResponse.text();
      console.log(`📋 Firebase response status: ${firebaseResponse.status}`);
      console.log(`📋 Firebase response:`, responseText);

      if (!firebaseResponse.ok) {
        console.warn('⚠️ Firebase method also failed:', responseText);
        return false;
      }

      const result = JSON.parse(responseText);
      if (result.success || result.playerIdsCount > 0) {
        console.log(`✅ Foreground service trigger sent via Firebase (${result.playerIdsCount} devices)`);
        return true;
      } else {
        console.warn('⚠️ Firebase returned success=false:', result.message);
        return false;
      }
    } catch (error) {
      console.error('❌ Firebase method error:', error);
      return false;
    }
  } catch (error) {
    console.error('❌ Error in triggerOwnerForegroundService:', error);
    return false;
  }
}
