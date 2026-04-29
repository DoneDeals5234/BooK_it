import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { retryWithBackoff } from '@/lib/retry-utils';
import type { Booking } from '@/lib/bookings-storage';
import { notifyBookingCompleted } from '@/lib/booking-negotiation-notifications';
import { getShopOwnersByShopId } from '@/lib/supabase-shop-owners';
import { sendBookingNotifications } from '@/lib/booking-notification-system';

// Add booking to Supabase
export const addBookingToSupabase = async (
  booking: Omit<Booking, 'id' | 'createdAt'>
): Promise<Booking | null> => {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .insert({
        shop_id: booking.shopId,
        service_name: booking.serviceName,
        service_price: booking.servicePrice,
        time_slot: booking.timeSlot,
        token_number: booking.tokenNumber,
        user_name: booking.userName,
        user_phone: booking.userPhone,
        booking_date: booking.bookingDate,
        status: booking.status,
        user_id: booking.userId,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding booking to Supabase:', JSON.stringify(error, null, 2));
      return null;
    }

    const createdBooking: Booking = {
      id: data.id,
      shopId: data.shop_id,
      serviceName: data.service_name,
      servicePrice: data.service_price,
      timeSlot: data.time_slot,
      tokenNumber: data.token_number,
      userName: data.user_name,
      userPhone: data.user_phone,
      bookingDate: data.booking_date,
      status: data.status,
      userId: data.user_id,
      createdAt: new Date(data.created_at),
    };

    // Send notifications to customer and shop owner
    console.log('📤 Sending booking notifications...');
    try {
      await sendBookingNotifications(createdBooking);
    } catch (error) {
      console.warn('⚠️ Failed to send booking notifications:', error);
      // Don't fail the booking creation if notifications fail
    }

    return createdBooking;
  } catch (error) {
    console.error('Error in addBookingToSupabase:', error);
    return null;
  }
};

// Get all bookings from Supabase
export const getAllBookingsFromSupabase = async (): Promise<Booking[]> => {
  if (!isSupabaseConfigured) {
    console.log('ℹ️ Supabase not configured, returning empty bookings list');
    return [];
  }

  // Check if browser has internet connection
  if (!navigator.onLine) {
    console.log('📡 No internet connection, returning empty bookings list');
    return [];
  }

  try {
    console.log('📥 Fetching bookings from Supabase...');
    const { data, error } = await retryWithBackoff(() =>
      supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false })
    );

    if (error) {
      console.error('❌ Error fetching bookings from Supabase:');
      console.error('  Message:', error.message || 'No message');
      console.error('  Code:', error.code || 'No code');
      console.error('  Details:', error.details || 'No details');
      console.error('  Hint:', error.hint || 'No hint');
      console.error('  Full error:', JSON.stringify(error, null, 2));
      return [];
    }

    console.log('✅ Successfully fetched bookings:', data?.length || 0);
    return (data || []).map((item) => ({
      id: item.id,
      shopId: item.shop_id,
      serviceName: item.service_name,
      servicePrice: item.service_price,
      timeSlot: item.time_slot,
      tokenNumber: item.token_number,
      userName: item.user_name,
      userPhone: item.user_phone,
      bookingDate: item.booking_date,
      status: item.status,
      userId: item.user_id,
      createdAt: new Date(item.created_at),
    }));
  } catch (error) {
    console.error('Error in getAllBookingsFromSupabase:', error instanceof Error ? error.message : error);
    return [];
  }
};

// Get bookings for a specific shop
export const getShopBookingsFromSupabase = async (shopId: string): Promise<Booking[]> => {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('shop_id', shopId)
      .order('token_number', { ascending: true });

    if (error) {
      console.error('Error fetching shop bookings from Supabase:', JSON.stringify(error, null, 2));
      return [];
    }

    return (data || []).map((item) => ({
      id: item.id,
      shopId: item.shop_id,
      serviceName: item.service_name,
      servicePrice: item.service_price,
      timeSlot: item.time_slot,
      tokenNumber: item.token_number,
      userName: item.user_name,
      userPhone: item.user_phone,
      bookingDate: item.booking_date,
      status: item.status,
      userId: item.user_id,
      createdAt: new Date(item.created_at),
    }));
  } catch (error) {
    console.error('Error in getShopBookingsFromSupabase:', error);
    return [];
  }
};

