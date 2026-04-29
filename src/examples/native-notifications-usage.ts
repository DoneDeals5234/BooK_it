/**
 * Example: How to use the native notification system
 * 
 * This file demonstrates how to integrate native notifications
 * with your existing web notification system.
 */

import { supabase } from '@/lib/supabase';
import { ensureNativeDeviceWithPlayerId, getNativeDevicesByUserId } from '@/lib/supabase-native-devices';
import { isCapacitor } from '@/lib/capacitor-notifications';

// ============================================================================
// EXAMPLE 1: Register Native Device on Login
// ============================================================================

export async function registerNativeDeviceOnLogin(userId: string, email: string) {
  if (!isCapacitor()) {
    console.log('Not running in native environment, skipping native device registration');
    return;
  }

  try {
    // This function will automatically wait for the player ID if not immediately available
    const success = await ensureNativeDeviceWithPlayerId(userId, email, 'native');

    if (success) {
      console.log('✅ Native device registered successfully');
    } else {
      console.error('❌ Failed to register native device');
    }
  } catch (error) {
    console.error('Error registering native device:', error);
  }
}

// ============================================================================
// EXAMPLE 2: Send Notification to Specific Native Users
// ============================================================================

export async function sendNotificationToNativeUsers(
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, any>
) {
  try {
    const response = await supabase.functions.invoke('send-native-notification', {
      body: {
        title,
        body,
        userIds, // Function will fetch playerIds from native_devices table
        data,
      },
    });

    if (response.error) {
      console.error('Error sending notification:', response.error);
      return false;
    }

    console.log('✅ Notification sent to native users:', response.data);
    return true;
  } catch (error) {
    console.error('Error in sendNotificationToNativeUsers:', error);
    return false;
  }
}

// ============================================================================
// EXAMPLE 3: Send Notification to Specific Native Player IDs
// ============================================================================

export async function sendNotificationToNativePlayerIds(
  playerIds: string[],
  title: string,
  body: string,
  data?: Record<string, any>
) {
  try {
    const response = await supabase.functions.invoke('send-native-notification', {
      body: {
        title,
        body,
        playerIds, // Direct player IDs
        data,
      },
    });

    if (response.error) {
      console.error('Error sending notification:', response.error);
      return false;
    }

    console.log('✅ Notification sent to native devices:', response.data);
    return true;
  } catch (error) {
    console.error('Error in sendNotificationToNativePlayerIds:', error);
    return false;
  }
}

// ============================================================================
// EXAMPLE 4: Send to Both Web and Native (Smart Routing)
// ============================================================================

export async function sendNotificationToAllPlatforms(
  webPlayerIds: string[],
  nativeUserIds: string[],
  title: string,
  body: string,
  data?: Record<string, any>,
  currentUserPlayerId?: string
) {
  try {
    const response = await supabase.functions.invoke('detect-and-route-notification', {
      body: {
        targetPlatform: 'both', // Send to both platforms
        title,
        body,
        playerIds: webPlayerIds, // Web subscription IDs
        userIds: nativeUserIds, // Native user IDs (will fetch player IDs)
        data,
        excludeCurrentUser: !!currentUserPlayerId,
        currentUserPlayerId,
      },
    });

    if (response.error) {
      console.error('Error routing notification:', response.error);
      return false;
    }

    console.log('✅ Notification routed to all platforms:', response.data);
    return true;
  } catch (error) {
    console.error('Error in sendNotificationToAllPlatforms:', error);
    return false;
  }
}

// ============================================================================
// EXAMPLE 5: Get All Native Devices for a User
// ============================================================================

export async function getUserNativeDevices(userId: string) {
  try {
    const devices = await getNativeDevicesByUserId(userId);
    console.log(`Found ${devices.length} native device(s) for user:`, devices);
    return devices;
  } catch (error) {
    console.error('Error getting native devices:', error);
    return [];
  }
}

// ============================================================================
// EXAMPLE 6: Integration with BookingModal
// ============================================================================

