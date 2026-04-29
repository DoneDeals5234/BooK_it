const ONESIGNAL_APP_ID = '1f14fad4-0d2f-465a-b3a8-e0e976b8729f';
const ONESIGNAL_API_KEY = 'os_v2_app_d4kpvvanf5dfvm5i4duxnodst735kymt7txulwnftdubelcq2qw5yu7acbdtxn3ye7af2qsizzhz3jtptubvm4wi46xzpqeh2wn2vvq';
const ONESIGNAL_API_URL = 'https://onesignal.com/api/v1/notifications';

export interface NotificationPayload {
  title: string;
  body: string;
  imageUrl?: string; // Image URL for both small inline icon (large_icon) and big expanded picture (big_picture)
  tokenNumber?: string | number;
  shopName?: string;
  userName?: string;
  userPhone?: string;
  timeSlot?: string;
  serviceName?: string;
  actionButtons?: Array<{ id: string; text: string }>;
}

/**
 * Set external_user_id tag for OneSignal (both web and native)
 * This tag is used by the backend function send-notification-by-userid to target users
 * IMPORTANT: Must be called AFTER user logs in so the tag is associated with their device
 */
export async function setOneSignalUserIdTag(userId: string): Promise<boolean> {
  try {
    if (!userId) {
      console.error('❌ No userId provided to setOneSignalUserIdTag');
      return false;
    }

    console.log('🏷️ Setting OneSignal external_user_id tag for user:', userId);

    // For native (Capacitor) environment
    const { isCapacitor } = await import('@/lib/capacitor-notifications');
    if (isCapacitor()) {
      console.log('📱 NATIVE: Setting tag in native OneSignal');
      const oneSignal = window.OneSignal as any;
      if (oneSignal && oneSignal.User && typeof oneSignal.User.addTag === 'function') {
        try {
          // Link user and set external_id alias (modern SDK)
          if (typeof oneSignal.login === 'function') {
            await oneSignal.login(userId);
            console.log('✅ NATIVE: Logged in to OneSignal with userId:', userId);
          } else if (oneSignal.User?.addAlias) {
            await oneSignal.User.addAlias('external_id', userId);
            console.log('✅ NATIVE: Added external_id alias:', userId);
          }

          // Also set tag for legacy targeting fallback
          await oneSignal.User.addTag('external_user_id', userId);
          console.log('✅ NATIVE: Tag "external_user_id" set successfully:', userId);
          return true;
        } catch (e) {
          console.error('❌ NATIVE: Error setting identity:', e);
          return false;
        }
      } else {
        // Fallback for older Capacitor/Cordova plugin versions
        if (typeof oneSignal.setExternalUserId === 'function') {
          oneSignal.setExternalUserId(userId);
          console.log('✅ NATIVE: External user ID set using legacy API');
          return true;
        }
        console.warn('⚠️ NATIVE: OneSignal identity methods not available');
        return false;
      }
    }

    // For web environment
    console.log('🌐 WEB: Setting tag in web OneSignal');

    // Wait for OneSignal to be available
    let oneSignal = window.OneSignal as any;
    let retries = 0;
    while (!oneSignal && retries < 10) {
      await new Promise(r => setTimeout(r, 200));
      oneSignal = window.OneSignal as any;
      retries++;
    }

    if (!oneSignal) {
      console.warn('⚠️ WEB: OneSignal not available, cannot set tag');
      return false;
    }

    // Try using the newer API (OneSignal v6+)
    if (oneSignal.User && typeof oneSignal.User.addTag === 'function') {
      try {
        // LINK USER: This is the critical part for targeting by external_id
        if (typeof oneSignal.login === 'function') {
          await oneSignal.login(userId);
          console.log('✅ WEB: Logged in to OneSignal with userId:', userId);
        }

        await oneSignal.User.addTag('external_user_id', userId);
        console.log('✅ WEB: Tag "external_user_id" set successfully using User API:', userId);
        return true;
      } catch (e) {
        console.error('❌ WEB: Error setting identity with User API:', e);
        // Fall through to try legacy API
      }
    }

    // Try legacy API as fallback
    if (typeof oneSignal.setExternalUserId === 'function') {
      try {
        // For legacy API, this also handles setting it as external ID
        await oneSignal.setExternalUserId(userId);
        console.log('✅ WEB: External user ID set successfully using legacy API:', userId);
        return true;
      } catch (e) {
        console.error('❌ WEB: Error setting external ID with legacy API:', e);
      }
    }

    // Try tagging with legacy API
    if (typeof oneSignal.sendTag === 'function') {
      try {
        oneSignal.sendTag('external_user_id', userId);
        console.log('✅ WEB: Tag "external_user_id" set successfully using sendTag:', userId);
        return true;
      } catch (e) {
        console.error('❌ WEB: Error setting tag with sendTag:', e);
      }
    }

    console.warn('⚠️ WEB: Could not set OneSignal tag - no compatible API available');
    return false;
  } catch (error) {
    console.error('❌ Error in setOneSignalUserIdTag:', error);
    return false;
  }
}

