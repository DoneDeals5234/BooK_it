import React, { useState } from 'react';
import { updateBookingRequestStatus } from '@/lib/supabase-bookings';
import { sendNotificationToCurrentDevice } from '@/lib/onesignal-messaging';

interface OwnerNotRespondingPopupProps {
  bookingRequestId: string;
  customerName: string;
  ownerPhone?: string;
  serviceName: string;
  requestedTime: string;
  shopId?: string;
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

    // Open phone dialer
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

      // Notify owner that customer cancelled the booking request
      if (shopId) {
        await sendNotificationToCurrentDevice({
          title: 'Booking Request Cancelled',
          body: `${customerName} cancelled their booking request for ${serviceName}`,
          data: {
            bookingRequestId,
            type: 'booking_cancelled',
            cancelledBy: 'customer',
          },
        });
      }

      onCancel?.();
    } catch (err) {
      console.error('Error cancelling booking:', err);
      setIsProcessing(false);
      setSelectedAction(null);
    }
  };

  if (selectedAction === 'cancel' && isProcessing) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-8 max-w-md w-full shadow-2xl">
          <div className="text-center">
            <div className="mb-4">
              <svg className="h-12 w-12 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Booking Cancelled</h3>
            <p className="text-sm text-gray-600">
              Your booking request has been cancelled. You can try again later.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl border-2 border-red-300">
        {/* Alert Header */}
        <div className="mb-6 text-center">
          <div className="mb-4">
            <svg className="h-16 w-16 text-red-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {isRejection ? 'Booking Rejected' : 'Owner Not Responding'}
          </h2>
          <p className="text-sm text-gray-600">
            {isRejection
              ? 'The owner declined your booking request for the selected time.'
              : 'We couldn\'t reach the owner for your booking request.'}
          </p>
        </div>

        {/* Request Summary */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-600">Service:</span>
              <span className="font-medium text-gray-900 ml-2 block">{serviceName}</span>
            </div>
            <div>
              <span className="text-gray-600">Requested Time:</span>
              <span className="font-medium text-gray-900 ml-2 block">{requestedTime}</span>
            </div>
          </div>
        </div>

        {/* Action Text */}
        <p className="text-sm text-gray-700 mb-6">
          {isRejection
            ? 'You can try a different time slot or cancel this booking request.'
            : 'You can try calling the owner directly or cancel this booking request.'}
        </p>

        {/* Action Buttons */}
        <div className="space-y-3">
          {isRejection && onRetryBooking && (
            <button
              onClick={onRetryBooking}
              disabled={isProcessing}
              className={`w-full py-3 rounded-lg font-semibold text-white transition-all flex items-center justify-center gap-2 ${
                isProcessing
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-lg'
              }`}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Try Different Time
            </button>
          )}

          {!isRejection && ownerPhone && (
            <button
              onClick={handleCall}
              disabled={isProcessing}
              className={`w-full py-3 rounded-lg font-semibold text-white transition-all flex items-center justify-center gap-2 ${
                isProcessing
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 shadow-lg'
              }`}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773c.058.3.196.625.461.9.265.274.586.411.9.411.081 0 .162-.005.24-.015l1.05-.147c.695-.098 1.359-.338 1.974-.71a5.999 5.999 0 003.526-3.526c.372-.615.612-1.279.71-1.974l.147-1.05c.01-.078.015-.159.015-.24 0-.314-.137-.635-.411-.9-.275-.265-.6-.403-.9-.461l-.773 1.548a1 1 0 01-1.06.54L6.268 3.54a1 1 0 01-.836-.986L2 3z" />
              </svg>
              Call Owner
            </button>
          )}

          <button
            onClick={handleCancel}
            disabled={isProcessing}
            className={`w-full py-3 rounded-lg font-semibold transition-all ${
              isProcessing
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-red-600 text-white hover:bg-red-700 shadow-lg'
            }`}
          >
            Cancel Request
          </button>
        </div>

        {!isRejection && !ownerPhone && (
          <p className="mt-4 text-xs text-center text-gray-500">
            Owner contact information not available for direct calling.
          </p>
        )}
      </div>
    </div>
  );
};
