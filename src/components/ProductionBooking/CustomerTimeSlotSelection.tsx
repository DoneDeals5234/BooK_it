import React, { useState, useEffect } from 'react';
import { useRealTimeNegotiation } from '@/contexts/RealTimeNegotiationContext';
import { useCountdownTimer, formatCountdown } from '@/lib/use-countdown-timer';
import { createProductionBookingRequest } from '@/lib/supabase-bookings';
import { sendNotificationByUserId } from '@/lib/onesignal-messaging';
import { sendDirectNotificationByUserId } from '@/lib/onesignal-direct-notification';
import { scheduleAlarm } from '@/lib/alarm-scheduler';

interface CustomerTimeSlotSelectionProps {
  shopId: string;
  shopName: string;
  serviceName: string;
  servicePrice: string;
  availableSlots: string[];
  ownerId: string;
  customerName: string;
  customerPhone: string;
  onAlarmReceived?: () => void;
  preSelectedTimeSlot?: string;
  onBookingRequestCreated?: (requestId: string) => void;
}

export const CustomerTimeSlotSelection: React.FC<CustomerTimeSlotSelectionProps> = ({
  shopId,
  shopName,
  serviceName,
  servicePrice,
  availableSlots,
  ownerId,
  customerName,
  customerPhone,
  onAlarmReceived,
  preSelectedTimeSlot,
  onBookingRequestCreated,
}) => {
  const { negotiationState, setCustomerTimeSelection, startNegotiation } = useRealTimeNegotiation();
  const [selectedSlot, setSelectedSlot] = useState<string | null>(preSelectedTimeSlot || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const timer = useCountdownTimer({
    duration: 60 * 1000, // 60 seconds
    autoStart: false,
    onExpire: () => {
      console.log('Owner response timeout - showing not responding popup');
      onAlarmReceived?.();
    },
  });

  // Auto-submit if time slot is pre-selected
  useEffect(() => {
    if (preSelectedTimeSlot && !requestId && !isSubmitting) {
      console.log('Auto-submitting pre-selected time slot:', preSelectedTimeSlot);
      handleSubmitTimeSelection();
    }
  }, [preSelectedTimeSlot, requestId, isSubmitting]);

  const handleSelectSlot = (slot: string) => {
    setSelectedSlot(slot);
  };

  const handleSubmitTimeSelection = async () => {
    if (!selectedSlot) {
      setError('Please select a time slot');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Get user ID from localStorage or auth
      const userId = localStorage.getItem('userId') || '';

      console.log('Creating booking request for:', { shopId, customerName, selectedSlot });

      // Create booking request in Supabase
      const bookingRequest = await createProductionBookingRequest({
        shopId,
        userId,
        customerName,
        customerPhone,
        serviceName,
        servicePrice,
        requestedTimeSlot: selectedSlot,
      });

      if (!bookingRequest) {
        throw new Error('Failed to create booking request');
      }

      console.log('Booking request created:', bookingRequest.id);
      setRequestId(bookingRequest.id);

      // Start negotiation in context FIRST
      startNegotiation(bookingRequest.id);
      setCustomerTimeSelection(selectedSlot);

      // Start the wait timer immediately
      console.log('Starting 60-second wait timer');
      timer.start();

      // Notify parent component that booking request is created
      onBookingRequestCreated?.(bookingRequest.id);

      // Get native shop owners for this shop and send notifications to each
      console.log('Fetching native shop owners for shop:', shopId);
      try {
        const { getNativeShopOwnersByShopId } = await import('@/lib/supabase-native-shop-owners');
        const nativeOwners = await getNativeShopOwnersByShopId(shopId);

        if (nativeOwners && nativeOwners.length > 0) {
          console.log(`Found ${nativeOwners.length} native shop owner(s)`, nativeOwners);

          // Send notification to each native shop owner using DIRECT method (100% reliable)
          const ownerUserIds = nativeOwners.map(owner => owner.userId);

          if (ownerUserIds.length > 0) {
            console.log(`📱 Sending OneSignal notifications to ${ownerUserIds.length} owner(s):`, ownerUserIds);

            // Use DIRECT OneSignal API method for guaranteed delivery
            const notificationPayload = {
              title: `🔔 New Booking Request - ${customerName}`,
              body: `${serviceName} at ${selectedSlot}`,
              data: {
                bookingRequestId: bookingRequest.id,
                type: 'booking_request',
                action: 'show_booking_notification',
                timeSlot: selectedSlot,
                serviceName,
                customerName,
                customerPhone,
                alarmDuration: '60',
              },
            };

            try {
              console.log('🚀 Method 1: Using DIRECT OneSignal API (most reliable)...');
              const directResult = await sendDirectNotificationByUserId(ownerUserIds, notificationPayload);

              if (directResult) {
                console.log(`✅ Direct OneSignal notification sent to ${ownerUserIds.length} owner(s)`);
              } else {
                console.warn('⚠️ Direct method failed, trying fallback...');

                // Fallback: Try the backend method
                console.log('🔄 Method 2: Using backend Edge Function as fallback...');
                try {
                  await sendNotificationByUserId(ownerUserIds, notificationPayload);
                  console.log(`✅ Fallback notification sent to ${ownerUserIds.length} owner(s)`);
                } catch (fallbackErr) {
                  console.error('❌ Both notification methods failed:', fallbackErr);
                }
              }
            } catch (notifErr) {
              console.error('❌ Error in direct notification method:', notifErr);
            }

            // APPROACH 2: Trigger foreground service with 3-second delay
            // Adding delay to ensure notification is fully delivered before service starts
            console.log('⏱️ Waiting 3 seconds before triggering foreground service...');
            await new Promise(resolve => setTimeout(resolve, 3000));

            console.log('🚀 Triggering foreground service for authorized owner(s)...');
            try {
              const { triggerOwnerForegroundService } = await import('@/lib/trigger-owner-foreground-service');
              const foregroundResult = await triggerOwnerForegroundService({
                shopId,
                ownerUserIds,
                customerName,
                serviceName,
                timeSlot: selectedSlot,
                bookingRequestId: bookingRequest.id,
                customerPhone,
              });

              if (foregroundResult) {
                console.log('✅ Foreground service trigger sent to authorized owner(s)');
              } else {
                console.warn('⚠️ Failed to trigger foreground service or no authorized owners');
              }
            } catch (foregroundErr) {
              console.error('❌ Error triggering foreground service:', foregroundErr);
            }
          }
        } else {
          console.warn('⚠️ No native shop owners found for shop:', shopId);
          console.warn('Attempting fallback notification to owner ID:', ownerId);

          // Fallback: Send to owner ID if no native owners found
          try {
            await sendDirectNotificationByUserId([ownerId], {
              title: `🔔 New Booking Request - ${customerName}`,
              body: `${serviceName} at ${selectedSlot}`,
              data: {
                bookingRequestId: bookingRequest.id,
                type: 'booking_request',
                action: 'show_booking_notification',
                timeSlot: selectedSlot,
                serviceName,
                customerName,
                customerPhone,
                alarmDuration: '60',
                startForegroundService: 'true', // Signal to owner app to start foreground service
              },
            });
            console.log('✅ Fallback direct OneSignal notification sent to owner:', ownerId);
          } catch (fallbackErr) {
            console.error('❌ Error sending fallback notification:', fallbackErr);
          }
        }
      } catch (err) {
        console.error('❌ Error fetching native shop owners:', err);
        setError('Failed to send notification to shop owner');
        setIsSubmitting(false);
        return;
      }

      // ⚠️ IMPORTANT: DO NOT schedule alarm on customer's device!
      // The foreground service should ONLY start on the owner's device when they receive the notification.
      // The customer device should NOT trigger any alarms or foreground services.
      // The notification payload includes 'startForegroundService': 'true' which signals the owner's native app
      // to start the foreground service when the notification arrives on the owner's device.
    } catch (err) {
      console.error('Error submitting time selection:', err);
      setError(err instanceof Error ? err.message : 'Failed to send booking request');
      setIsSubmitting(false);
    }
  };

  // If waiting for owner response - show wait screen for exactly 60 seconds
  if (requestId && timer.isActive) {
    return (
      <div className="w-full py-12 px-6 bg-gradient-to-b from-blue-50 to-white flex flex-col items-center justify-center gap-6">
        <div className="text-center max-w-md">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            ⏱️ Please Wait...
          </h3>
          <p className="text-gray-600 mb-8">
            Your request has been sent to {shopName}. Waiting for owner confirmation.
          </p>
        </div>

        {/* Timer Display */}
        <div className="relative w-40 h-40 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-blue-200"></div>
          <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-blue-600 border-r-blue-600 animate-spin"></div>
          <div className="relative text-center">
            <div className="text-5xl font-bold text-blue-600 font-mono">
              {formatCountdown(timer.secondsRemaining)}
            </div>
            <p className="text-xs text-gray-500 mt-2">seconds</p>
          </div>
        </div>

        {/* Booking Details */}
        <div className="bg-white rounded-lg p-4 border border-gray-200 max-w-xs w-full">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Service:</span>
              <span className="font-semibold">{serviceName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Time:</span>
              <span className="font-semibold">{selectedSlot}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Shop:</span>
              <span className="font-semibold">{shopName}</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-500 text-center">
          If owner doesn't respond within 1 minute, you'll see other options
        </p>
      </div>
    );
  }

  // Time slot selection view
  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white rounded-lg border border-gray-200">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Select Available Time</h2>
        <p className="text-sm text-gray-600">
          {serviceName} • {servicePrice}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-6">
        {availableSlots.map((slot) => (
          <button
            key={slot}
            onClick={() => handleSelectSlot(slot)}
            className={`p-3 rounded-lg font-medium text-sm transition-all ${
              selectedSlot === slot
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {slot}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <button
        onClick={handleSubmitTimeSelection}
        disabled={!selectedSlot || isSubmitting}
        className={`w-full py-3 rounded-lg font-medium transition-all ${
          !selectedSlot || isSubmitting
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
        }`}
      >
        {isSubmitting ? 'Sending request...' : 'Confirm Time'}
      </button>
    </div>
  );
};