export async function notifyShopOwnerOfNewBooking(
  shopOwnerId: string,
  shopName: string,
  userName: string,
  bookingDetails: any
) {
  try {
    const title = '🆕 New Token Booking!';
    const body = `New booking from ${userName} at ${shopName}`;

    const response = await supabase.functions.invoke('detect-and-route-notification', {
      body: {
        targetPlatform: 'both', // Send to both web and native
        title,
        body,
        userIds: [shopOwnerId], // Fetch both web and native devices
        data: {
          bookingId: bookingDetails.id,
          shopId: bookingDetails.shopId,
          userName,
          shopName,
        },
      },
    });

    if (response.error) {
      console.error('Error notifying shop owner:', response.error);
      return false;
    }

    console.log('✅ Shop owner notified:', response.data);
    return true;
  } catch (error) {
    console.error('Error in notifyShopOwnerOfNewBooking:', error);
    return false;
  }
}

// ============================================================================
// EXAMPLE 7: Conditional Routing Based on Environment
// ============================================================================

export async function sendNotificationSmartly(
  title: string,
  body: string,
  webPlayerIds: string[],
  nativePlayerIds: string[],
  data?: Record<string, any>
) {
  try {
    // Only send to native if we have native player IDs
    // Only send to web if we have web player IDs

    let targetPlatform = 'both';
    if (!webPlayerIds.length) targetPlatform = 'native';
    if (!nativePlayerIds.length) targetPlatform = 'web';

    const response = await supabase.functions.invoke('detect-and-route-notification', {
      body: {
        targetPlatform,
        title,
        body,
        playerIds: webPlayerIds,
        nativePlayerIds,
        data,
      },
    });

    if (response.error) {
      console.error('Error sending notification:', response.error);
      return false;
    }

    console.log('✅ Notification sent:', response.data);
    return true;
  } catch (error) {
    console.error('Error in sendNotificationSmartly:', error);
    return false;
  }
}

// ============================================================================
// EXAMPLE 8: Broadcast Notification to All Native Users
// ============================================================================

export async function sendBroadcastToAllNativeUsers(
  title: string,
  body: string,
  data?: Record<string, any>
) {
  try {
    // This function would need a special endpoint or modification
    // to get all native player IDs. For now, you'd need to fetch them first:

    const { data: allNativeDevices, error } = await supabase
      .from('native_devices')
      .select('player_id')
      .not('player_id', 'is', null);

    if (error || !allNativeDevices) {
      console.error('Error fetching all native devices:', error);
      return false;
    }

    const playerIds = allNativeDevices.map((d: any) => d.player_id);

    const response = await supabase.functions.invoke('send-native-notification', {
      body: {
        title,
        body,
        playerIds,
        data,
      },
    });

    if (response.error) {
      console.error('Error sending broadcast:', response.error);
      return false;
    }

    console.log(
      `✅ Broadcast sent to ${playerIds.length} native device(s)`,
      response.data
    );
    return true;
  } catch (error) {
    console.error('Error in sendBroadcastToAllNativeUsers:', error);
    return false;
  }
}

// ============================================================================
// EXAMPLE 9: Environment-Specific Actions
// ============================================================================

export async function initializeNotificationsForPlatform() {
  if (isCapacitor()) {
    console.log('Running in native environment - initializing native notifications');
    // Native-specific initialization
  } else {
    console.log('Running in web environment - initializing web notifications');
    // Web-specific initialization
  }
}

// ============================================================================
// EXAMPLE 10: Error Handling Pattern
// ============================================================================

export async function sendNotificationWithErrorHandling(
  userIds: string[],
  title: string,
  body: string
) {
  try {
    if (!userIds || userIds.length === 0) {
      throw new Error('No user IDs provided');
    }

    if (!title || !body) {
      throw new Error('Title and body are required');
    }

    const response = await supabase.functions.invoke('send-native-notification', {
      body: {
        title,
        body,
        userIds,
      },
    });

    if (response.error) {
      throw new Error(`Function error: ${response.error.message}`);
    }

    if (!response.data.success) {
      throw new Error('Notification failed to send');
    }

    console.log('✅ Notification sent successfully');
    return response.data;
  } catch (error) {
    console.error('❌ Error sending notification:', error);
    // You might want to show this error to the user or log it somewhere
    throw error;
  }
}
