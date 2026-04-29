import React, { useState } from 'react';
import { useRealTimeNegotiation } from '@/contexts/RealTimeNegotiationContext';
import { useCountdownTimer, formatCountdown } from '@/lib/use-countdown-timer';
import { updateNegotiationResponse } from '@/lib/supabase-bookings';
import { sendNotificationToCurrentDevice } from '@/lib/onesignal-messaging';

interface CustomerOfferResponseProps {
  negotiationId: string;
  offeredTimes: string[];
  serviceName: string;
  ownerName?: string;
  onAccepted?: (selectedTime: string) => void;
  onRejected?: () => void;
  onExpired?: () => void;
}

export const CustomerOfferResponse: React.FC<CustomerOfferResponseProps> = ({
  negotiationId,
  offeredTimes,
  serviceName,
  ownerName = 'Owner',
  onAccepted,
  onRejected,
  onExpired,
}) => {
  const { setCustomerResponseToOffer, setFinalBookingTime } = useRealTimeNegotiation();
  const [selectedTime, setSelectedTime] = useState<string | null>(offeredTimes[0] || null);
  const [isResponding, setIsResponding] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);

  const timer = useCountdownTimer({
    duration: 60 * 1000, // 1 minute
    autoStart: true,
    onExpire: () => {
      onExpired?.();
    },
  });

  const handleAccept = async () => {
    if (!selectedTime) return;

    setSelectedAction('accept');
    setIsResponding(true);

    try {
      await updateNegotiationResponse(negotiationId, 'accepted');
      setCustomerResponseToOffer('accepted');
      setFinalBookingTime(selectedTime);

      // Notify owner about acceptance
      await sendNotificationToCurrentDevice({
        title: 'Booking Accepted',
        body: `Customer accepted your offer for ${serviceName} at ${selectedTime}`,
        data: {
          negotiationId,
          type: 'offer_accepted',
          selectedTime,
        },
      });

      onAccepted?.(selectedTime);
    } catch (err) {
      console.error('Error accepting offer:', err);
      setIsResponding(false);
      setSelectedAction(null);
    }
  };

  const handleReject = async () => {
    setSelectedAction('reject');
    setIsResponding(true);

    try {
      await updateNegotiationResponse(negotiationId, 'rejected');
      setCustomerResponseToOffer('rejected');

      // Notify owner about rejection
      await sendNotificationToCurrentDevice({
        title: 'Offer Rejected',
        body: `Customer rejected your time offer for ${serviceName}`,
        data: {
          negotiationId,
          type: 'offer_rejected',
        },
      });

      onRejected?.();
    } catch (err) {
      console.error('Error rejecting offer:', err);
      setIsResponding(false);
      setSelectedAction(null);
    }
  };

  if (selectedAction === 'accept' && isResponding) {
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirming Your Choice</h3>
            <p className="text-sm text-gray-600">
              Notifying {ownerName}...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-pulse">
      <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl border-4 border-orange-500 animate-bounce">
        {/* Timer Display */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-orange-600">Alternative Times Offered!</h2>
            <div className="text-2xl font-bold font-mono text-orange-600">
              {formatCountdown(timer.secondsRemaining)}
            </div>
          </div>
        </div>

        {/* Offer Details */}
        <div className="bg-orange-50 rounded-lg p-4 mb-6 border border-orange-200">
          <p className="text-sm text-gray-700 mb-4">
            <span className="font-semibold">{ownerName}</span> offers these times for:
          </p>
          <p className="text-sm font-medium text-gray-900 mb-4">{serviceName}</p>

          <div className="space-y-2">
            {offeredTimes.map((time) => (
              <label key={time} className="flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all" style={{
                borderColor: selectedTime === time ? '#f97316' : '#e5e7eb',
                backgroundColor: selectedTime === time ? '#fed7aa' : '#fafafa'
              }}>
                <input
                  type="radio"
                  name="offeredTime"
                  value={time}
                  checked={selectedTime === time}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="w-4 h-4 cursor-pointer"
                />
                <span className="ml-3 font-medium text-gray-900">{time}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleAccept}
            disabled={isResponding || timer.isExpired || !selectedTime}
            className={`w-full py-3 rounded-lg font-semibold text-white transition-all ${
              isResponding || timer.isExpired || !selectedTime
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 shadow-lg'
            }`}
          >
            ✓ Accept Time
          </button>

          <button
            onClick={handleReject}
            disabled={isResponding || timer.isExpired}
            className={`w-full py-3 rounded-lg font-semibold transition-all ${
              isResponding || timer.isExpired
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-red-600 text-white hover:bg-red-700 shadow-lg'
            }`}
          >
            ✗ Reject
          </button>
        </div>

        {timer.isExpired && (
          <p className="mt-4 text-xs text-center text-gray-500">
            Response time expired. Booking cancelled.
          </p>
        )}
      </div>
    </div>
  );
};
