import React, { useState } from 'react';
import { useRealTimeNegotiation } from '@/contexts/RealTimeNegotiationContext';
import { useCountdownTimer, formatCountdown } from '@/lib/use-countdown-timer';
import { updateNegotiationResponse } from '@/lib/supabase-bookings';
import { sendNativeNotification } from '@/lib/native-notifications';

interface CustomerOfferResponseProps {
  negotiationId: string;
  offeredTimes: string[];
  serviceName: string;
  ownerId?: string; // Added ownerId
  ownerName?: string;
  onAccepted?: (selectedTime: string) => void;
  onRejected?: () => void;
  onExpired?: () => void;
}

export const CustomerOfferResponse: React.FC<CustomerOfferResponseProps> = ({
  negotiationId,
  offeredTimes,
  serviceName,
  ownerId,
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
    duration: 60 * 1000,
    autoStart: true,
    onExpire: () => onExpired?.(),
  });

  const handleAccept = async () => {
    if (!selectedTime) return;
    setSelectedAction('accept');
    setIsResponding(true);
    try {
      await updateNegotiationResponse(negotiationId, 'accepted');
      setCustomerResponseToOffer('accepted');
      setFinalBookingTime(selectedTime);

      if (ownerId) {
        await sendNativeNotification([ownerId], {
          title: 'Booking Accepted',
          body: `Customer accepted offer for ${serviceName} at ${selectedTime}`,
          data: { type: 'offer_accepted', negotiationId, selectedTime }
        });
      }
      onAccepted?.(selectedTime);
    } catch (err) {
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

      if (ownerId) {
        await sendNativeNotification([ownerId], {
          title: 'Offer Rejected',
          body: `Customer rejected time offer for ${serviceName}`,
          data: { type: 'offer_rejected', negotiationId }
        });
      }
      onRejected?.();
    } catch (err) {
      setIsResponding(false);
      setSelectedAction(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl border-4 border-orange-500">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-orange-600">New Times Offered!</h2>
          <div className="text-2xl font-bold font-mono text-orange-600">{formatCountdown(timer.secondsRemaining)}</div>
        </div>
        <div className="bg-orange-50 rounded-lg p-4 mb-6">
          <p className="text-sm mb-4"><span className="font-semibold">{ownerName}</span> offers these times for {serviceName}:</p>
          <div className="space-y-2">
            {offeredTimes.map((time) => (
              <label key={time} className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${selectedTime === time ? 'border-orange-500 bg-orange-100' : 'border-gray-200'}`}>
                <input type="radio" name="offeredTime" value={time} checked={selectedTime === time} onChange={(e) => setSelectedTime(e.target.value)} className="w-4 h-4" />
                <span className="ml-3 font-medium">{time}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <button onClick={handleAccept} disabled={isResponding || timer.isExpired || !selectedTime} className="w-full py-3 rounded-lg font-semibold text-white bg-green-600 hover:bg-green-700">✓ Accept Time</button>
          <button onClick={handleReject} disabled={isResponding || timer.isExpired} className="w-full py-3 rounded-lg font-semibold text-white bg-red-600 hover:bg-red-700">✗ Reject</button>
        </div>
      </div>
    </div>
  );
};
