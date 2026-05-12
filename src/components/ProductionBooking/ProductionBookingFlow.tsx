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
  notifyBookingConfirmed,
} from '@/lib/booking-negotiation-notifications';
import { addBookingToSupabase } from '@/lib/supabase-bookings';
import { getCurrentISTDate } from '@/lib/bookings-storage';
import { supabase } from '@/lib/supabase';
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
  shop, service, availableTimeSlots, customerName, customerPhone, ownerPhone, isOwner = false, onClose, onBookingConfirmed
}) => {
  const { user } = useAuth();
  const { negotiationState, getTimeRemainingSeconds, isCustomerWaitExpired } = useRealTimeNegotiation();
  const { request, negotiation } = useBookingRequest(negotiationState.requestId);
  const [showOwnerNotification, setShowOwnerNotification] = useState(false);
  const [showOfferSelection, setShowOfferSelection] = useState(false);
  const [showOwnerNotRespondingPopup, setShowOwnerNotRespondingPopup] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<{ id: string; time: string; date: string } | null>(null);
  const [rejectionReason, setRejectionReason] = useState<'rejected' | 'timeout' | null>(null);
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);

  // Fetch owner user ID for this shop
  useEffect(() => {
    const fetchOwner = async () => {
      const { data } = await supabase.from('shop_owners').select('user_id').eq('shop_id', shop.id).limit(1).single();
      if (data) setOwnerUserId(data.user_id);
    };
    fetchOwner();
  }, [shop.id]);

  useNegotiationSubscription({
    bookingRequestId: negotiationState.requestId || undefined,
    shopId: isOwner ? shop.id : undefined,
    isOwner,
    isCustomer: !isOwner,
    onOwnerRequest: () => { if (isOwner) setShowOwnerNotification(true); },
    onNegotiationUpdate: (neg) => { if (!isOwner && neg.offered_by === 'owner') setShowOwnerNotification(false); },
    onTimeout: () => { if (isOwner) setShowOwnerNotRespondingPopup(true); },
  });

  const handleOwnerConfirm = async () => {
    if (!negotiationState.requestId) return;
    try {
      const date = getCurrentISTDate();
      const booking = await addBookingToSupabase({
        shopId: shop.id, serviceName: service.name, servicePrice: service.price,
        timeSlot: negotiationState.customerTimeSelection || '', tokenNumber: Math.floor(Math.random() * 1000),
        userName: customerName, userPhone: customerPhone, bookingDate: date, status: 'confirmed', userId: request?.user_id
      });
      if (booking) {
        await notifyBookingConfirmed({
          customerId: request?.user_id || '', shopName: shop.name, serviceName: service.name,
          confirmedTime: negotiationState.customerTimeSelection || '', bookingRequestId: negotiationState.requestId
        });
        setConfirmedBooking({ id: booking.id, time: negotiationState.customerTimeSelection || '', date });
      }
    } catch (err) { console.error(err); }
  };

  if (confirmedBooking && !isOwner) {
    return <ReminderSettings bookingId={confirmedBooking.id} bookingDate={confirmedBooking.date} bookingTime={confirmedBooking.time} serviceName={service.name} shopName={shop.name} shopId={shop.id} customerName={customerName} customerPhone={customerPhone} onRemindersSaved={() => { onBookingConfirmed?.(confirmedBooking.id); setTimeout(onClose, 1000); }} />;
  }

  if (negotiationState.status === 'owner_responding' && !isOwner) {
    if (isCustomerWaitExpired() && !showOwnerNotRespondingPopup && !rejectionReason) {
      setRejectionReason('timeout');
      setShowOwnerNotRespondingPopup(true);
    }
    if (showOwnerNotRespondingPopup) {
      return <OwnerNotRespondingPopup bookingRequestId={negotiationState.requestId || ''} customerName={customerName} ownerPhone={ownerPhone} serviceName={service.name} requestedTime={negotiationState.customerTimeSelection || ''} ownerId={ownerUserId || undefined} isRejection={rejectionReason === 'rejected'} onCancel={onClose} onRetryBooking={() => { setShowOwnerNotRespondingPopup(false); setRejectionReason(null); }} />;
    }
    return <CustomerTimeSlotSelection shopId={shop.id} shopName={shop.name} serviceName={service.name} servicePrice={service.price} availableSlots={availableTimeSlots} ownerId={ownerUserId || shop.id} customerName={customerName} customerPhone={customerPhone} />;
  }

  if (showOwnerNotification && isOwner && request) {
    return <OwnerBookingNotification bookingRequestId={request.id} customerName={request.customer_name} serviceName={request.service_name} requestedTimeSlot={request.requested_time_slots?.[0] || ''} customerPhone={request.customer_phone} customerId={request.user_id} onConfirm={handleOwnerConfirm} onReject={() => { setShowOwnerNotification(false); setRejectionReason('rejected'); setShowOwnerNotRespondingPopup(true); }} onOfferAlternative={() => { setShowOwnerNotification(false); setShowOfferSelection(true); }} />;
  }

  if (showOfferSelection && isOwner) {
    return <OwnerOfferTimeSelection bookingRequestId={negotiationState.requestId || ''} customerName={request?.customer_name || customerName} serviceName={service.name} availableSlots={availableTimeSlots} customerId={request?.user_id} ownerName={shop.name} onOfferSent={() => setShowOfferSelection(false)} onCancel={() => setShowOfferSelection(false)} />;
  }

  if (negotiationState.status === 'customer_responding_to_offer' && !isOwner && negotiation) {
    return <CustomerOfferResponse negotiationId={negotiation.id} offeredTimes={negotiation.offered_times || []} serviceName={service.name} ownerId={ownerUserId || undefined} ownerName={shop.name} onAccepted={async (t) => {
      const date = getCurrentISTDate();
      const booking = await addBookingToSupabase({
        shopId: shop.id, serviceName: service.name, servicePrice: service.price, timeSlot: t,
        tokenNumber: Math.floor(Math.random() * 1000), userName: customerName, userPhone: customerPhone,
        bookingDate: date, status: 'confirmed', userId: user?.uid
      });
      if (booking) setConfirmedBooking({ id: booking.id, time: t, date });
    }} />;
  }

  return null;
};

export const ProductionBookingFlow: React.FC<ProductionBookingFlowProps> = (props) => {
  return (
    <Dialog open={true} onOpenChange={props.onClose}>
      <DialogContent className="max-w-2xl p-0 max-h-[90vh] overflow-y-auto">
        <DialogTitle className="sr-only">Booking</DialogTitle>
        <RealTimeNegotiationProvider>
          <ProductionBookingFlowContent {...props} />
        </RealTimeNegotiationProvider>
      </DialogContent>
    </Dialog>
  );
};