// Subscribe to real-time bookings updates for a shop
export const subscribeToShopBookings = (
  shopId: string,
  callback: (bookings: Booking[]) => void
) => {
  const fetchAndNotify = async () => {
    const bookings = await getShopBookingsFromSupabase(shopId);
    callback(bookings);
  };

  const subscription = supabase
    .channel(`shop-bookings-${shopId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bookings',
        filter: `shop_id=eq.${shopId}`,
      },
      () => {
        fetchAndNotify();
      }
    )
    .subscribe();

  // Initial fetch
  fetchAndNotify();

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(subscription);
  };
};

// Update booking status in Supabase
export const updateBookingStatusInSupabase = async (
  id: string,
  status: 'pending' | 'in-progress' | 'completed'
): Promise<Booking | null> => {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating booking status in Supabase:', JSON.stringify(error, null, 2));
      return null;
    }

    return {
      id: data.id,
      shopId: data.shop_id,
      serviceName: data.service_name,
      servicePrice: data.service_price,
      timeSlot: data.time_slot,
      tokenNumber: data.token_number,
      userName: data.user_name,
      userPhone: data.user_phone,
      bookingDate: data.booking_date,
      status: data.status,
      userId: data.user_id,
      createdAt: new Date(data.created_at),
    };
  } catch (error) {
    console.error('Error in updateBookingStatusInSupabase:', error);
    return null;
  }
};

// Complete booking and send notifications to both customer and owner
export const completeBookingWithNotifications = async (
  bookingId: string
): Promise<Booking | null> => {
  try {
    console.log(`🔄 Starting booking completion process for ${bookingId}`);

    // Step 1: Get the booking details
    const { data: bookingData, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (bookingError || !bookingData) {
      console.error('Error fetching booking details:', bookingError);
      return null;
    }

    console.log(`✅ Fetched booking details: ${bookingData.service_name}`);

    // Step 2: Update booking status to 'completed'
    const updatedBooking = await updateBookingStatusInSupabase(bookingId, 'completed');

    if (!updatedBooking) {
      console.error('Failed to update booking status');
      return null;
    }

    console.log(`✅ Booking ${bookingId} status updated to completed`);

    // Step 3: Get shop owner details
    const owners = await getShopOwnersByShopId(bookingData.shop_id);

    if (!owners || owners.length === 0) {
      console.error('No shop owners found for shop:', bookingData.shop_id);
      // Continue anyway - booking is already marked complete
      return updatedBooking;
    }

    const owner = owners[0];
    console.log(`✅ Fetched shop owner: ${owner.userId}`);

    // Step 4: Get shop details to show shop name in notification
    const { data: shopData } = await supabase
      .from('shops')
      .select('name')
      .eq('id', bookingData.shop_id)
      .single();

    const shopName = shopData?.name || 'Shop';

    // Step 5: Send notifications to both customer and owner
    console.log(`📲 Sending notifications to customer (${bookingData.user_id}) and owner (${owner.userId})`);

    await notifyBookingCompleted({
      customerId: bookingData.user_id,
      ownerId: owner.userId,
      customerName: bookingData.user_name,
      shopName: shopName,
      serviceName: bookingData.service_name,
      bookingTime: bookingData.time_slot,
      tokenNumber: bookingData.token_number,
      bookingId: bookingId,
    });

    console.log(`✅ Booking ${bookingId} completed and notifications sent to both parties`);
    return updatedBooking;

  } catch (error) {
    console.error('Error in completeBookingWithNotifications:', error);
    return null;
  }
};

// Check if time slot is booked in Supabase
export const isTimeSlotBookedInSupabase = async (
  shopId: string,
  timeSlot: string,
  bookingDate: string
): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('id')
      .eq('shop_id', shopId)
      .eq('time_slot', timeSlot)
      .eq('booking_date', bookingDate)
      .single();

    if (error && error.code === 'PGRST116') {
      // No rows found
      return false;
    }

    if (error) {
      console.error('Error checking time slot availability:', JSON.stringify(error, null, 2));
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('Error in isTimeSlotBookedInSupabase:', error);
    return false;
  }
};

// Get next token number for a shop
export const getNextTokenNumberFromSupabase = async (shopId: string): Promise<number> => {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('token_number')
      .eq('shop_id', shopId)
      .order('token_number', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error getting next token number:', JSON.stringify(error, null, 2));
      return 1;
    }

    if (!data || data.length === 0) {
      return 1;
    }

    return data[0].token_number + 1;
  } catch (error) {
    console.error('Error in getNextTokenNumberFromSupabase:', error);
    return 1;
  }
};

// Delete booking from Supabase
export const deleteBookingFromSupabase = async (bookingId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('bookings')
      .delete()
      .eq('id', bookingId);

    if (error) {
      console.error('Error deleting booking from Supabase:', JSON.stringify(error, null, 2));
      return false;
    }

    console.log(`✅ Booking ${bookingId} deleted successfully`);
    return true;
  } catch (error) {
    console.error('Error in deleteBookingFromSupabase:', error);
    return false;
  }
};

// Subscribe to booking requests for a customer
export const subscribeToCustomerBookingRequests = (
  userId: string,
  callback: (requestIds: string[]) => void
) => {
  const subscription = supabase
    .channel(`customer-booking-requests-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'booking_requests',
        filter: `user_id=eq.${userId}`,
      },
      async (payload) => {
        // Fetch updated requests
        const { data, error } = await supabase
          .from('booking_requests')
          .select('id')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          callback(data.map((r: any) => r.id));
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(subscription);
  };
};