/**
 * Initialize OneSignal SDK (web only)
 * For native apps, OneSignal is initialized from MainActivity.java
 */
export async function initializeOneSignal(): Promise<void> {
  try {
    if (window.OneSignalInitialized) {
      console.log('✅ OneSignal already initialized, skipping re-init');
      return;
    }

    try {
      // Check if running in Capacitor/native environment
      const { isCapacitor } = await import('@/lib/capacitor-notifications');

      if (isCapacitor()) {
        console.log('📱 Running in Capacitor environment - OneSignal initialized natively');
        return;
      }
    } catch (e) {
      console.error('Error checking Capacitor environment:', e);
    }

    // Web environment - load OneSignal SDK from CDN
    try {
      if (!window.OneSignal) {
        const script = document.createElement('script');
        script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
        script.async = true;
        script.onerror = () => {
          console.error('Failed to load OneSignal SDK from CDN');
        };
        document.head.appendChild(script);
        await new Promise<void>((resolve) => {
          script.onload = () => resolve();
          setTimeout(resolve, 5000); // Timeout after 5 seconds
        });
      }

      if (window.OneSignal) {
        try {
          window.OneSignal.init({ appId: ONESIGNAL_APP_ID });
          window.OneSignalInitialized = true;
          if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
            try {
              await Notification.requestPermission();
            } catch (e) {
              console.warn('Failed to request notification permission:', e);
            }
          }
          console.log('✅ OneSignal initialized successfully (Web)');
        } catch (e) {
          console.error('Error initializing OneSignal SDK:', e);
        }
      } else {
        console.warn('OneSignal SDK not loaded');
      }
    } catch (e) {
      console.error('Error loading OneSignal SDK from CDN:', e);
    }
  } catch (e) {
    console.error('❌ Error initializing OneSignal:', e);
  }
}


import { auth } from '@/lib/firebase';
import { saveUserDevice } from '@/lib/supabase-user-devices';
import { getPlayerIdFromNativeDevices } from '@/lib/supabase-native-devices';
import { supabase } from '@/lib/supabase';
import { deleteBookingFromSupabase } from '@/lib/supabase-bookings';
import { getShopOwnersByShopId } from '@/lib/supabase-shop-owners';

/**
 * Initialize OneSignal and request notification permissions
 * For native: subscription listener will capture player_id when user allows notifications
 * For web: request Notification permission
 */
export async function ensurePushSubscribed(): Promise<void> {
  try {
    const { isCapacitor, initializeCapacitorOneSignal } = await import('@/lib/capacitor-notifications');

    if (isCapacitor()) {
      console.log('📱 Initializing OneSignal for native app...');
      await initializeCapacitorOneSignal();
      console.log('✅ OneSignal initialized - subscription listener is active');
    } else {
      console.log('🌐 Initializing OneSignal for web...');
      await initializeOneSignal();

      // Request web notification permission
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        try {
          console.log('🔔 Requesting web notification permission...');
          await Notification.requestPermission();
        } catch (e) {
          console.warn('⚠️ Failed to request permission:', e);
        }
      }
    }
  } catch (e) {
    console.error('❌ Error initializing push:', e);
  }
}

/**
 * Send a notification via Supabase Edge Function (backend) to bypass CORS
 * NOTE: Prefer sendNotificationToCurrentDevice/sendNotificationToUserDevice for targeted sends
 */
export async function sendNotificationViaOneSignal(payload: NotificationPayload): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const authHeader = session?.access_token ? `Bearer ${session.access_token}` : `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`;
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        playerIds: [],
        title: payload.title,
        body: payload.body,
        actionButtons: payload.actionButtons || [],
        data: {
          tokenNumber: payload.tokenNumber?.toString() || '',
          shopName: payload.shopName || '',
          userName: payload.userName || '',
          userPhone: payload.userPhone || '',
          timeSlot: payload.timeSlot || '',
          serviceName: payload.serviceName || '',
        },
      }),
    });

    if (!response.ok) {
      console.error('❌ Error sending notification:', await response.text());
      return false;
    }

    console.log('✅ Notification sent successfully via Supabase Edge Function');
    return true;
  } catch (error) {
    console.error('❌ Error sending notification:', error);
    return false;
  }
}

/**
 * Send notification only to THIS browser/device (the one who clicked the button)
 * NATIVE: Uses player_id from native_devices table with OneSignal Native API
 * WEB: Uses OneSignal web subscription
 */
