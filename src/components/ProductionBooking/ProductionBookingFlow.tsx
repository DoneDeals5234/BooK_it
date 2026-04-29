import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { RealTimeNegotiationProvider, useRealTimeNegotiation } from '@/contexts/RealTimeNegotiationContext';
import { useNegotiationSubscription, useBookingRequest } from '@/lib/use-negotiation-subscription';
import { useAuth } from '@/contexts/AuthContext';
import type { Shop, Service } from '@/lib/shops-storage';
import { CustomerTimeSlotSelection } from './CustomerTimeSlotSelection';
import { OwnerBookingNotification } from './OwnerBookingNotification';
import { OwnerOfferTimeSelection } from './OwnerOfferTimeSelection';
import { CustomerOfferResponse } from './CustomerOfferResponse';
import { OwnerNotRespondingPopup } from './OwnerNotRespondingPopup';
import { ReminderSettings } from './ReminderSettings';
import {
  notifyOwnerOfBookingRequest,
  notifyCustomerOfTimeOffer,
  notifyCustomerOwnerNotResponding,
  notifyBookingConfirmed,
  notifyBookingRejected,
} from '@/lib/booking-negotiation-notifications';
import { addBookingToSupabase } from '@/lib/supabase-bookings';
import { getCurrentISTDate } from '@/lib/bookings-storage';
import toast from 'react-hot-toast';

interface ProductionBookingFlowProps {
  shop: Shop;
  service: Service;
  availableTimeSlots: string[];
  customerName: string;
  customerPhone: string;
  ownerPhone?: string;
  isOwner?: boolean;
  onClose: () => void;
  onBookingConfirmed?: (bookingId: string) => void;
}

