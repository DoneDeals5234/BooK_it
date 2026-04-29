import React, { useState } from 'react';
import { useRealTimeNegotiation } from '@/contexts/RealTimeNegotiationContext';
import { createOwnerCounterOffer } from '@/lib/supabase-bookings';
import { sendNotificationByUserId } from '@/lib/onesignal-messaging';
import { useAuth } from '@/contexts/AuthContext';

interface OwnerOfferTimeSelectionProps {
  bookingRequestId: string;
  customerName: string;
  serviceName: string;
  availableSlots: string[];
  customerId?: string;
  onOfferSent?: () => void;
  onCancel?: () => void;
}

export const OwnerOfferTimeSelection: React.FC<OwnerOfferTimeSelectionProps> = ({
  bookingRequestId,
  customerName,
  serviceName,
  availableSlots,
  customerId,
  onOfferSent,
  onCancel,
}) => {
  const { setOwnerOfferedTimes } = useRealTimeNegotiation();
  const { user } = useAuth();
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [customTime, setCustomTime] = useState<string>('');
  const [useCustom, setUseCustom] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggleSlot = (slot: string) => {
    if (selectedSlots.includes(slot)) {
      setSelectedSlots(selectedSlots.filter((s) => s !== slot));
    } else {
      setSelectedSlots([...selectedSlots, slot]);
    }
  };

  const handleSubmitOffer = async () => {
    const timesToOffer = useCustom && customTime ? [customTime] : selectedSlots;

    if (timesToOffer.length === 0) {
      setError('Please select at least one time or enter a custom time');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Create counter-offer in Supabase
      const negotiation = await createOwnerCounterOffer(bookingRequestId, timesToOffer);

      if (!negotiation) {
        throw new Error('Failed to create counter-offer');
      }

      // Update context
      setOwnerOfferedTimes(timesToOffer);

      // Notify customer about the offer using their user ID
      if (customerId) {
        await sendNotificationByUserId(customerId, {
          title: 'Alternative Time Offered',
          body: `${serviceName} available at: ${timesToOffer.join(', ')}`,
          data: {
            bookingRequestId,
            type: 'time_offer',
            action: 'offer_notification',
            offeredTimes: JSON.stringify(timesToOffer),
            alarmDuration: '60', // 1 minute
          },
        });
      }

      onOfferSent?.();
    } catch (err) {
      console.error('Error submitting offer:', err);
      setError(err instanceof Error ? err.message : 'Failed to send offer');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Offer Alternative Time</h3>
          <p className="text-sm text-gray-600">
            Suggest a time to {customerName} for {serviceName}
          </p>
        </div>

        {/* Available Slots */}
        <div className="mb-6">
          <div className="flex items-center mb-3">
            <input
              type="radio"
              id="useSlots"
              name="timeOption"
              checked={!useCustom}
              onChange={() => setUseCustom(false)}
              className="w-4 h-4 cursor-pointer"
            />
            <label htmlFor="useSlots" className="ml-2 text-sm font-medium text-gray-700 cursor-pointer">
              From Available Slots
            </label>
          </div>

          {!useCustom && (
            <div className="grid grid-cols-3 gap-2 mb-4">
              {availableSlots.map((slot) => (
                <button
                  key={slot}
                  onClick={() => handleToggleSlot(slot)}
                  className={`p-2 rounded text-sm font-medium transition-all ${
                    selectedSlots.includes(slot)
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Custom Time */}
        <div className="mb-6">
          <div className="flex items-center mb-3">
            <input
              type="radio"
              id="useCustom"
              name="timeOption"
              checked={useCustom}
              onChange={() => setUseCustom(true)}
              className="w-4 h-4 cursor-pointer"
            />
            <label htmlFor="useCustom" className="ml-2 text-sm font-medium text-gray-700 cursor-pointer">
              Custom Time
            </label>
          </div>

          {useCustom && (
            <input
              type="time"
              value={customTime}
              onChange={(e) => setCustomTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 py-2 rounded-lg font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmitOffer}
            disabled={isSubmitting}
            className="flex-1 py-2 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'Sending...' : 'Send Offer'}
          </button>
        </div>
      </div>
    </div>
  );
};