export async function sendNotificationToCurrentDevice(payload: NotificationPayload): Promise<boolean> {
  try {
    console.log('🔔 sendNotificationToCurrentDevice called');

    // Check if running in native (Capacitor) environment
    const { isCapacitor } = await import('@/lib/capacitor-notifications');
    const isNative = isCapacitor();

    console.log(`🔍 Environment: ${isNative ? 'NATIVE 📱' : 'WEB 🌐'}`);

    if (isNative) {
      // ===== NATIVE PATH =====
      console.log('📱 NATIVE: Getting player ID from native_devices table...');

      if (!auth.currentUser) {
        console.error('❌ NATIVE: No user logged in');
        return false;
      }

      const userId = auth.currentUser.uid;
      console.log('👤 NATIVE: User ID:', userId);

      const { getPlayerIdFromNativeDevices } = await import('@/lib/supabase-native-devices');
      const tablePlayerId = await getPlayerIdFromNativeDevices(userId);

      if (!tablePlayerId) {
        console.warn('⚠️ NATIVE: Player ID NOT FOUND in native_devices table');
        console.warn('💡 NATIVE: Using External ID (User ID) as fallback...');
        console.warn('⚠️ NATIVE: Possible causes for missing player ID:');
        console.warn('   1. OneSignal permission popup never appeared');
        console.warn('   2. User did not allow notifications');
        console.warn('   3. Subscription event did not fire');
        console.warn('   4. Device not properly registered with OneSignal');
        console.log('📱 NATIVE: Attempting to send via External ID instead...');

        // Fallback: Send using external ID (user ID) that was set via setOneSignalUserIdTag
        const success = await sendNotificationByUserId([userId], payload);

        if (success) {
          console.log('✅ NATIVE: Notification sent via External ID (User ID)');
        } else {
          console.error('❌ NATIVE: Failed to send via External ID as well');
        }

        return success;
      }

      console.log('✅ NATIVE: Player ID found:', tablePlayerId);
      console.log('📤 NATIVE: Calling sendNotificationToPlayerIds...');

      const success = await sendNotificationToPlayerIds([tablePlayerId], payload);

      if (success) {
        console.log('✅ NATIVE: Notification delivered to OneSignal API');
      } else {
        console.error('❌ NATIVE: Failed to send through OneSignal API');
      }

      return success;
    }

    // ===== WEB PATH =====
    console.log('🌐 WEB: Preparing web notification...');

    const requestPayload: Record<string, unknown> = {
      playerIds: [],
      title: payload.title,
      body: payload.body,
      actionButtons: payload.actionButtons || [],
      data: {
        tokenNumber: payload.tokenNumber?.toString() || '',
        shopName: payload.shopName || '',
        userName: payload.userName || '',
        userPhone: payload.userPhone || '',
        timeSlot: payload.timeSlot || '',
        serviceName: payload.serviceName || '',
      },
    };

    if (payload.imageUrl) {
      requestPayload.big_picture = payload.imageUrl;
      requestPayload.image = payload.imageUrl;
    }

    console.log('📡 WEB: Sending to Supabase send-notification function...');

    const { data: { session } } = await supabase.auth.getSession();
    const authHeader = session?.access_token ? `Bearer ${session.access_token}` : `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`;
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(requestPayload),
    });

    const responseText = await response.text();
    console.log(`📋 WEB: Response status: ${response.status}`);
    console.log(`📋 WEB: Response:`, responseText);

    if (!response.ok) {
      console.error('❌ WEB: Error sending notification:', responseText);
      return false;
    }

    console.log('✅ WEB: Notification sent successfully');
    return true;
  } catch (error) {
    console.error('❌ sendNotificationToCurrentDevice error:', error);
    return false;
  }
}

/**
 * Send notification only to the device belonging to the given userId that clicked (matches current subscription)
 * Reads user_devices (user_id, player_id) in Supabase and targets only that device
 */
export async function sendNotificationToUserDevice(userId: string, payload: NotificationPayload): Promise<boolean> {
  try {
    if (!userId) {
      console.error('❌ No userId provided');
      return false;
    }

    console.log(`👤 Sending notification to user: ${userId}`);
    console.log('📱 Getting current device player ID...');
    const currentId = await ensurePushSubscribed();
    if (!currentId) {
      console.error('❌ Could not get player ID for current device');
      return false;
    }

    console.log(`🔍 Looking up user device in Supabase for userId: ${userId}, playerId: ${currentId}`);

    const { data, error } = await (await import('@/lib/supabase')).supabase
      .from('user_devices')
      .select('id, player_id')
      .eq('user_id', userId)
      .eq('player_id', currentId)
      .limit(1);

    if (error) {
      console.error('❌ Supabase error reading user_devices:', JSON.stringify(error, null, 2));
      return false;
    }

    if (!data || data.length === 0) {
      console.log('⚠️ No matching user_device found, falling back to current device');
      return sendNotificationToCurrentDevice(payload);
    }

    console.log(`✅ Found user device record:`, data[0]);

    const targetId = currentId;
    console.log(`📤 Sending notification to player ID: ${targetId}`);
    console.log(`📝 Notification content:`, { title: payload.title, body: payload.body });

    const requestPayload: Record<string, unknown> = {
      include_player_ids: [targetId],
      title: payload.title,
      body: payload.body,
      data: {
        tokenNumber: payload.tokenNumber?.toString() || '',
        shopName: payload.shopName || '',
        userName: payload.userName || '',
        userPhone: payload.userPhone || '',
        timeSlot: payload.timeSlot || '',
        serviceName: payload.serviceName || '',
      },
    };

    if (payload.imageUrl) {
      requestPayload.big_picture = payload.imageUrl;
      requestPayload.image = payload.imageUrl;
    }

    if (payload.actionButtons?.length) {
      requestPayload.actionButtons = payload.actionButtons;
    }

    console.log('📡 Sending to Supabase function:', JSON.stringify(requestPayload));

    const { data: { session } } = await supabase.auth.getSession();
    const authHeader = session?.access_token ? `Bearer ${session.access_token}` : `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`;
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(requestPayload),
    });

    const responseText = await response.text();
    console.log(`📋 Supabase response status: ${response.status}`);
    console.log(`📋 Supabase response:`, responseText);

    if (!response.ok) {
      console.error('❌ Error sending targeted notification:', responseText);
      return false;
    }

    console.log('✅ Targeted notification sent to user device via Supabase match');
    return true;
  } catch (error) {
    console.error('❌ Error sending targeted notification (user):', error);
    return false;
  }
}