const ProductionBookingFlowContent: React.FC<ProductionBookingFlowProps> = ({
  shop,
  service,
  availableTimeSlots,
  customerName,
  customerPhone,
  ownerPhone,
  isOwner = false,
  onClose,
  onBookingConfirmed,
}) => {
  const { user } = useAuth();
  const { negotiationState, getTimeRemainingSeconds, isCustomerWaitExpired, isOwnerResponseExpired } = useRealTimeNegotiation();
  const { request, negotiation } = useBookingRequest(negotiationState.requestId);
  const [showOwnerNotification, setShowOwnerNotification] = useState(false);
  const [showOfferSelection, setShowOfferSelection] = useState(false);
  const [showOwnerNotRespondingPopup, setShowOwnerNotRespondingPopup] = useState(false);
  const [isCreatingBooking, setIsCreatingBooking] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<{ id: string; time: string; date: string } | null>(null);
  const [rejectionReason, setRejectionReason] = useState<'rejected' | 'timeout' | null>(null);

  // Subscribe to negotiation updates
  useNegotiationSubscription({
    bookingRequestId: negotiationState.requestId || undefined,
    shopId: isOwner ? shop.id : undefined,
    isOwner,
    isCustomer: !isOwner,
    onOwnerRequest: (req) => {
      if (isOwner) {
        setShowOwnerNotification(true);
      }
    },
    onNegotiationUpdate: (neg) => {
      if (!isOwner && neg.offered_by === 'owner') {
        setShowOwnerNotification(false);
      }
    },
    onTimeout: () => {
      if (isOwner) {
        setShowOwnerNotRespondingPopup(true);
      }
    },
  });

  // Handle owner rejection - show rejection popup to customer with retry option
  const handleOwnerReject = () => {
    setShowOwnerNotification(false);
    setRejectionReason('rejected');
    setShowOwnerNotRespondingPopup(true);
  };

  // Handle owner response: confirm
  const handleOwnerConfirm = async () => {
    if (!negotiationState.requestId) return;

    setIsCreatingBooking(true);
    try {
      // Create the actual booking
      const bookingDate = getCurrentISTDate();
      const booking = await addBookingToSupabase({
        shopId: shop.id,
        serviceName: service.name,
        servicePrice: service.price,
        timeSlot: negotiationState.customerTimeSelection || '',
        tokenNumber: Math.floor(Math.random() * 1000),
        userName: customerName,
        userPhone: customerPhone,
        bookingDate: bookingDate,
        status: 'confirmed',
        userId: user?.uid,
      });

      if (booking) {
        await notifyBookingConfirmed({
          customerId: user?.uid,
          shopName: shop.name,
          serviceName: service.name,
          confirmedTime: negotiationState.customerTimeSelection || '',
          bookingRequestId: negotiationState.requestId,
        });

        toast.success('Booking confirmed!');

        // Save confirmed booking to show reminder settings next
        setConfirmedBooking({
          id: booking.id,
          time: negotiationState.customerTimeSelection || '',
          date: bookingDate,
        });
      }
    } catch (err) {
      console.error('Error creating booking:', err);
      toast.error('Failed to confirm booking');
    } finally {
      setIsCreatingBooking(false);
    }
  };

  // Handle owner response: offer alternative (show owner the time selection screen)
  const handleOwnerOfferAlternative = () => {
    setShowOwnerNotification(false);
    setShowOfferSelection(true);
    // Reset rejection reason since we're moving to offer selection
    setRejectionReason(null);
  };

  // Handle owner submits offer
  const handleOfferSubmitted = async () => {
    setShowOfferSelection(false);
    // Customer will receive notification and the flow continues
  };

  // Handle customer accepts offer
  const handleCustomerAcceptsOffer = async (selectedTime: string) => {
    setIsCreatingBooking(true);
    try {
      const bookingDate = getCurrentISTDate();
      const booking = await addBookingToSupabase({
        shopId: shop.id,
        serviceName: service.name,
        servicePrice: service.price,
        timeSlot: selectedTime,
        tokenNumber: Math.floor(Math.random() * 1000),
        userName: customerName,
        userPhone: customerPhone,
        bookingDate: bookingDate,
        status: 'confirmed',
        userId: user?.uid,
      });

      if (booking) {
        toast.success('Booking confirmed!');

        // Save confirmed booking to show reminder settings next
        setConfirmedBooking({
          id: booking.id,
          time: selectedTime,
          date: bookingDate,
        });
      }
    } catch (err) {
      console.error('Error creating booking:', err);
      toast.error('Failed to confirm booking');
    } finally {
      setIsCreatingBooking(false);
    }
  };

  // Customer waiting screen
  if (negotiationState.status === 'owner_responding' && !isOwner) {
    const secondsLeft = getTimeRemainingSeconds(negotiationState.customerWaitDeadline);

    if (isCustomerWaitExpired() && !showOwnerNotRespondingPopup && !rejectionReason) {
      setRejectionReason('timeout');
      setShowOwnerNotRespondingPopup(true);
    }

    // If retry is selected, reset and allow customer to select new time
    if (showOwnerNotRespondingPopup && rejectionReason && !isOwner) {
      return (
        <OwnerNotRespondingPopup
          bookingRequestId={negotiationState.requestId || ''}
          customerName={customerName}
          ownerPhone={ownerPhone}
          serviceName={service.name}
          requestedTime={negotiationState.customerTimeSelection || ''}
          shopId={shop.id}
          isRejection={rejectionReason === 'rejected'}
          onCall={() => setShowOwnerNotRespondingPopup(false)}
          onCancel={() => onClose()}
          onRetryBooking={() => {
            // Reset state to allow customer to select a new time slot
            setShowOwnerNotRespondingPopup(false);
            setRejectionReason(null);
            // Customer will see the time slot selection screen again
          }}
        />
      );
    }

    return (
      <div className="w-full">
        <CustomerTimeSlotSelection
          shopId={shop.id}
          shopName={shop.name}
          serviceName={service.name}
          servicePrice={service.price}
          availableSlots={availableTimeSlots}
          ownerId={shop.id}
          customerName={customerName}
          customerPhone={customerPhone}
        />
      </div>
    );
  }

  // Owner notification
  if (showOwnerNotification && isOwner && request) {
    return (
      <OwnerBookingNotification
        bookingRequestId={request.id}
        customerName={request.customer_name}
        serviceName={request.service_name}
        requestedTimeSlot={request.requested_time_slots?.[0] || ''}
        customerPhone={request.customer_phone}
        onConfirm={handleOwnerConfirm}
        onReject={handleOwnerReject}
        onOfferAlternative={handleOwnerOfferAlternative}
      />
    );
  }

  // Owner offer selection
  if (showOfferSelection && isOwner) {
    return (
      <OwnerOfferTimeSelection
        bookingRequestId={negotiationState.requestId || ''}
        customerName={request?.customer_name || customerName}
        serviceName={service.name}
        availableSlots={availableTimeSlots}
        customerId={request?.user_id}
        onOfferSent={handleOfferSubmitted}
        onCancel={() => setShowOfferSelection(false)}
      />
    );
  }

  // Customer responding to offer
  if (negotiationState.status === 'customer_responding_to_offer' && !isOwner && negotiation) {
    return (
      <CustomerOfferResponse
        negotiationId={negotiation.id}
        offeredTimes={negotiation.offered_times || []}
        serviceName={service.name}
        ownerName={shop.name}
        onAccepted={handleCustomerAcceptsOffer}
      />
    );
  }

  // Show reminder settings after booking confirmation
  if (confirmedBooking && !isOwner) {
    return (
      <ReminderSettings
        bookingId={confirmedBooking.id}
        bookingDate={confirmedBooking.date}
        bookingTime={confirmedBooking.time}
        serviceName={service.name}
        shopName={shop.name}
        shopId={shop.id}
        customerName={customerName}
        customerPhone={customerPhone}
        tokenNumber={Math.floor(Math.random() * 1000)}
        onRemindersSaved={() => {
          onBookingConfirmed?.(confirmedBooking.id);
          setTimeout(onClose, 1000);
        }}
      />
    );
  }

  // Default: return empty
  return null;
};

export const ProductionBookingFlow: React.FC<ProductionBookingFlowProps> = (props) => {
  return (
    <Dialog open={true} onOpenChange={props.onClose}>
      <DialogContent className="max-w-2xl p-0 max-h-screen overflow-y-auto">
        <DialogTitle className="sr-only">Booking Negotiation</DialogTitle>
        <RealTimeNegotiationProvider>
          <ProductionBookingFlowContent {...props} />
        </RealTimeNegotiationProvider>
      </DialogContent>
    </Dialog>
  );
};
