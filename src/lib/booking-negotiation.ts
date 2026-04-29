import { supabase } from '@/lib/supabase';
import type { BookingRequest, BookingNegotiation } from '@/contexts/BookingNegotiationContext';

const NEGOTIATION_TIMEOUT_MS = 60 * 1000; // 1 minute
const COOLDOWN_PERIOD_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Create a new booking request
 */
export const createBookingRequest = async (
  data: Omit<BookingRequest, 'id' | 'createdAt' | 'expiresAt' | 'status'>
): Promise<BookingRequest | null> => {
  try {
    const expiresAt = new Date(Date.now() + NEGOTIATION_TIMEOUT_MS);
    
    const { data: result, error } = await supabase
      .from('booking_requests')
      .insert({
        shop_id: data.shopId,
        user_id: data.userId,
        customer_name: data.customerName,
        customer_phone: data.customerPhone,
        service_name: data.serviceName,
        service_price: data.servicePrice,
        requested_time_slots: data.requestedTimeSlots,
        status: 'pending_owner_response',
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating booking request:', error);
      return null;
    }

    return {
      id: result.id,
      shopId: result.shop_id,
      userId: result.user_id,
      customerName: result.customer_name,
      customerPhone: result.customer_phone,
      serviceName: result.service_name,
      servicePrice: result.service_price,
      requestedTimeSlots: result.requested_time_slots,
      status: result.status,
      createdAt: new Date(result.created_at),
      expiresAt: new Date(result.expires_at),
    };
  } catch (error) {
    console.error('Exception creating booking request:', error);
    return null;
  }
};

/**
 * Create a counter-offer negotiation
 */
export const createCounterOffer = async (
  bookingRequestId: string,
  offeredTimes: string[],
  offeredBy: 'owner' | 'customer'
): Promise<BookingNegotiation | null> => {
  try {
    const expiresAt = new Date(Date.now() + NEGOTIATION_TIMEOUT_MS);

    const { data: result, error } = await supabase
      .from('booking_negotiations')
      .insert({
        booking_request_id: bookingRequestId,
        offered_times: offeredTimes,
        offered_by: offeredBy,
        response_status: 'pending',
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating counter-offer:', error);
      return null;
    }

    return {
      id: result.id,
      bookingRequestId: result.booking_request_id,
      offeredTimes: result.offered_times,
      offeredBy: result.offered_by,
      responseStatus: result.response_status,
      createdAt: new Date(result.created_at),
      expiresAt: new Date(result.expires_at),
    };
  } catch (error) {
    console.error('Exception creating counter-offer:', error);
    return null;
  }
};

/**
 * Update booking request status
 */
export const updateBookingRequestStatus = async (
  bookingRequestId: string,
  status: BookingRequest['status']
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('booking_requests')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', bookingRequestId);

    if (error) {
      console.error('Error updating booking request status:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Exception updating booking request status:', error);
    return false;
  }
};

/**
 * Update negotiation response status
 */
export const updateNegotiationStatus = async (
  negotiationId: string,
  responseStatus: BookingNegotiation['responseStatus']
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('booking_negotiations')
      .update({ response_status: responseStatus, updated_at: new Date().toISOString() })
      .eq('id', negotiationId);

    if (error) {
      console.error('Error updating negotiation status:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Exception updating negotiation status:', error);
    return false;
  }
};

/**
 * Fetch booking request by ID
 */
export const getBookingRequest = async (id: string): Promise<BookingRequest | null> => {
  try {
    const { data, error } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching booking request:', error);
      return null;
    }

    return {
      id: data.id,
      shopId: data.shop_id,
      userId: data.user_id,
      customerName: data.customer_name,
      customerPhone: data.customer_phone,
      serviceName: data.service_name,
      servicePrice: data.service_price,
      requestedTimeSlots: data.requested_time_slots,
      status: data.status,
      createdAt: new Date(data.created_at),
      expiresAt: new Date(data.expires_at),
    };
  } catch (error) {
    console.error('Exception fetching booking request:', error);
    return null;
  }
};

/**
 * Subscribe to booking requests for a shop
 */
export const subscribeToBookingRequests = (
  shopId: string,
  callback: (requests: BookingRequest[]) => void
) => {
  const channel = supabase
    .channel(`booking-requests-${shopId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'booking_requests',
        filter: `shop_id=eq.${shopId}`,
      },
      async (payload) => {
        // Fetch fresh data when changes occur
        const { data, error } = await supabase
          .from('booking_requests')
          .select('*')
          .eq('shop_id', shopId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          const requests = data.map((r: any) => ({
            id: r.id,
            shopId: r.shop_id,
            userId: r.user_id,
            customerName: r.customer_name,
            customerPhone: r.customer_phone,
            serviceName: r.service_name,
            servicePrice: r.service_price,
            requestedTimeSlots: r.requested_time_slots,
            status: r.status,
            createdAt: new Date(r.created_at),
            expiresAt: new Date(r.expires_at),
          }));
          callback(requests);
        }
      }
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
};

/**
 * Subscribe to negotiations for a booking request
 */
export const subscribeToNegotiations = (
  bookingRequestId: string,
  callback: (negotiation: BookingNegotiation | null) => void
) => {
  const channel = supabase
    .channel(`negotiations-${bookingRequestId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'booking_negotiations',
        filter: `booking_request_id=eq.${bookingRequestId}`,
      },
      async (payload) => {
        // Fetch the latest negotiation
        const { data, error } = await supabase
          .from('booking_negotiations')
          .select('*')
          .eq('booking_request_id', bookingRequestId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!error && data) {
          callback({
            id: data.id,
            bookingRequestId: data.booking_request_id,
            offeredTimes: data.offered_times,
            offeredBy: data.offered_by,
            responseStatus: data.response_status,
            createdAt: new Date(data.created_at),
            expiresAt: new Date(data.expires_at),
          });
        } else {
          callback(null);
        }
      }
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
};

/**
 * Check if customer has a cooldown period after rejection
 */
export const hasRejectionCooldown = async (
  shopId: string,
  userId: string
): Promise<boolean> => {
  try {
    const cutoffTime = new Date(Date.now() - COOLDOWN_PERIOD_MS).toISOString();

    const { data, error } = await supabase
      .from('booking_requests')
      .select('id')
      .eq('shop_id', shopId)
      .eq('user_id', userId)
      .in('status', ['cancelled', 'expired'])
      .gt('updated_at', cutoffTime)
      .limit(1);

    if (error) {
      console.error('Error checking cooldown:', error);
      return false;
    }

    return data && data.length > 0;
  } catch (error) {
    console.error('Exception checking cooldown:', error);
    return false;
  }
};

/**
 * Get minutes remaining until cooldown expires
 */
export const getRebootingCooldownMinutes = async (
  shopId: string,
  userId: string
): Promise<number> => {
  try {
    const { data, error } = await supabase
      .from('booking_requests')
      .select('updated_at')
      .eq('shop_id', shopId)
      .eq('user_id', userId)
      .in('status', ['cancelled', 'expired'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return 0;
    }

    const lastRejection = new Date(data.updated_at).getTime();
    const now = Date.now();
    const elapsed = now - lastRejection;
    const remaining = Math.max(0, Math.ceil((COOLDOWN_PERIOD_MS - elapsed) / 60000));

    return remaining;
  } catch (error) {
    console.error('Exception getting cooldown minutes:', error);
    return 0;
  }
};