/**
 * Send notification to a native device user by fetching their player_id from the table
 * This is the preferred way to send notifications to native app users
 */
export async function sendNotificationToNativeUser(userId: string, payload: NotificationPayload): Promise<boolean> {
  try {
    if (!userId) {
      console.error('❌ No userId provided');
      return false;
    }

    console.log('📱 Sending notification to native user:', userId);

    // Get player ID from native_devices table
    const { getPlayerIdFromNativeDevices } = await import('@/lib/supabase-native-devices');
    const playerId = await getPlayerIdFromNativeDevices(userId);

    if (!playerId) {
      console.error('❌ Account is not fully registered. Player ID is missing. Please wait for registration to complete or contact support.');
      return false;
    }

    console.log('✅ Found player ID from table:', playerId);

    // Send notification to this player ID
    return sendNotificationToPlayerIds([playerId], payload);
  } catch (error) {
    console.error('❌ Error sending notification to native user:', error);
    return false;
  }
}

/**
 * Send notification to multiple player IDs (e.g., shop owners)
 */
export async function sendNotificationToPlayerIds(playerIds: string[], payload: NotificationPayload): Promise<boolean> {
  try {
    if (!playerIds || playerIds.length === 0) {
      console.warn('⚠️ No player IDs provided for notification');
      return false;
    }

    // Filter out null/undefined values
    const validPlayerIds = playerIds.filter((id): id is string => id !== null && id !== undefined && id.length > 0);

    if (validPlayerIds.length === 0) {
      console.warn('⚠️ No valid player IDs after filtering');
      return false;
    }

    console.log(`📤 Sending notification to ${validPlayerIds.length} player(s)`);
    console.log(`📝 Notification content:`, { title: payload.title, body: payload.body });
    console.log(`🎯 Target player IDs:`, validPlayerIds);

    const requestPayload: Record<string, unknown> = {
      include_player_ids: validPlayerIds,
      title: payload.title,
      body: payload.body,
      data: {
        tokenNumber: payload.tokenNumber?.toString() || '',
        shopName: payload.shopName || '',
        userName: payload.userName || '',
        userPhone: payload.userPhone || '',
        timeSlot: payload.timeSlot || '',
        serviceName: payload.serviceName || '',
      },
    };

    if (payload.imageUrl) {
      requestPayload.big_picture = payload.imageUrl;
      requestPayload.image = payload.imageUrl;
    }

    if (payload.actionButtons?.length) {
      requestPayload.actionButtons = payload.actionButtons;
    }

    console.log('📡 Sending to Supabase native-notification function:', JSON.stringify(requestPayload));

    const { data: { session } } = await supabase.auth.getSession();
    const authHeader = session?.access_token ? `Bearer ${session.access_token}` : `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`;
    // Use send-native-notification for player IDs (native Android/iOS devices)
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-native-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(requestPayload),
    });

    const responseText = await response.text();
    console.log(`📋 Supabase response status: ${response.status}`);
    console.log(`📋 Supabase response:`, responseText);

    if (!response.ok) {
      console.error('❌ Error sending notification to player IDs:', responseText);
      return false;
    }

    console.log(`✅ Notification sent successfully to ${validPlayerIds.length} player(s)`);
    return true;
  } catch (error) {
    console.error('❌ Error sending notification to player IDs:', error);
    return false;
  }
}

/**
 * Send a broadcast notification to ALL users (e.g., for a new shop offer)
 */
export async function sendBroadcastNotification(
  title: string, 
  body: string, 
  image?: string, 
  shopId?: string
): Promise<boolean> {
  try {
    console.log('📢 Sending broadcast notification to all users...');
    const { data: { session } } = await supabase.auth.getSession();
    const authHeader = session?.access_token ? `Bearer ${session.access_token}` : `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`;
    
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-broadcast-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        title,
        messageBody: body,
        image,
        data: {
          type: 'offer',
          shopId,
          click_action: 'FLUTTER_NOTIFICATION_CLICK' // Ensure deep-linking works on Android
        },
      }),
    });

    if (!response.ok) {
      console.error('❌ Error sending broadcast notification:', await response.text());
      return false;
    }

    console.log('✅ Broadcast notification sent successfully');
    return true;
  } catch (error) {
    console.error('❌ Error sending broadcast notification:', error);
    return false;
  }
}

