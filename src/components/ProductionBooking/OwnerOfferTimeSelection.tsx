import React, { useState } from 'react';
import { useRealTimeNegotiation } from '@/contexts/RealTimeNegotiationContext';
import { createOwnerCounterOffer } from '@/lib/supabase-bookings';
import { notifyCustomerOfTimeOffer } from '@/lib/booking-negotiation-notifications';

interface OwnerOfferTimeSelectionProps {
  bookingRequestId: string;
  customerName: string;
  serviceName: string;
  availableSlots: string[];
  customerId?: string;
  ownerName?: string;
  onOfferSent?: () => void;
  onCancel?: () => void;
}

export const OwnerOfferTimeSelection: React.FC<OwnerOfferTimeSelectionProps> = ({
  bookingRequestId, customerName, serviceName, availableSlots, customerId, ownerName = 'Owner', onOfferSent, onCancel
}) => {
  const { setOwnerOfferedTimes } = useRealTimeNegotiation();
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleToggleSlot = (slot: string) => {
    setSelectedSlots(prev => prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot]);
  };

  const handleSubmit = async () => {
    if (selectedSlots.length === 0) return;
    setIsSubmitting(true);
    try {
      const negotiation = await createOwnerCounterOffer(bookingRequestId, selectedSlots);
      if (!negotiation) throw new Error('Failed');
      
      setOwnerOfferedTimes(selectedSlots);
      if (customerId) {
        await notifyCustomerOfTimeOffer({
          customerId, ownerName, serviceName, offeredTimes: selectedSlots, negotiationId: negotiation.id
        });
      }
      onOfferSent?.();
    } catch (err) {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl">
        <h3 className="text-lg font-bold mb-4">Offer Different Times</h3>
        <p className="text-sm text-gray-600 mb-6">Suggest times to {customerName} for {serviceName}</p>
        <div className="grid grid-cols-3 gap-2 mb-8">
          {availableSlots.map(slot => (
            <button key={slot} onClick={() => handleToggleSlot(slot)} className={`p-2 rounded text-sm font-medium ${selectedSlots.includes(slot) ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>{slot}</button>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2 rounded-lg bg-gray-100 font-medium">Cancel</button>
          <button onClick={handleSubmit} disabled={selectedSlots.length === 0 || isSubmitting} className="flex-1 py-2 rounded-lg bg-blue-600 text-white font-medium disabled:bg-gray-300">
            {isSubmitting ? 'Sending...' : 'Send Offer'}
          </button>
        </div>
      </div>
    </div>
  );
};
