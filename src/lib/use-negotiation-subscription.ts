import React, { useEffect, useRef } from 'react';
import {
  subscribeToOwnerBookingRequests,
  subscribeToCustomerNegotiationUpdates,
  getBookingRequest,
  getLatestNegotiation,
} from '@/lib/supabase-bookings';

interface NegotiationSubscriptionOptions {
  bookingRequestId?: string;
  shopId?: string;
  isOwner?: boolean;
  isCustomer?: boolean;
  onOwnerRequest?: (request: any) => void;
  onNegotiationUpdate?: (negotiation: any) => void;
  onTimeout?: () => void;
  onExpired?: () => void;
}

export const useNegotiationSubscription = (options: NegotiationSubscriptionOptions) => {
  const {
    bookingRequestId,
    shopId,
    isOwner,
    isCustomer,
    onOwnerRequest,
    onNegotiationUpdate,
    onTimeout,
    onExpired,
  } = options;

  const unsubscribeRef = useRef<(() => void)[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const expirationRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear previous subscriptions
    unsubscribeRef.current.forEach((fn) => fn?.());
    unsubscribeRef.current = [];

    // Clear timeouts
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (expirationRef.current) clearTimeout(expirationRef.current);

    // Owner: Subscribe to booking requests
    if (isOwner && shopId) {
      const unsubscribe = subscribeToOwnerBookingRequests(shopId, (request) => {
        onOwnerRequest?.(request);

        // Set 1-minute timeout for owner to respond
        timeoutRef.current = setTimeout(() => {
          onTimeout?.();
        }, 1 * 60 * 1000);
      });
      unsubscribeRef.current.push(unsubscribe);
    }

    // Customer: Subscribe to negotiation updates
    if (isCustomer && bookingRequestId) {
      const unsubscribe = subscribeToCustomerNegotiationUpdates(bookingRequestId, (negotiation) => {
        onNegotiationUpdate?.(negotiation);

        // Set 1-minute timeout for customer to respond to offer
        if (negotiation.offered_by === 'owner' && negotiation.response_status === 'pending') {
          timeoutRef.current = setTimeout(() => {
            onTimeout?.();
          }, 1 * 60 * 1000);
        }
      });
      unsubscribeRef.current.push(unsubscribe);
    }

    // Set overall 2-minute expiration deadline
    if (bookingRequestId || shopId) {
      expirationRef.current = setTimeout(() => {
        onExpired?.();
      }, 2 * 60 * 1000);
      unsubscribeRef.current.push(() => {
        if (expirationRef.current) clearTimeout(expirationRef.current);
      });
    }

    return () => {
      unsubscribeRef.current.forEach((fn) => fn?.());
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (expirationRef.current) clearTimeout(expirationRef.current);
    };
  }, [bookingRequestId, shopId, isOwner, isCustomer, onOwnerRequest, onNegotiationUpdate, onTimeout, onExpired]);
};

// Utility hook to fetch booking request and check status
export const useBookingRequest = (requestId: string | null) => {
  const [request, setRequest] = React.useState<any>(null);
  const [negotiation, setNegotiation] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!requestId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [req, neg] = await Promise.all([
          getBookingRequest(requestId),
          getLatestNegotiation(requestId),
        ]);
        setRequest(req);
        setNegotiation(neg);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error fetching booking request');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [requestId]);

  return { request, negotiation, loading, error };
};