/**
 * Send scheduled reminder notification
 * Uses a 3-layer approach for maximum reliability:
 * 1. Save to Supabase database for server-side processing via cron
 * 2. Save locally for app-based fallback
 * 3. Legacy OneSignal scheduling as additional fallback
 */
export async function sendScheduledReminderNotification(
  userId: string,
  bookingData: {
    bookingId: string;
    shopId: string;
    shopName: string;
    tokenNumber: number;
    userName: string;
    timeSlot: string;
    bookingDate: string;
    reminderTime: string;
  },
  options?: {
    isShopOwnerAlarm?: boolean;
  }
): Promise<boolean> {
  try {
    if (!userId) {
      console.error('❌ No user ID provided for reminder notification');
      return false;
    }

    console.log('📤 Scheduling reminder notification for', bookingData.reminderTime, '...');

    // Get user's timezone offset
    const timezoneOffsetMinutes = new Date().getTimezoneOffset();
    const timezoneOffsetHours = -timezoneOffsetMinutes / 60;

    console.log(`📍 User timezone offset: UTC${timezoneOffsetHours > 0 ? '+' : ''}${timezoneOffsetHours}`);

    let successCount = 0;

    // LAYER 1: Save to Supabase database for server-side cron processing
    try {
      const { saveReminderToSupabase } = await import('@/lib/supabase-reminders');
      const result = await saveReminderToSupabase(userId, bookingData.bookingId, {
        shopId: bookingData.shopId,
        shopName: bookingData.shopName,
        tokenNumber: bookingData.tokenNumber,
        userName: bookingData.userName,
        timeSlot: bookingData.timeSlot,
        bookingDate: bookingData.bookingDate,
        reminderTime: bookingData.reminderTime,
        timezoneOffsetHours: timezoneOffsetHours,
      });
      if (result) {
        console.log('✅ Layer 1: Reminder saved to Supabase for cron processing');
        successCount++;
      }
    } catch (e) {
      console.warn('⚠️ Layer 1 failed - Supabase save:', e);
    }

    // LAYER 2: Save locally as a fallback mechanism
    try {
      const { saveReminderLocally } = await import('@/lib/local-reminders');
      const reminder = saveReminderLocally(
        userId,
        bookingData.bookingId,
        bookingData.reminderTime,
        bookingData.bookingDate,
        bookingData.shopName,
        bookingData.tokenNumber,
        bookingData.userName,
        bookingData.timeSlot,
        bookingData.shopId,
        timezoneOffsetHours
      );

      // Mark as shop owner alarm if specified
      if (options?.isShopOwnerAlarm && reminder) {
        reminder.isShopOwnerAlarm = true;
        const reminders = (await import('@/lib/local-reminders')).getAllReminders();
        const updatedReminders = reminders.map(r => r.id === reminder.id ? reminder : r);
        localStorage.setItem('bookbarber_reminders', JSON.stringify(updatedReminders));
      }

      console.log('✅ Layer 2: Reminder saved locally as fallback');
      successCount++;
    } catch (e) {
      console.warn('⚠️ Layer 2 failed - Local save:', e);
    }

    // LAYER 3: Legacy OneSignal scheduling (deprecated but kept for compatibility)
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authHeader = session?.access_token ? `Bearer ${session.access_token}` : `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`;
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-native-reminder-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({
          userId,
          bookingId: bookingData.bookingId,
          shopId: bookingData.shopId,
          shopName: bookingData.shopName,
          tokenNumber: bookingData.tokenNumber,
          userName: bookingData.userName,
          timeSlot: bookingData.timeSlot,
          bookingDate: bookingData.bookingDate,
          reminderTime: bookingData.reminderTime,
          timezoneOffsetHours: timezoneOffsetHours,
        }),
      });

      const responseText = await response.text();
      if (response.ok) {
        console.log('✅ Layer 3: OneSignal scheduling succeeded');
        successCount++;
      } else {
        console.warn('⚠️ Layer 3 failed - OneSignal scheduling:', responseText);
      }
    } catch (e) {
      console.warn('⚠️ Layer 3 failed - OneSignal request:', e);
    }

    if (successCount === 0) {
      console.error('❌ All scheduling methods failed!');
      return false;
    }

    console.log(`✅ Reminder scheduled via ${successCount} fallback layer(s)`);
    return true;
  } catch (error) {
    console.error('❌ Error in sendScheduledReminderNotification:', error);
    return false;
  }
}

