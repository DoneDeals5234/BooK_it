import React, { useState } from 'react';
import { useRealTimeNegotiation } from '@/contexts/RealTimeNegotiationContext';
import { useCountdownTimer, formatCountdown } from '@/lib/use-countdown-timer';
import { updateBookingRequestStatus } from '@/lib/supabase-bookings';
import { notifyBookingRejected } from '@/lib/booking-negotiation-notifications';
import { Bell } from 'lucide-react';

interface OwnerBookingNotificationProps {
  bookingRequestId: string;
  customerName: string;
  serviceName: string;
  requestedTimeSlot: string;
  customerPhone: string;
  customerId?: string; // Added customerId
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
  customerId,
  onConfirm,
  onReject,
  onOfferAlternative,
  onExpired,
}) => {
  const { setOwnerResponse } = useRealTimeNegotiation();
  const [isResponding, setIsResponding] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);

  const timer = useCountdownTimer({
    duration: 60 * 1000,
    autoStart: true,
    onExpire: () => onExpired?.(),
  });

  const handleConfirm = async () => {
    setSelectedAction('confirm');
    setIsResponding(true);
    try {
      await updateBookingRequestStatus(bookingRequestId, 'owner_confirmed');
      setOwnerResponse('confirmed');
      onConfirm?.();
    } catch (err) {
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

      if (customerId) {
        await notifyBookingRejected({
          customerId,
          shopName: 'The Shop',
          serviceName,
          bookingRequestId
        });
      }

      setTimeout(() => onReject?.(), 1000);
    } catch (err) {
      setIsResponding(false);
      setSelectedAction(null);
    }
  };

  const handleOfferAlternative = () => {
    setSelectedAction('offer');
    onOfferAlternative?.();
  };

  if (selectedAction === 'confirm' && isResponding) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-8 max-w-md w-full shadow-2xl text-center">
          <div className="mb-4"><Bell className="animate-spin h-12 w-12 text-green-500 mx-auto" /></div>
          <h3 className="text-lg font-semibold mb-2">Confirming Booking</h3>
          <p className="text-sm text-gray-600">Sending confirmation to {customerName}...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[999] p-4">
      <div className="relative bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl border-4 border-red-600">
        <div className="flex items-center justify-center mb-6">
          <Bell className="w-12 h-12 text-red-600 animate-bounce" />
        </div>
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-red-600 mb-2">🔔 BOOKING REQUEST!</h2>
          <div className="text-5xl font-bold font-mono text-red-600 py-4">{formatCountdown(timer.secondsRemaining)}</div>
        </div>
        <div className="bg-blue-50 rounded-xl p-5 mb-6 border-2 border-blue-300">
          <p className="font-bold text-gray-900 mb-4">{customerName} wants {serviceName}</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between bg-white p-3 rounded"><span>Time:</span><span className="font-bold">{requestedTimeSlot}</span></div>
          </div>
        </div>
        <div className="space-y-3">
          <button onClick={handleConfirm} disabled={isResponding || timer.isExpired} className="w-full py-4 rounded-xl font-bold text-lg text-white bg-green-600 hover:bg-green-700">✅ CONFIRM</button>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={handleReject} disabled={isResponding || timer.isExpired} className="py-3 rounded-lg font-bold bg-red-600 text-white">❌ Reject</button>
            <button onClick={handleOfferAlternative} disabled={isResponding || timer.isExpired} className="py-3 rounded-lg font-bold bg-orange-600 text-white">⏱️ Offer Time</button>
          </div>
        </div>
      </div>
    </div>
  );
};
