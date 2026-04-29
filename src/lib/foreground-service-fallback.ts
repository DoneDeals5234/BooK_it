/**
 * Foreground Service Fallback - Supabase Realtime Layer
 * 
 * This provides a fallback mechanism to trigger foreground service on owner's device
 * if the OneSignal notification fails to arrive.
 * 
 * FLOW:
 * 1. Owner's device sets up a Realtime listener for booking requests
 * 2. When a customer books, booking request is created in Supabase
 * 3. Realtime listener fires and checks if service should be started
 * 4. If service hasn't already started (via notification), fallback triggers it
 */

import { supabase } from '@/lib/supabase';
import { auth } from '@/lib/firebase';
import { startForegroundAlarmService } from '@/lib/alarm-scheduler';
import { Capacitor } from '@capacitor/core';

interface BookingRequestData {
  id: string;
  shop_id: string;
  user_id: string;
  customer_name: string;
  customer_phone: string;
  service_name: string;
  requested_time_slots: string[];
  created_at: string;
}

// Track which booking requests have already triggered the service
// to avoid duplicate service starts
let triggeredBookingRequests = new Set<string>();

// Track active Realtime subscription to prevent duplicates
let activeRealtimeSubscription: any = null;

/**
 * Setup fallback listener for foreground service trigger
 * Called on owner's device when they log in
 * Uses Supabase Realtime to listen for new booking requests
 */
export async function setupForegroundServiceFallback(shopId: string): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    console.log('ℹ️ Foreground service fallback only available on Android native');
    return;
  }

  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log('⏭️ No user logged in, skipping foreground service fallback setup');
      return;
    }

    console.log(`🔄 Setting up foreground service fallback listener for shop: ${shopId}`);

    // Clean up existing subscription if any
    if (activeRealtimeSubscription) {
      console.log('🔄 Removing previous Realtime subscription...');
      supabase.removeChannel(activeRealtimeSubscription);
      activeRealtimeSubscription = null;
    }

    // Subscribe to booking_requests table for this shop
    // Listen for INSERT events (new booking requests)
    const subscription = supabase
      .channel(`booking_requests:shop_id=eq.${shopId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'booking_requests',
          filter: `shop_id=eq.${shopId}`,
        },
        async (payload: any) => {
          const bookingRequest = payload.new as BookingRequestData;

          console.log('🔔 FALLBACK: New booking request detected via Realtime:', {
            bookingId: bookingRequest.id,
            customer: bookingRequest.customer_name,
            timeSlot: bookingRequest.requested_time_slots?.[0],
          });

          // Check if service already started for this booking (via notification)
          if (triggeredBookingRequests.has(bookingRequest.id)) {
            console.log(`ℹ️ FALLBACK: Booking ${bookingRequest.id} already triggered service (via notification), skipping fallback`);
            return;
          }

          // Check if current user is the owner of this shop
          // This is important to ensure we only start service on the correct device
          try {
            const { getNativeShopOwner } = await import('@/lib/supabase-native-shop-owners');
            const isOwner = await getNativeShopOwner(currentUser.uid, shopId);

            if (!isOwner) {
              console.log('🚫 FALLBACK: Current user is not the shop owner for this booking, skipping');
              return;
            }

            console.log('✅ FALLBACK: Current user is the shop owner, triggering foreground service...');

            // Extract booking details
            const timeSlot = bookingRequest.requested_time_slots?.[0] || 'Unknown time';
            const tokenNumber = parseInt(timeSlot.split(':')[0]) || 0;

            // Mark as triggered to prevent duplicate service starts
            triggeredBookingRequests.add(bookingRequest.id);

            // Start foreground alarm service as fallback
            const result = await startForegroundAlarmService({
              bookingId: bookingRequest.id,
              tokenNumber: tokenNumber,
              shopName: bookingRequest.service_name || 'Booking',
              timeSlot: timeSlot,
              triggerTimeMs: Date.now() + (2 * 60 * 60 * 1000), // 2 hours from now
            });

            if (result.success) {
              console.log('✅ FALLBACK: Foreground service started successfully via Realtime');
              console.log(`   Booking: ${bookingRequest.id}`);
              console.log(`   Customer: ${bookingRequest.customer_name}`);
              console.log(`   Time: ${timeSlot}`);
            } else {
              console.error('❌ FALLBACK: Failed to start foreground service:', result.message);
            }
          } catch (error) {
            console.error('❌ FALLBACK: Error processing booking request:', error);
          }
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Realtime fallback listener subscribed to shop: ${shopId}`);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Realtime fallback listener channel error');
        } else if (status === 'CLOSED') {
          console.log('ℹ️ Realtime fallback listener channel closed');
        }
      });

    activeRealtimeSubscription = subscription;
  } catch (error) {
    console.error('❌ Error setting up foreground service fallback:', error);
  }
}

/**
 * Mark a booking request as triggered to prevent duplicate service starts
 * Called when notification successfully triggers the service
 */
export function markBookingAsTriggered(bookingRequestId: string): void {
  triggeredBookingRequests.add(bookingRequestId);
  console.log(`📌 Marked booking ${bookingRequestId} as triggered - fallback will skip it`);
}

/**
 * Clean up the fallback listener when navigating away or logging out
 */
export async function cleanupForegroundServiceFallback(): Promise<void> {
  try {
    if (activeRealtimeSubscription) {
      console.log('🧹 Cleaning up foreground service fallback listener...');
      supabase.removeChannel(activeRealtimeSubscription);
      activeRealtimeSubscription = null;
      triggeredBookingRequests.clear();
      console.log('✅ Fallback listener cleaned up');
    }
  } catch (error) {
    console.error('❌ Error cleaning up fallback listener:', error);
  }
}

/**
 * Reset triggered bookings (for testing purposes)
 */
export function resetTriggeredBookings(): void {
  triggeredBookingRequests.clear();
  console.log('🔄 Reset triggered bookings cache');
}