/**
 * Send notification to users by their user_id (External ID in OneSignal)
 * This is the preferred way to send notifications after linking devices with OneSignal.login(user_id)
 *
 * USAGE:
 * const success = await sendNotificationByUserId(
 *   ['user-123', 'user-456'],
 *   {
 *     title: 'Hello',
 *     body: 'This is a notification',
 *     shopName: 'My Shop'
 *   }
 * );
 *
 * @param userIds - Array of user IDs (External IDs in OneSignal)
 * @param payload - Notification payload with title, body, etc.
 * @returns Promise<boolean> - true if notification sent successfully
 */
export async function sendNotificationByUserId(userIds: string[], payload: NotificationPayload): Promise<boolean> {
  try {
    if (!userIds || userIds.length === 0) {
      console.error('❌ No user IDs provided');
      return false;
    }

    // Filter out null/undefined values
    const validUserIds = userIds.filter((id): id is string => id !== null && id !== undefined && id.length > 0);

    if (validUserIds.length === 0) {
      console.warn('⚠️ No valid user IDs after filtering');
      return false;
    }

    console.log(`📱 Sending notification to ${validUserIds.length} user(s) via External ID`);
    console.log(`📝 Notification content:`, { title: payload.title, body: payload.body });
    console.log(`🎯 Target user IDs:`, validUserIds);

    const requestPayload: Record<string, unknown> = {
      user_ids: validUserIds,
      title: payload.title,
      body: payload.body,
      data: {
        tokenNumber: payload.tokenNumber?.toString() || '',
        shopName: payload.shopName || '',
        userName: payload.userName || '',
        userPhone: payload.userPhone || '',
        timeSlot: payload.timeSlot || '',
        serviceName: payload.serviceName || '',
      },
    };

    if (payload.imageUrl) {
      requestPayload.big_picture = payload.imageUrl;
      requestPayload.image = payload.imageUrl;
    }

    if (payload.actionButtons?.length) {
      requestPayload.actionButtons = payload.actionButtons;
    }

    console.log('📡 Sending to Supabase send-notification-by-userid function:', JSON.stringify(requestPayload));

    const { data: { session } } = await supabase.auth.getSession();
    const authHeader = session?.access_token ? `Bearer ${session.access_token}` : `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`;

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-notification-by-userid`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(requestPayload),
    });

    const responseText = await response.text();
    console.log(`📋 Supabase response status: ${response.status}`);
    console.log(`📋 Supabase response:`, responseText);

    if (!response.ok) {
      console.error('❌ Error sending notification to user IDs:', responseText);
      return false;
    }

    console.log(`✅ Notification sent successfully to ${validUserIds.length} user(s) via External ID`);
    return true;
  } catch (error) {
    console.error('❌ Error sending notification by user ID:', error);
    return false;
  }
}

/**
 * Setup handler for reminder notification button clicks and local reminder monitor
 */
export function setupReminderNotificationHandler(onReminderAlarm?: (reminder: any) => void): void {
  try {
    // Initialize local reminder monitor
    // The onReminderAlarm callback will trigger the alarm UI when a reminder is due
    if (onReminderAlarm) {
      console.log('🔔 Registering reminder alarm callback for UI display');
      // Import dynamically to avoid circular dependencies
      import('@/lib/local-reminders').then(({ setAlarmCallback, startReminderMonitor }) => {
        try {
          // Set the alarm callback to display the UI toast
          setAlarmCallback(onReminderAlarm);
          console.log('✅ Alarm callback registered - will show toast when reminder triggers');

          // Start the local reminder monitor
          // This checks localStorage every minute for reminders that are due
          startReminderMonitor((reminder: any) => {
            console.log('⏰ Local reminder triggered:', reminder.bookingId);
            // The alarm callback is already set, so it will be called by local-reminders
          });
          console.log('✅ Local reminder monitor started');
        } catch (e) {
          console.error('⚠️ Failed to setup local reminder monitor:', e);
        }
      }).catch(e => {
        console.error('⚠️ Failed to import local-reminders module:', e);
      });
    } else {
      console.warn('⚠️ No alarm callback provided to setupReminderNotificationHandler');
    }

    if (!window.OneSignal) {
      console.warn('⚠️ OneSignal not available yet, will retry');
      const timer = setTimeout(() => {
        try {
          setupReminderNotificationHandler();
        } catch (e) {
          console.error('Error retrying setupReminderNotificationHandler:', e);
        }
      }, 1000);
      return;
    }

    console.log('🔔 Setting up reminder notification click handler...');

    // Listen for action button clicks (Yes/No buttons)
    if (window.OneSignal?.Notifications?.addEventListener) {
      window.OneSignal.Notifications.addEventListener('click', (event: any) => {
        try {
          const notification = event?.notification;
          const buttonId = event?.result?.actionId;

          console.log('🔔 Notification action clicked:', { buttonId, notification, eventResult: event?.result });

          if (!buttonId || !notification?.data) {
            console.warn('⚠️ Missing buttonId or notification data:', { hasButtonId: !!buttonId, hasData: !!notification?.data });
            return;
          }

          const bookingId = notification.data.bookingId;
          const shopId = notification.data.shopId;
          const shopName = notification.data.shopName;
          const tokenNumber = notification.data.tokenNumber;
          const userName = notification.data.userName;
          const timeSlot = notification.data.timeSlot;

          console.log('🔔 Processing button action:', { buttonId, bookingId });

          if (buttonId.startsWith('yes-')) {
            console.log('✅ User confirmed they are coming');
            handleReminderYes({ bookingId, shopId, shopName, tokenNumber, userName, timeSlot });
          } else if (buttonId.startsWith('no-')) {
            console.log('❌ User cancelled appointment');
            handleReminderNo(bookingId);
          }
        } catch (e) {
          console.error('Error handling notification click:', e);
        }
      });
    }
  } catch (e) {
    console.error('Error setting up reminder notification handler:', e);
  }
}

/**
 * Send local reminder notification when it's time
 * This is used as a fallback when OneSignal scheduling doesn't work
 */
async function sendLocalReminderNotification(reminder: any): Promise<void> {
  try {
    console.log('🔔 Sending local reminder notification:', reminder.bookingId);

    const { isCapacitor } = await import('@/lib/capacitor-notifications');
    const { deleteReminder } = await import('@/lib/local-reminders');

    if (isCapacitor()) {
      // For native apps, use OneSignal to send the notification
      console.log('📱 Sending local reminder via OneSignal (native)');

      const oneSignal = window.OneSignal as any;
      if (oneSignal && oneSignal.Notifications?.sendLaunchURL) {
        try {
          // Send notification with action buttons
          const payload = {
            title: '🔔 Appointment Reminder',
            body: `Are you ready to come to ${reminder.shopName} for your appointment at ${reminder.timeSlot}?`,
            data: {
              bookingId: reminder.bookingId,
              tokenNumber: reminder.tokenNumber,
              shopName: reminder.shopName,
              userName: reminder.userName,
              timeSlot: reminder.timeSlot,
              shopId: reminder.shopId,
              actionType: 'reminder',
            },
          };

          // Try to send via OneSignal if available
          await sendNotificationToCurrentDevice({
            title: payload.title,
            body: payload.body,
            tokenNumber: String(reminder.tokenNumber),
            shopName: reminder.shopName,
            userName: reminder.userName,
            timeSlot: reminder.timeSlot,
          });

          console.log('✅ Local reminder sent successfully');
          deleteReminder(reminder.id);
        } catch (e) {
          console.warn('⚠️ Failed to send local reminder via OneSignal:', e);
        }
      } else {
        console.warn('⚠️ OneSignal notifications not available for local reminder');
      }
    } else {
      // For web apps, show a web notification
      console.log('🌐 Sending local reminder via Web Notifications');

      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification('🔔 Appointment Reminder', {
            body: `Are you ready to come to ${reminder.shopName} for your appointment at ${reminder.timeSlot}?`,
            icon: '/scissors-icon.svg',
            tag: `reminder-${reminder.bookingId}`,
          });

          console.log('✅ Web notification sent');
          deleteReminder(reminder.id);
        } else {
          console.warn('⚠️ Web notification permission not granted');
        }
      }
    }
  } catch (error) {
    console.error('❌ Error sending local reminder:', error);
  }
}

/**
 * Handle "Yes" button click on reminder notification
 */
async function handleReminderYes(bookingData: {
  bookingId: string;
  shopId: string;
  shopName: string;
  tokenNumber: string | number;
  userName: string;
  timeSlot: string;
}): Promise<void> {
  try {
    console.log('✅ User confirmed they are coming to the appointment');
    console.log('🔍 Booking data received:', bookingData);

    // Get current user's player ID to avoid sending duplicate notifications
    let currentUserPlayerId: string | null = null;
    if (auth.currentUser) {
      const { getPlayerIdFromNativeDevices } = await import('@/lib/supabase-native-devices');
      currentUserPlayerId = await getPlayerIdFromNativeDevices(auth.currentUser.uid);
    }
    console.log(`📱 Current device player ID: ${currentUserPlayerId}`);

    // Fetch shop owners for this shop
    console.log(`🔍 Fetching shop owners for shop ID: ${bookingData.shopId}`);
    const shopOwners = await getShopOwnersByShopId(bookingData.shopId);

    console.log(`���� Found ${shopOwners.length} shop owner(s)`, shopOwners.map(o => ({
      id: o.id,
      email: o.email,
      hasPlayerId: !!o.playerId,
    })));

    if (shopOwners.length === 0) {
      console.warn('⚠️ No shop owners found for this shop');
      return;
    }

    // Filter shop owners with valid player IDs
    // IMPORTANT: Exclude the current user's device to prevent duplicate notifications
    // if they're logged in as both user and shop owner on the same device
    let ownerPlayerIds = shopOwners
      .map((owner) => owner.playerId)
      .filter((id): id is string => id !== null && id !== undefined);

    const originalCount = ownerPlayerIds.length;
    ownerPlayerIds = ownerPlayerIds.filter(id => id !== currentUserPlayerId);

    if (ownerPlayerIds.length < originalCount) {
      console.log(`🔄 Filtered out ${originalCount - ownerPlayerIds.length} shop owner(s) on same device to avoid duplicate notifications`);
    }

    console.log(`🎯 Valid player IDs to notify: ${ownerPlayerIds.length}`, ownerPlayerIds);

    if (ownerPlayerIds.length === 0) {
      console.log('ℹ️ No other devices to notify (current device is same as shop owner device, or no shop owners have enabled notifications)');
      return;
    }

    // Send notification to shop owners
    console.log(`📤 Notifying ${ownerPlayerIds.length} shop owner(s)...`);
    const notificationPayload = {
      title: '✅ Customer Confirmed',
      body: `${bookingData.userName} confirmed they're coming! Token #${bookingData.tokenNumber} will arrive at ${bookingData.timeSlot}`,
      tokenNumber: bookingData.tokenNumber,
      shopName: bookingData.shopName,
      userName: bookingData.userName,
      timeSlot: bookingData.timeSlot,
    };

    console.log('📋 Notification payload:', notificationPayload);

    const success = await sendNotificationToPlayerIds(ownerPlayerIds, notificationPayload);

    if (success) {
      console.log('✅ Shop owners notified successfully');
    } else {
      console.error('❌ Failed to send notification to shop owners');
    }
  } catch (error) {
    console.error('❌ Error handling reminder yes:', error);
    console.error('📍 Stack trace:', error instanceof Error ? error.stack : 'Unknown error');
  }
}

