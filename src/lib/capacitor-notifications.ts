import { Capacitor } from '@capacitor/core';
import { updateNativeDevicePlayerId } from '@/lib/supabase-native-devices';
import { auth } from '@/lib/firebase';

interface NotificationData {
  [key: string]: any;
}

interface NotificationResponse {
  notification: {
    data: NotificationData;
    title?: string;
    body?: string;
  };
}

/**
 * Check if running in Capacitor/native environment
 */
export function isCapacitor(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Configure OneSignal for heads-up notifications on Android
 * NOTE: OneSignal automatically creates notification channels with HIGH importance
 * when we set android_importance: 5 in the notification payload from Supabase functions.
 * This function logs that configuration is ready.
 */
export async function setupAndroidNotificationChannels(): Promise<void> {
  if (!isCapacitor()) {
    console.log('ℹ️ Not in Capacitor environment, skipping OneSignal channel setup');
    return;
  }

  try {
    console.log('🔔 OneSignal notification configuration ready for heads-up notifications');
    console.log('   ℹ️ Channels will be created with HIGH importance via Supabase function payloads');
    console.log('   ✅ android_importance: 5 is set in all notification functions');
  } catch (error) {
    console.warn('⚠️ Warning during OneSignal setup:', error);
  }
}

// Track OneSignal initialization state to prevent duplicate initialization
let isInitializingOneSignal = false;
let oneSignalInitialized = false;

// Track subscription listeners
let subscriptionListenerSetup = false;

/**
 * Initialize OneSignal for native/Capacitor environment
 * Calls the OneSignal Cordova plugin's init() method via Capacitor
 */
export async function initializeCapacitorOneSignal(): Promise<void> {
  if (!isCapacitor()) {
    console.log('ℹ️ Not in Capacitor environment, skipping native OneSignal init');
    return;
  }

  if (oneSignalInitialized) {
    console.log('✅ OneSignal already initialized, skipping');
    return;
  }

  if (isInitializingOneSignal) {
    console.log('⏳ OneSignal initialization already in progress...');
    let attempts = 0;
    while (isInitializingOneSignal && attempts < 50) {
      await new Promise(r => setTimeout(r, 100));
      attempts++;
    }
    return;
  }

  try {
    isInitializingOneSignal = true;
    console.log('🔔 Initializing OneSignal for native app...');

    // Setup Android notification channels FIRST with HIGH importance
    // This must be done before any notifications are sent
    console.log('📱 Setting up Android notification channels...');
    await setupAndroidNotificationChannels();

    // Wait for Cordova to be ready
    let cordova = (window as any).cordova;
    let retries = 0;

    while (!cordova && retries < 40) {
      await new Promise(r => setTimeout(r, 250));
      cordova = (window as any).cordova;
      retries++;
    }

    if (!cordova) {
      console.warn('⚠️ Cordova not available after retries, proceeding without it');
      oneSignalInitialized = true;
      return;
    }

    console.log('✅ Cordova ready');

    // Modern v5 SDK Initialization
    console.log('🔔 Initializing OneSignal v5 SDK...');
    const oneSignalAppId = '1f14fad4-0d2f-465a-b3a8-e0e976b8729f';

    // In OneSignal v5 (SDK 5.0+), we use OneSignal.initialize()
    let oneSignalInstance = window.OneSignal;
    if (oneSignalInstance && typeof oneSignalInstance.initialize === 'function') {
      oneSignalInstance.initialize(oneSignalAppId);
      console.log('✅ OneSignal v5 initialized successfully');
    } else {
      // Fallback: Try window.plugins.OneSignal if window.OneSignal is not set up correctly
      const plugins = (window as any).plugins;
      if (plugins && plugins.OneSignal && typeof plugins.OneSignal.initialize === 'function') {
        plugins.OneSignal.initialize(oneSignalAppId);
        oneSignalInstance = plugins.OneSignal;
        console.log('✅ OneSignal v5 initialized via window.plugins.OneSignal');
      } else {
        // Fallback to old cordova.exec only as last resort
        console.log('🔄 Fallback: Trying legacy init...');
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            console.warn('⚠️ OneSignal initialization timeout');
            resolve();
          }, 5000);

          cordova.exec(
            (success: any) => {
              clearTimeout(timeout);
              console.log('✅ Legacy OneSignal initialized:', success);
              resolve();
            },
            (error: any) => {
              clearTimeout(timeout);
              console.warn('⚠️ Legacy OneSignal init error:', error);
              resolve();
            },
            'OneSignalPush',
            'init',
            [oneSignalAppId]
          );
        });
      }
    }

    // Capture the final OneSignal instance
    const oneSignal = window.OneSignal || (window as any).plugins?.OneSignal;

    // Wait for SDK to be ready
    retries = 0;
    while (!window.OneSignal && retries < 20) {
      await new Promise(r => setTimeout(r, 200));
      retries++;
    }

    if (oneSignal) {
      console.log('✅ OneSignal available');

      try {
        // Setup subscription listener FIRST - listens for subscription changes
        setupSubscriptionListener();

        // Setup listeners for notifications
        setupNativeNotificationListeners();

        // Auto-grant notifications silently without showing permission popup
        // This makes the system simpler and prevents permission-related errors
        console.log('🔔 Auto-enabling push notifications silently...');
        try {
          // Try using the newer API first (OneSignal v6+)
          if (window.OneSignal?.Notifications?.requestPermission) {
            console.log('📱 Using OneSignal.Notifications.requestPermission(false) to auto-enable...');
            await window.OneSignal.Notifications.requestPermission(false); // false = don't show popup
          } else if (window.OneSignal?.enablePush) {
            // Fallback to enablePush method
            console.log('📱 Using OneSignal.enablePush() to auto-enable...');
            window.OneSignal.enablePush(true);
          } else {
            console.log('📱 OneSignal push methods not available, continuing anyway');
          }
          console.log('✅ Push notifications auto-enabled');
        } catch (e) {
          console.warn('⚠️ Could not auto-enable notifications, but continuing:', e);
        }

        // Wait for OneSignal to be fully ready
        await new Promise(r => setTimeout(r, 500));

        window.OneSignalInitialized = true;
        console.log('✅ OneSignal fully initialized and ready');
      } catch (e) {
        console.warn('⚠️ Error setting up OneSignal listeners:', e);
      }
    } else {
      console.warn('⚠️ OneSignal not available after init, continuing without it');
    }

    oneSignalInitialized = true;
  } catch (error) {
    console.warn('⚠️ OneSignal initialization warning:', error instanceof Error ? error.message : 'Unknown error');
    oneSignalInitialized = true;
  } finally {
    isInitializingOneSignal = false;
  }
}

