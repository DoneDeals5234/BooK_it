import React, { useState } from 'react';
import { updateBookingRequestStatus } from '@/lib/supabase-bookings';
import { sendNativeNotification } from '@/lib/native-notifications';

interface OwnerNotRespondingPopupProps {
  bookingRequestId: string;
  customerName: string;
  ownerPhone?: string;
  serviceName: string;
  requestedTime: string;
  ownerId?: string; // Changed from shopId to ownerId
  isRejection?: boolean;
  onCall?: () => void;
  onCancel?: () => void;
  onRetryBooking?: () => void;
}

export const OwnerNotRespondingPopup: React.FC<OwnerNotRespondingPopupProps> = ({
  bookingRequestId,
  customerName,
  ownerPhone,
  serviceName,
  requestedTime,
  ownerId,
  isRejection = false,
  onCall,
  onCancel,
  onRetryBooking,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);

  const handleCall = () => {
    if (!ownerPhone) return;
    setSelectedAction('call');
    setIsProcessing(true);
    if (typeof window !== 'undefined') {
      const phoneNumber = ownerPhone.replace(/[^0-9+]/g, '');
      window.location.href = `tel:${phoneNumber}`;
    }
    onCall?.();
  };

  const handleCancel = async () => {
    setSelectedAction('cancel');
    setIsProcessing(true);
    try {
      await updateBookingRequestStatus(bookingRequestId, 'cancelled');
      if (ownerId) {
        await sendNativeNotification([ownerId], {
          title: 'Booking Request Cancelled',
          body: `${customerName} cancelled their request for ${serviceName}`,
          data: { type: 'booking_cancelled', bookingRequestId, cancelledBy: 'customer' }
        });
      }
      onCancel?.();
    } catch (err) {
      setIsProcessing(false);
      setSelectedAction(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl border-2 border-red-300">
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold mb-2">{isRejection ? 'Booking Rejected' : 'Owner Not Responding'}</h2>
          <p className="text-sm text-gray-600">
            {isRejection ? 'Owner declined your request.' : 'We couldn\'t reach the owner.'}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 mb-6 text-sm">
          <p><span className="text-gray-600">Service:</span> <span className="font-medium">{serviceName}</span></p>
          <p><span className="text-gray-600">Time:</span> <span className="font-medium">{requestedTime}</span></p>
        </div>
        <div className="space-y-3">
          {isRejection && onRetryBooking && (
            <button onClick={onRetryBooking} className="w-full py-3 rounded-lg font-semibold text-white bg-blue-600">Try Different Time</button>
          )}
          {!isRejection && ownerPhone && (
            <button onClick={handleCall} className="w-full py-3 rounded-lg font-semibold text-white bg-green-600">Call Owner</button>
          )}
          <button onClick={handleCancel} className="w-full py-3 rounded-lg font-semibold text-white bg-red-600">Cancel Request</button>
        </div>
      </div>
    </div>
  );
};