/**
 * Handle "No" button click on reminder notification
 */
async function handleReminderNo(bookingId: string): Promise<void> {
  try {
    console.log('❌ User cancelled appointment, deleting booking...');

    const success = await deleteBookingFromSupabase(bookingId);
    if (success) {
      console.log('✅ Booking deleted successfully');
    } else {
      console.error('❌ Failed to delete booking');
    }
  } catch (error) {
    console.error('❌ Error handling reminder no:', error);
  }
}

/**
 * Notify shop owners that a customer confirmed from the alarm
 */
export async function notifyShopOwnersCustomerConfirmed(
  shopId: string,
  tokenNumber: number,
  userName: string,
  timeSlot: string,
  shopName: string,
  userPhone: string
): Promise<boolean> {
  try {
    const { getShopOwnersByShopId } = await import('@/lib/supabase-shop-owners');
    const { getNativeShopOwnersByShopId } = await import('@/lib/supabase-native-shop-owners');
    const { getPlayerIdFromNativeDevices } = await import('@/lib/supabase-native-devices');
    const { useAuth } = await import('@/contexts/AuthContext');

    const notificationPayload = {
      title: '✅ Customer Confirmed',
      body: `${userName} confirmed they're coming! Token #${tokenNumber} will arrive at ${timeSlot}`,
      tokenNumber,
      shopName,
      userName,
      timeSlot,
      userPhone,
    };

    console.log(`📤 Notifying shop owners about customer confirmation...`);

    // Get current user's player ID to avoid duplicate notifications
    let currentUserPlayerId: string | null = null;
    try {
      const { user } = useAuth?.() || {};
      if (user) {
        currentUserPlayerId = await getPlayerIdFromNativeDevices(user.uid);
      }
    } catch (e) {
      console.warn('⚠️ Could not get current user player ID:', e);
    }

    // Get shop owners
    const [shopOwners, nativeShopOwners] = await Promise.all([
      getShopOwnersByShopId(shopId),
      getNativeShopOwnersByShopId(shopId),
    ]);

    console.log(`👥 Found ${shopOwners.length} legacy shop owner(s) and ${nativeShopOwners.length} native shop owner(s)`);

    // Notify legacy shop owners
    if (shopOwners.length > 0) {
      let ownerPlayerIds = shopOwners
        .map((owner) => owner.playerId)
        .filter((id): id is string => id !== null && id !== undefined);

      // Filter out current user's device
      if (currentUserPlayerId) {
        ownerPlayerIds = ownerPlayerIds.filter(id => id !== currentUserPlayerId);
      }

      if (ownerPlayerIds.length > 0) {
        console.log(`📤 Notifying ${ownerPlayerIds.length} legacy shop owner(s)...`);
        await sendNotificationToPlayerIds(ownerPlayerIds, notificationPayload);
      }
    }

    // Notify native shop owners
    if (nativeShopOwners.length > 0) {
      const nativeOwnerUserIds = nativeShopOwners.map((owner) => owner.userId);
      if (nativeOwnerUserIds.length > 0) {
        console.log(`📤 Notifying ${nativeOwnerUserIds.length} native shop owner(s)...`);
        await sendNotificationByUserId(nativeOwnerUserIds, notificationPayload);
      }
    }

    console.log('✅ Shop owners notified about customer confirmation');
    return true;
  } catch (error) {
    console.error('❌ Error notifying shop owners:', error);
    return false;
  }
}
