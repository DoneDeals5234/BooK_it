import React, { useState, useEffect } from 'react';
import { useRealTimeNegotiation } from '@/contexts/RealTimeNegotiationContext';
import { useCountdownTimer, formatCountdown } from '@/lib/use-countdown-timer';
import { updateBookingRequestStatus } from '@/lib/supabase-bookings';
import { sendNotificationToCurrentDevice } from '@/lib/onesignal-messaging';
import { Bell } from 'lucide-react';

interface OwnerBookingNotificationProps {
  bookingRequestId: string;
  customerName: string;
  serviceName: string;
  requestedTimeSlot: string;
  customerPhone: string;
  onConfirm?: () => void;
  onReject?: () => void;
  onOfferAlternative?: () => void;
  onExpired?: () => void;
}

export const OwnerBookingNotification: React.FC<OwnerBookingNotificationProps> = ({
  bookingRequestId,
  customerName,
  serviceName,
  requestedTimeSlot,
  customerPhone,
  onConfirm,
  onReject,
  onOfferAlternative,
  onExpired,
}) => {
  const { setOwnerResponse } = useRealTimeNegotiation();
  const [isResponding, setIsResponding] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);

  const timer = useCountdownTimer({
    duration: 60 * 1000, // 1 minute
    autoStart: true,
    onExpire: () => {
      onExpired?.();
    },
  });

  const handleConfirm = async () => {
    setSelectedAction('confirm');
    setIsResponding(true);

    try {
      await updateBookingRequestStatus(bookingRequestId, 'owner_confirmed');
      setOwnerResponse('confirmed');
      onConfirm?.();
    } catch (err) {
      console.error('Error confirming booking:', err);
      setIsResponding(false);
      setSelectedAction(null);
    }
  };

  const handleReject = async () => {
    setSelectedAction('reject');
    setIsResponding(true);

    try {
      await updateBookingRequestStatus(bookingRequestId, 'owner_rejected');
      setOwnerResponse('rejected');

      // Notify customer that booking was rejected
      await sendNotificationToCurrentDevice({
        title: 'Booking Rejected',
        body: `The owner rejected your booking request for ${serviceName}. You may receive an alternative time offer.`,
        data: {
          bookingRequestId,
          type: 'booking_rejected',
        },
      });

      // After rejection, allow owner to offer alternative times
      setTimeout(() => {
        onReject?.();
      }, 1000);
    } catch (err) {
      console.error('Error rejecting booking:', err);
      setIsResponding(false);
      setSelectedAction(null);
    }
  };

  const handleOfferAlternative = () => {
    setSelectedAction('offer');
    setIsResponding(false);
    onOfferAlternative?.();
  };

  if (selectedAction === 'confirm' && isResponding) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-8 max-w-md w-full shadow-2xl">
          <div className="text-center">
            <div className="mb-4">
              <svg className="animate-spin h-12 w-12 text-green-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirming Booking</h3>
            <p className="text-sm text-gray-600">
              Sending confirmation to {customerName}...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[999] p-4">
      {/* Animated background pulse */}
      <div className="absolute inset-0 animate-pulse bg-red-500 opacity-10"></div>

      <div className="relative bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl border-4 border-red-600 overflow-hidden">
        {/* Animated border glow */}
        <div className="absolute inset-0 rounded-2xl border-4 border-red-500 animate-pulse"></div>

        <div className="relative z-10">
          {/* Alarm Icon with Animation */}
          <div className="flex items-center justify-center mb-6">
            <div className="relative">
              <Bell className="w-12 h-12 text-red-600 animate-bounce" />
              <div className="absolute inset-0 rounded-full border-2 border-red-600 animate-ping"></div>
            </div>
          </div>

          {/* Header with Timer */}
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-red-600 mb-2">🔔 BOOKING REQUEST!</h2>
            <div className="text-5xl font-bold font-mono text-red-600 py-4">
              {formatCountdown(timer.secondsRemaining)}
            </div>
            <p className="text-sm text-gray-600">Respond within 1 minute</p>
          </div>

          {/* Customer Info Card */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 mb-6 border-2 border-blue-300">
            <p className="text-sm text-gray-700 mb-4">
              <span className="text-lg font-bold text-gray-900">{customerName}</span>
              <span className="text-gray-600"> wants to book:</span>
            </p>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between bg-white rounded-lg p-3">
                <span className="text-gray-600 font-medium">Service:</span>
                <span className="font-bold text-gray-900">{serviceName}</span>
              </div>

              <div className="flex items-center justify-between bg-white rounded-lg p-3">
                <span className="text-gray-600 font-medium">Time:</span>
                <span className="font-bold text-gray-900 text-lg">{requestedTimeSlot}</span>
              </div>

              <div className="flex items-center justify-between bg-white rounded-lg p-3">
                <span className="text-gray-600 font-medium">Phone:</span>
                <span className="font-mono text-gray-900">{customerPhone}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleConfirm}
              disabled={isResponding || timer.isExpired}
              className={`w-full py-4 rounded-xl font-bold text-lg text-white transition-all transform ${
                isResponding || timer.isExpired
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 hover:scale-105 shadow-lg active:scale-95'
              }`}
            >
              ✅ CONFIRM BOOKING
            </button>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleReject}
                disabled={isResponding || timer.isExpired}
                className={`py-3 rounded-lg font-bold transition-all transform ${
                  isResponding || timer.isExpired
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-red-600 text-white hover:bg-red-700 hover:scale-105 shadow-lg active:scale-95'
                }`}
              >
                ❌ Reject
              </button>

              <button
                onClick={handleOfferAlternative}
                disabled={isResponding || timer.isExpired}
                className={`py-3 rounded-lg font-bold transition-all transform ${
                  isResponding || timer.isExpired
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-orange-600 text-white hover:bg-orange-700 hover:scale-105 shadow-lg active:scale-95'
                }`}
              >
                ⏱️ Offer Time
              </button>
            </div>
          </div>

          {timer.isExpired && (
            <div className="mt-6 p-4 bg-red-100 border border-red-300 rounded-lg text-center">
              <p className="text-sm font-semibold text-red-700">
                ⏰ Response time expired. Customer will be notified.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