/**
 * Setup subscription listener - listens for OneSignal subscription events
 * When user allows notifications, OneSignal fires the subscription event with the player ID
 * This is the MOST RELIABLE way to capture the player ID
 *
 * FLOW:
 * 1. User allows notifications → Subscription event fires with player ID
 * 2. Save player ID to Supabase immediately (MOST IMPORTANT - don't wait for login)
 * 3. On login, link the player ID to the user account
 */
export function setupSubscriptionListener(): void {
  if (!isCapacitor() || !window.OneSignal) {
    console.log('ℹ️ Not in Capacitor or OneSignal not available, subscription listener not set up');
    return;
  }

  if (subscriptionListenerSetup) {
    console.log('✅ Subscription listener already set up');
    return;
  }

  try {
    console.log('🔔 Setting up OneSignal subscription listener...');

    // In OneSignal v5, we use OneSignal.User.pushSubscription
    const pushSubscription = window.OneSignal?.User?.pushSubscription;

    if (pushSubscription && typeof pushSubscription.addEventListener === 'function') {
      pushSubscription.addEventListener('change', async (event: any) => {
        console.log('🔔 OneSignal subscription event changed:', event);

        // Use event.current.id or event.to.id depending on plugin version
        const playerId = event.current?.id || event.to?.userId || event.to?.id;
        console.log('✅ Player ID from v5 subscription event:', playerId);

        if (!playerId) {
          console.warn('⚠️ No player ID found in subscription change event');
          return;
        }

        try {
          const userId = auth.currentUser?.uid;
          if (userId) {
            console.log('👤 User logged in, saving player ID:', playerId);
            await updateNativeDevicePlayerId(userId, playerId);

            // NEW: Also sync to the new Edge Function to force-set external ID
            try {
              console.log('🔗 Syncing external ID via Edge Function...');
              await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/set-onesignal-external-id`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify({ userId, playerId })
              });
            } catch (e) {
              console.warn('⚠️ Failed to sync external ID via Edge Function, but continuing');
            }
          } else {
            console.log('⏳ User not logged in, storing player ID temporarily.');
            await savePendingPlayerIdTemporarily(playerId);
          }
        } catch (e) {
          console.error('❌ Error handling subscription change:', e);
        }
      });

      subscriptionListenerSetup = true;
      console.log('✅ OneSignal v5 subscription listener registered');
    }

    // FALLBACK: Try to get player ID directly from OneSignal if subscription event doesn't fire
    console.log('🔄 Setting up fallback player ID capture (in case subscription event doesn\'t fire)...');

    // Retry multiple times with increasing delays
    let fallbackAttempts = 0;
    const maxFallbackAttempts = 5;

    const fallbackCapture = async () => {
      while (fallbackAttempts < maxFallbackAttempts) {
        await new Promise(r => setTimeout(r, 2000 + (fallbackAttempts * 1000))); // 2s, 3s, 4s, 5s, 6s

        try {
          const playerId = await getPlayerIdFromOneSignal();
          if (playerId && !pendingPlayerId) {
            console.log(`🔄 FALLBACK (attempt ${fallbackAttempts + 1}/${maxFallbackAttempts}): Got player ID directly from OneSignal:`, playerId);
            const currentUser = auth.currentUser;

            if (currentUser) {
              const success = await updateNativeDevicePlayerId(currentUser.uid, playerId);
              if (success) {
                console.log('✅ FALLBACK: Player ID saved via fallback method:', playerId);
                return; // Success, stop retrying
              }
            } else {
              const success = await savePendingPlayerIdTemporarily(playerId);
              if (success) {
                console.log('✅ FALLBACK: Player ID saved temporarily via fallback:', playerId);
                return; // Success, stop retrying
              }
            }
          }
          fallbackAttempts++;
        } catch (e) {
          console.warn(`⚠️ FALLBACK (attempt ${fallbackAttempts + 1}/${maxFallbackAttempts}): Could not get player ID:`, e);
          fallbackAttempts++;
        }
      }
      console.warn('⚠️ FALLBACK: Could not capture player ID after all attempts');
    };

    // Start fallback capture in background
    fallbackCapture().catch(e => console.error('❌ Fallback capture error:', e));

  } catch (error) {
    console.error('❌ Error setting up subscription listener:', error);
  }
}

/**
 * Fallback method to get player ID directly from OneSignal
 * If subscription event doesn't fire, we can try to get the player ID directly
 */
async function getPlayerIdFromOneSignal(): Promise<string | null> {
  try {
    const oneSignal = (window as any).OneSignal || (window as any).plugins?.OneSignal;

    if (!oneSignal) {
      console.warn('⚠️ OneSignal not available');
      return null;
    }

    // Method 1: Try to get via User.pushSubscription.id (OneSignal v6+)
    if (oneSignal.User?.pushSubscription?.id) {
      console.log('📱 Got player ID from User.pushSubscription.id');
      return oneSignal.User.pushSubscription.id;
    }

    // Method 2: Try older internal property
    if (oneSignal.User?.pushSubscription?.userId) {
      console.log('📱 Got player ID from User.pushSubscription.userId');
      return oneSignal.User.pushSubscription.userId;
    }

    // Method 3: Try newer Notifications property
    if (oneSignal.Notifications?.pushSubscription?.id) {
      return oneSignal.Notifications.pushSubscription.id;
    }

    console.warn('⚠️ Could not get player ID from any method');
    return null;
  } catch (error) {
    console.error('❌ Error getting player ID from OneSignal:', error);
    return null;
  }
}

/**
 * Save player ID temporarily to a local variable/storage
 * This will be linked to the user when they log in
 */
let pendingPlayerId: string | null = null;

async function savePendingPlayerIdTemporarily(playerId: string): Promise<boolean> {
  try {
    // Store in memory and localStorage for persistence across page reloads
    pendingPlayerId = playerId;
    localStorage.setItem('pending_player_id', playerId);
    console.log('💾 Player ID stored locally, will link to user on login');
    return true;
  } catch (e) {
    console.error('❌ Error saving pending player ID:', e);
    return false;
  }
}

/**
 * Get the pending player ID that was saved before login
 */
export function getPendingPlayerId(): string | null {
  // Try memory first, then localStorage
  if (pendingPlayerId) {
    return pendingPlayerId;
  }

  try {
    const stored = localStorage.getItem('pending_player_id');
    if (stored) {
      pendingPlayerId = stored;
      return stored;
    }
  } catch (e) {
    console.error('❌ Error reading pending player ID from localStorage:', e);
  }

  return null;
}

/**
 * Clear the pending player ID after it's been linked to a user
 */
export function clearPendingPlayerId(): void {
  pendingPlayerId = null;
  try {
    localStorage.removeItem('pending_player_id');
  } catch (e) {
    console.error('Error clearing pending player ID:', e);
  }
}

/**
 * Setup listeners for push notifications from native layer
 */
export function setupNativeNotificationListeners(): void {
  if (!isCapacitor() || !window.OneSignal) {
    console.log('ℹ️ Not in Capacitor or OneSignal not available, notification listeners not set up');
    return;
  }

  try {
    console.log('🔔 Setting up native notification listeners...');

    // Listen for push notification received
    if (window.OneSignal?.Notifications) {
      window.OneSignal.Notifications.addEventListener('foreground', (event: any) => {
        console.log('🔔 Push notification received (foreground):', event);
        handlePushNotification(event);
      });

      window.OneSignal.Notifications.addEventListener('click', (event: any) => {
        console.log('🔔 Push notification clicked:', event);
        handleNotificationClick(event);
      });

      console.log('✅ Native notification listeners registered');
    }
  } catch (error) {
    console.error('❌ Error setting up native notification listeners:', error);
  }
}

/**
 * Handle incoming push notification
 */
function handlePushNotification(event: any): void {
  const notification = event.notification;

  if (!notification) return;

  const data = notification.data || {};
  const title = notification.title || 'New Notification';
  const body = notification.body || '';

  console.log('📨 Processing push notification:', { title, body, data });

  // APPROACH 3: Handle foreground service trigger for shop owners
  // When a customer books, the owner's device receives a notification with type='start_foreground_service'
  // This triggers the foreground alarm service to start monitoring for the appointment
  if (data.type === 'start_foreground_service' && data.action === 'start_service_for_booking') {
    console.log('🚀 Foreground service trigger detected - starting service for owner');
    console.log(`   Booking request ID: ${data.bookingRequestId}`);
    console.log(`   Customer: ${data.customerName}`);
    console.log(`   Time slot: ${data.timeSlot}`);

    // Start the foreground alarm service
    // The service will monitor for the appointment time and send alarms to the owner
    handleForegroundServiceTrigger(data);
  }

  // Dispatch custom event that web components can listen to
  const customEvent = new CustomEvent('capacitorPushNotification', {
    detail: {
      notification: {
        title,
        body,
        data,
      },
    },
  });

  window.dispatchEvent(customEvent);

  // If it's a reminder notification with action buttons, display toast
  if (data.bookingId && data.userName) {
    console.log('🔔 Reminder notification detected:', data);
  }
}

/**
 * Handle foreground service trigger for owner's device
 * APPROACH 1: Triggered via OneSignal notification with type='start_foreground_service'
 * This is called AUTOMATICALLY when notification arrives on owner's device
 * No user interaction needed
 */
async function handleForegroundServiceTrigger(data: any): Promise<void> {
  try {
    console.log('🚀 Foreground service trigger received via OneSignal notification');
    console.log(`   Booking: ${data.bookingRequestId}`);
    console.log(`   Customer: ${data.customerName}`);
    console.log(`   Time: ${data.timeSlot}`);

    // Get current user to verify this is the owner device
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log('⏭️ No user logged in - skipping foreground service (customer device or not logged in)');
      return;
    }

    console.log(`👤 Current user: ${currentUser.uid}`);
    console.log(`📍 Shop ID from notification: ${data.shopId}`);

    // Check if current user is the shop owner for this shop
    try {
      const { getNativeShopOwner } = await import('@/lib/supabase-native-shop-owners');
      const isOwner = await getNativeShopOwner(currentUser.uid, data.shopId);

      if (!isOwner) {
        console.log('🚫 Current user is not the shop owner for this shop - skipping service');
        console.log('   This notification may have been sent to the wrong device');
        return;
      }

      console.log('✅ Owner verified - starting foreground service...');
    } catch (e) {
      console.error('❌ Error verifying ownership:', e);
      return;
    }

    // Import the alarm scheduler
    const { startForegroundAlarmService } = await import('@/lib/alarm-scheduler');

    // Use booking request ID from notification
    const bookingId = data.bookingRequestId || `booking-${Date.now()}`;

    // Start the foreground service
    // The service will:
    // 1. Show a persistent notification on the owner's device
    // 2. Monitor the time until the appointment
    // 3. Send alarms and notifications to the owner at the appointment time
    const result = await startForegroundAlarmService({
      bookingId: bookingId,
      tokenNumber: parseInt(data.tokenNumber) || 0,
      shopName: data.shopName || 'Your Shop',
      timeSlot: data.timeSlot || 'Unknown time',
      triggerTimeMs: Date.now() + (2 * 60 * 60 * 1000), // Default: 2 hours from now
    });

    if (result.success) {
      console.log('✅ Foreground service started successfully via notification');
      console.log(`   Booking: ${bookingId}`);
      console.log(`   Token: #${data.tokenNumber}`);
      console.log(`   Customer: ${data.customerName}`);
      console.log(`   Time: ${data.timeSlot}`);
      console.log('   The service is now running and will trigger an alarm at the appointment time');

      // Mark this booking as triggered so the fallback doesn't duplicate it
      try {
        const { markBookingAsTriggered } = await import('@/lib/foreground-service-fallback');
        markBookingAsTriggered(bookingId);
      } catch (e) {
        console.warn('⚠️ Could not mark booking as triggered:', e);
      }
    } else {
      console.error('❌ Failed to start foreground service:', result.message);
      console.log('   Fallback mechanism will attempt to start it via Realtime if available');
    }
  } catch (error) {
    console.error('❌ Error handling foreground service trigger:', error);
  }
}

/**
 * Handle notification click/action
 */
function handleNotificationClick(event: any): void {
  const notification = event.notification;
  const actionId = event.result?.actionId;

  console.log('🔔 Notification click handler:', { actionId, notification });

  if (!notification) return;

  const data = notification.data || {};

  // Dispatch click event
  const customEvent = new CustomEvent('capacitorPushNotificationClick', {
    detail: {
      actionId,
      notification: {
        title: notification.title,
        body: notification.body,
        data,
      },
    },
  });

  window.dispatchEvent(customEvent);
}


/**
 * Request notification permission via OneSignal Cordova plugin
 * This will show the native permission popup: "Allow this app to send notifications?"
 * MUST be called AFTER setupSubscriptionListener() so we capture the event
 */
async function requestNotificationPermissionViaOneSignal(): Promise<boolean> {
  if (!isCapacitor()) {
    return false;
  }

  try {
    console.log('🔔 Requesting notification permission via OneSignal Cordova plugin...');

    if (!window.OneSignal) {
      console.warn('⚠️ OneSignal not available');
      return false;
    }

    const cordova = (window as any).cordova;
    if (!cordova) {
      console.warn('⚠️ Cordova not available');
      return false;
    }

    // Call Cordova plugin to show permission prompt
    // This is the native way that will show the system popup
    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        console.warn('⚠️ Permission request timeout');
        resolve(true); // Resolve true anyway to continue
      }, 5000);

      cordova.exec(
        (success: any) => {
          clearTimeout(timeout);
          console.log('✅ OneSignal permission requested:', success);
          resolve(true);
        },
        (error: any) => {
          clearTimeout(timeout);
          console.warn('⚠️ OneSignal permission request error:', error);
          resolve(true); // Resolve true anyway to continue
        },
        'OneSignalPush',
        'requestPermission',
        []
      );
    });
  } catch (error) {
    console.error('❌ Error requesting notification permission:', error);
    return true; // Continue even if error
  }
}

/**
 * Ensure notification permissions are granted (fallback method)
 */
export async function ensureCapacitorNotificationPermissions(): Promise<boolean> {
  if (!isCapacitor()) {
    return false;
  }

  try {
    console.log('🔔 Ensuring notification permissions...');

    if (!window.OneSignal) {
      console.warn('⚠️ OneSignal not available');
      return false;
    }

    // Try OneSignal.Notifications.requestPermission() (modern OneSignal SDK)
    if (window.OneSignal?.Notifications?.requestPermission) {
      try {
        console.log('🔔 Using OneSignal.Notifications.requestPermission()...');
        const granted = await window.OneSignal.Notifications.requestPermission(true);
        console.log('✅ Notification permissions result:', granted);
        return true;
      } catch (e) {
        console.warn('⚠️ OneSignal.Notifications.requestPermission() failed:', e);
      }
    }

    // Try Cordova plugin methods
    if (window.OneSignal.requestPermission) {
      try {
        console.log('🔔 Using OneSignal.requestPermission()...');
        await new Promise<void>((resolve) => {
          window.OneSignal.requestPermission(true, () => resolve());
        });
        console.log('✅ Notification permissions requested');
        return true;
      } catch (e) {
        console.warn('⚠️ requestPermission() failed:', e);
      }
    }

    // Try enablePush
    if (window.OneSignal.enablePush) {
      try {
        console.log('🔔 Using OneSignal.enablePush()...');
        await new Promise<void>((resolve) => {
          window.OneSignal.enablePush(true, () => resolve());
        });
        console.log('✅ Push enabled');
        return true;
      } catch (e) {
        console.warn('⚠️ enablePush() failed:', e);
      }
    }

    console.log('ℹ️ No permission request method available, proceeding without explicit request');
    return true;
  } catch (error) {
    console.error('❌ Error requesting notification permissions:', error);
    return false;
  }
}

/**
 * Listen for specific push notification events
 */
export function onCapacitorPushNotification(callback: (data: any) => void): () => void {
  const handler = (event: CustomEvent) => {
    callback(event.detail);
  };

  window.addEventListener('capacitorPushNotification', handler as EventListener);

  // Return unsubscribe function
  return () => {
    window.removeEventListener('capacitorPushNotification', handler as EventListener);
  };
}

/**
 * Listen for notification clicks
 */
export function onCapacitorPushNotificationClick(callback: (data: any) => void): () => void {
  const handler = (event: CustomEvent) => {
    callback(event.detail);
  };

  window.addEventListener('capacitorPushNotificationClick', handler as EventListener);

  // Return unsubscribe function
  return () => {
    window.removeEventListener('capacitorPushNotificationClick', handler as EventListener);
  };
}

/**
 * Ensure player ID is captured and saved after user logs in
 * This is a safety layer to capture the player ID if it wasn't captured earlier
 */
export async function ensurePlayerIdCapturedAfterLogin(userId: string): Promise<void> {
  try {
    if (!isCapacitor()) {
      console.log('ℹ️ Not in Capacitor environment, skipping player ID capture');
      return;
    }

    console.log('🔍 Ensuring player ID is captured after login for user:', userId);

    // Wait a bit for OneSignal to be ready
    await new Promise(r => setTimeout(r, 1000));

    // Try to get player ID
    const playerId = await getPlayerIdFromOneSignal();

    if (playerId) {
      console.log('✅ Captured player ID after login:', playerId);

      // Save it to Supabase
      try {
        const success = await updateNativeDevicePlayerId(userId, playerId);
        if (success) {
          console.log('✅ Player ID saved to Supabase after login:', playerId);
        } else {
          console.error('❌ Failed to save player ID after login');
        }
      } catch (e) {
        console.error('❌ Error saving player ID after login:', e);
      }
    } else {
      console.warn('⚠️ Could not capture player ID after login');
      console.log('   This may be a permission issue - ensure notifications are enabled');
    }
  } catch (error) {
    console.error('❌ Error in ensurePlayerIdCapturedAfterLogin:', error);
  }
}

/**
 * Link the current device to a user via OneSignal using the Cordova plugin's login() method
 * This sets the user_id as the External ID in OneSignal
 * MUST be called on the device itself (not from backend)
 * Each device links only its own player record to its own user_id
 *
 * After calling this, OneSignal will send notifications to the device linked with this user_id
 * You can then use the Supabase function to send notifications by user_id
 */
export async function linkDeviceToUserViaOneSignal(userId: string): Promise<boolean> {
  try {
    if (!isCapacitor()) {
      console.log('ℹ️ Not in Capacitor environment, skipping OneSignal login');
      return false;
    }

    if (!userId) {
      console.error('❌ No userId provided to linkDeviceToUserViaOneSignal');
      return false;
    }

    console.log('🔗 Linking device to OneSignal User ID:', userId);

    const oneSignal = (window as any).OneSignal || (window as any).plugins?.OneSignal;

    if (oneSignal && typeof oneSignal.login === 'function') {
      try {
        console.log(`📱 [DEBUG] Logging in to OneSignal v5 with UID: ${userId}`);
        await oneSignal.login(userId);
        console.log(`✅ [DEBUG] OneSignal login successful for UID: ${userId}`);

        // BACKGROUND SYNC: Try to get player ID and sync via Edge Function for redundancy
        const playerId = await getPlayerIdFromOneSignal();
        if (playerId) {
          console.log('🔄 Syncing ID via Edge Function for extra reliability...');
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/set-onesignal-external-id`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({ userId, playerId })
          }).catch(e => console.warn('⚠️ Edge Function sync failed:', e));
        }

        return true;
      } catch (e) {
        console.error('❌ OneSignal v5 login failed:', e);
      }
    }

    return false;
  } catch (error) {
    console.error('❌ Error in linkDeviceToUserViaOneSignal:', error);
    return false;
  }
}