// Subscribe to negotiations for a booking request
export const subscribeToBookingRequestNegotiations = (
  bookingRequestId: string,
  callback: (negotiationCount: number) => void
) => {
  const subscription = supabase
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
        // Count negotiations
        const { data, error } = await supabase
          .from('booking_negotiations')
          .select('id')
          .eq('booking_request_id', bookingRequestId);

        if (!error && data) {
          callback(data.length);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(subscription);
  };
};

// PRODUCTION BOOKING NEGOTIATION FLOW

// Create a booking request (customer initiates)
export const createProductionBookingRequest = async (data: {
  shopId: string;
  userId: string;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  servicePrice: string;
  requestedTimeSlot: string;
}) => {
  try {
    const { data: result, error } = await supabase
      .from('booking_requests')
      .insert({
        shop_id: data.shopId,
        user_id: data.userId,
        customer_name: data.customerName,
        customer_phone: data.customerPhone,
        service_name: data.serviceName,
        service_price: data.servicePrice,
        requested_time_slots: [data.requestedTimeSlot],
        status: 'pending_owner_response',
        expires_at: new Date(Date.now() + 2 * 60 * 1000), // 2 minutes from now
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating booking request:', error);
      return null;
    }

    return result;
  } catch (error) {
    console.error('Error in createProductionBookingRequest:', error);
    return null;
  }
};

// Get booking request details
export const getBookingRequest = async (requestId: string) => {
  try {
    const { data, error } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (error) {
      console.error('Error fetching booking request:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getBookingRequest:', error);
    return null;
  }
};

// Update booking request status
export const updateBookingRequestStatus = async (
  requestId: string,
  status: string
) => {
  try {
    const { data, error } = await supabase
      .from('booking_requests')
      .update({
        status,
        updated_at: new Date(),
      })
      .eq('id', requestId)
      .select()
      .single();

    if (error) {
      console.error('Error updating booking request status:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in updateBookingRequestStatus:', error);
    return null;
  }
};

// Create a counter-offer from owner
export const createOwnerCounterOffer = async (
  bookingRequestId: string,
  offeredTimes: string[]
) => {
  try {
    const { data, error } = await supabase
      .from('booking_negotiations')
      .insert({
        booking_request_id: bookingRequestId,
        offered_times: offeredTimes,
        offered_by: 'owner',
        response_status: 'pending',
        expires_at: new Date(Date.now() + 1 * 60 * 1000), // 1 minute timeout
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating counter-offer:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in createOwnerCounterOffer:', error);
    return null;
  }
};

// Get latest negotiation for a booking request
export const getLatestNegotiation = async (bookingRequestId: string) => {
  try {
    const { data, error } = await supabase
      .from('booking_negotiations')
      .select('*')
      .eq('booking_request_id', bookingRequestId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code === 'PGRST116') {
      // No negotiations found
      return null;
    }

    if (error) {
      console.error('Error fetching latest negotiation:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getLatestNegotiation:', error);
    return null;
  }
};

// Update negotiation response status
export const updateNegotiationResponse = async (
  negotiationId: string,
  status: 'accepted' | 'rejected' | 'expired'
) => {
  try {
    const { data, error } = await supabase
      .from('booking_negotiations')
      .update({
        response_status: status,
        updated_at: new Date(),
      })
      .eq('id', negotiationId)
      .select()
      .single();

    if (error) {
      console.error('Error updating negotiation response:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in updateNegotiationResponse:', error);
    return null;
  }
};

// Subscribe to booking request updates for owner (real-time)
export const subscribeToOwnerBookingRequests = (
  shopId: string,
  callback: (request: any) => void
) => {
  const subscription = supabase
    .channel(`owner-booking-requests-${shopId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'booking_requests',
        filter: `shop_id=eq.${shopId}`,
      },
      (payload) => {
        callback(payload.new);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(subscription);
  };
};

// Subscribe to negotiation updates for customer (real-time)
export const subscribeToCustomerNegotiationUpdates = (
  bookingRequestId: string,
  callback: (negotiation: any) => void
) => {
  const subscription = supabase
    .channel(`customer-negotiation-${bookingRequestId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'booking_negotiations',
        filter: `booking_request_id=eq.${bookingRequestId}`,
      },
      (payload) => {
        callback(payload.new);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(subscription);
  };
};
