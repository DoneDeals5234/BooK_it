import React, { useState, useEffect } from 'react';
import { useRealTimeNegotiation } from '@/contexts/RealTimeNegotiationContext';
import { useCountdownTimer, formatCountdown } from '@/lib/use-countdown-timer';
import { createProductionBookingRequest } from '@/lib/supabase-bookings';
import { notifyOwnerOfBookingRequest } from '@/lib/booking-negotiation-notifications';

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
  shopId, shopName, serviceName, servicePrice, availableSlots, ownerId, customerName, customerPhone, onAlarmReceived, preSelectedTimeSlot, onBookingRequestCreated
}) => {
  const { setCustomerTimeSelection, startNegotiation } = useRealTimeNegotiation();
  const [selectedSlot, setSelectedSlot] = useState<string | null>(preSelectedTimeSlot || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);

  const timer = useCountdownTimer({
    duration: 60 * 1000,
    onExpire: () => onAlarmReceived?.(),
  });

  useEffect(() => {
    if (preSelectedTimeSlot && !requestId && !isSubmitting) handleSubmit();
  }, [preSelectedTimeSlot]);

  const handleSubmit = async () => {
    if (!selectedSlot) return;
    setIsSubmitting(true);
    try {
      const userId = localStorage.getItem('userId') || '';
      const request = await createProductionBookingRequest({
        shopId, userId, customerName, customerPhone, serviceName, servicePrice, requestedTimeSlot: selectedSlot
      });

      if (!request) throw new Error('Failed');
      
      setRequestId(request.id);
      startNegotiation(request.id);
      setCustomerTimeSelection(selectedSlot);
      timer.start();
      onBookingRequestCreated?.(request.id);

      // Notify owner using centralized reliable utility
      await notifyOwnerOfBookingRequest({
        ownerId,
        customerName,
        serviceName,
        requestedTime: selectedSlot,
        bookingRequestId: request.id
      });

    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
    }
  };

  if (requestId && timer.isActive) {
    return (
      <div className="w-full py-12 px-6 flex flex-col items-center justify-center gap-6 text-center">
        <h3 className="text-2xl font-bold">⏱️ Waiting for {shopName}...</h3>
        <div className="relative w-32 h-32 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin"></div>
          <span className="text-4xl font-bold text-blue-600 font-mono">{formatCountdown(timer.secondsRemaining)}</span>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg border w-full max-w-xs">
          <p className="text-sm"><b>{serviceName}</b> at <b>{selectedSlot}</b></p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg border max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-4">Select Time</h2>
      <div className="grid grid-cols-3 gap-2 mb-6">
        {availableSlots.map(slot => (
          <button key={slot} onClick={() => setSelectedSlot(slot)} className={`p-3 rounded-lg text-sm font-medium ${selectedSlot === slot ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>{slot}</button>
        ))}
      </div>
      <button onClick={handleSubmit} disabled={!selectedSlot || isSubmitting} className="w-full py-3 rounded-lg font-bold bg-blue-600 text-white disabled:bg-gray-300">
        {isSubmitting ? 'Sending...' : 'Confirm Time'}
      </button>
    </div>
  );
};
