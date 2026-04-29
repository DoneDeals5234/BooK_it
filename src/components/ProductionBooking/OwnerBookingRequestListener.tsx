import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeToOwnerBookingRequests, getBookingRequest } from '@/lib/supabase-bookings';
import { OwnerBookingNotification } from './OwnerBookingNotification';
import { OwnerOfferTimeSelection } from './OwnerOfferTimeSelection';
import toast from 'react-hot-toast';

interface OwnerBookingRequestListenerProps {
  shopId?: string;
  availableTimeSlots?: string[];
}

export const OwnerBookingRequestListener: React.FC<OwnerBookingRequestListenerProps> = ({
  shopId,
  availableTimeSlots = [],
}) => {
  const { userRole } = useAuth();
  const [incomingRequest, setIncomingRequest] = useState<any>(null);
  const [showOfferSelection, setShowOfferSelection] = useState(false);

  // Only activate for shop owners
  const isOwner = userRole?.type === 'shop_owner';
  const ownerShopId = userRole?.type === 'shop_owner' ? userRole.shopId : shopId;

  useEffect(() => {
    if (!isOwner || !ownerShopId) {
      console.log('Not a shop owner or no shop ID - booking listener inactive');
      return;
    }

    console.log('🔔 Starting booking request listener for shop:', ownerShopId);

    // Subscribe to new booking requests for this shop
    const unsubscribe = subscribeToOwnerBookingRequests(ownerShopId, async (newRequest) => {
      console.log('📬 New booking request received:', newRequest);

      // Play notification sound
      try {
        const audio = new Audio('/notification-sound.mp3');
        audio.play().catch(err => console.log('Could not play sound:', err));
      } catch (err) {
        console.log('Notification sound not available');
      }

      setIncomingRequest(newRequest);
      toast.success(`New booking request from ${newRequest.customer_name}!`);
    });

    return () => {
      console.log('Unsubscribing from booking requests');
      unsubscribe?.();
    };
  }, [isOwner, ownerShopId]);

  const handleConfirm = async () => {
    console.log('Owner confirmed booking request');
    setIncomingRequest(null);
    // The actual confirmation happens in ProductionBookingFlow
  };

  const handleReject = async () => {
    console.log('Owner rejected booking request');
    setIncomingRequest(null);
  };

  const handleOfferAlternative = () => {
    console.log('Owner offering alternative times');
    setShowOfferSelection(true);
  };

  const handleOfferSent = () => {
    console.log('Offer sent');
    setShowOfferSelection(false);
    setIncomingRequest(null);
  };

  const handleExpired = () => {
    console.log('Booking request expired');
    setIncomingRequest(null);
  };

  // Only show if there's an incoming request
  if (!incomingRequest) {
    return null;
  }

  // Show offer selection modal
  if (showOfferSelection && incomingRequest) {
    return (
      <OwnerOfferTimeSelection
        bookingRequestId={incomingRequest.id}
        customerName={incomingRequest.customer_name}
        serviceName={incomingRequest.service_name}
        availableSlots={availableTimeSlots}
        onOfferSent={handleOfferSent}
        onCancel={() => setShowOfferSelection(false)}
      />
    );
  }

  // Show booking notification alarm
  return (
    <OwnerBookingNotification
      bookingRequestId={incomingRequest.id}
      customerName={incomingRequest.customer_name}
      serviceName={incomingRequest.service_name}
      requestedTimeSlot={incomingRequest.requested_time_slots?.[0] || ''}
      customerPhone={incomingRequest.customer_phone}
      onConfirm={handleConfirm}
      onReject={handleReject}
      onOfferAlternative={handleOfferAlternative}
      onExpired={handleExpired}
    />
  );
};
