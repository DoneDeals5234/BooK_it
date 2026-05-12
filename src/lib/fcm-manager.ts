import { getToken, onMessage } from 'firebase/messaging';
import { messaging } from '@/lib/firebase';
import { Capacitor } from '@capacitor/core';

// Firebase Cloud Messaging VAPID key (Web Push certificate from Firebase console)
const FCM_VAPID_KEY = 'BH9gOHm_tq4c8-cKcbS3gsaqEmR-aCExhB5Sr9ANLXFSBD_55Bh0JRIQFHJDihUHVI_KgqgtoRk-QMOk0F77aqw';

const SAVE_NATIVE_DEVICE_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-native-device`;

let fcmToken: string | null = null;
let fcmInitialized = false;

/**
 * Save FCM token to Supabase via the existing save-native-device Edge Function.
 * This reuses the same flow as OneSignal player_id saving.
 */
async function saveFcmTokenToSupabase(userId: string, token: string): Promise<void> {
  try {
    console.log('💾 Saving FCM token to Supabase for user:', userId);
    
    // Retrieve credentials to ensure they aren't lost
    let email = '';
    let password = '';
    try {
      const { Preferences } = await import('@capacitor/preferences');
      const credStr = await Preferences.get({ key: 'user_credentials' });
      if (credStr.value) {
        const creds = JSON.parse(credStr.value);
        email = creds.email || '';
        password = creds.password || '';
      }
    } catch (e) {
      console.warn('Could not retrieve credentials for FCM sync', e);
    }
    
    const payload: any = { userId, fcmToken: token };
    if (email) payload.email = email;
    if (password) payload.password = password;

    const response = await fetch(SAVE_NATIVE_DEVICE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error saving FCM token:', response.status, '-', errorText);
      return;
    }

    console.log('✅ FCM token saved to Supabase successfully');
  } catch (error) {
    console.error('❌ Error in saveFcmTokenToSupabase:', error);
  }
}

/**
 * Initialize Firebase Cloud Messaging and get the FCM token.
 * - On web: uses Firebase JS SDK to get push token
 * - On native (Capacitor): uses @capacitor-firebase/messaging plugin
 *
 * Saves the FCM token to the native_devices table in Supabase.
 * This runs in parallel with OneSignal and does NOT interfere with it.
 */
export async function initializeFcm(userId: string | null): Promise<string | null> {
  if (fcmInitialized) {
    console.log('✅ FCM already initialized, returning cached token:', fcmToken);
    return fcmToken;
  }

  // Get VAPID key from env or fallback
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || FCM_VAPID_KEY;
  console.log('🚀 Starting FCM initialization with VAPID key:', vapidKey.substring(0, 10) + '...');

  try {
    // ── NATIVE ANDROID (Capacitor) ──────────────────────────────────────────
    if (Capacitor.isNativePlatform()) {
      console.log('📱 Initializing FCM for native (Capacitor) platform...');
      try {
        // Use @capacitor-firebase/messaging plugin
        const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');

        console.log('🔔 Requesting FCM permissions (native)...');
        // Request permission
        const { receive } = await FirebaseMessaging.requestPermissions();
        console.log('🔔 FCM permission status:', receive);

        if (receive !== 'granted' && receive !== 'prompt-with-rationale') {
          console.warn('⚠️ FCM notifications permission denied on native');
        }

        console.log('🔑 Fetching FCM token (native)...');
        // Get FCM token
        const { token } = await FirebaseMessaging.getToken();
        if (!token) {
          console.warn('⚠️ Could not get FCM token on native (empty token)');
          return null;
        }

        console.log('✅ FCM token obtained (native):', token.substring(0, 20) + '...');
        fcmToken = token;
        fcmInitialized = true;

        // Save to Supabase if user is logged in
        if (userId) {
          await saveFcmTokenToSupabase(userId, token);
        } else {
          // Save to localStorage to sync later when user logs in
          localStorage.setItem('pending_fcm_token', token);
          console.log('💾 FCM token stored locally (user not logged in yet)');
        }

        // Listen for FCM messages in foreground
        await FirebaseMessaging.addListener('notificationReceived', async (event) => {
          console.log('🔔 FCM foreground notification received (native):', event);
          
          // Show a simple toast so the user knows something happened
          try {
            const { toast } = await import('react-hot-toast');
            toast.success(`${event.notification.title}\n${event.notification.body || ''}`, {
              duration: 5000,
              position: 'top-center',
            });
          } catch (e) {
            console.warn('Could not show toast for foreground notification', e);
          }
        });

        // ⭐ Listen for notification TAPS (background/killed) → Deep Link routing
        await FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
          console.log('👆 FCM notification tapped (native):', event);
          const data = event?.notification?.data || {};
          // Dispatch custom event that App.tsx's deep link handler listens to
          window.dispatchEvent(
            new CustomEvent('capacitorPushNotificationClick', {
              detail: { notification: { data }, action: 'tap' }
            })
          );
        });

        return token;
      } catch (e) {
        console.warn('⚠️ @capacitor-firebase/messaging error:', e instanceof Error ? e.message : e);
        // Fallback or just return null
        return null;
      }
    }

    // ── WEB ────────────────────────────────────────────────────────────────
    console.log('🌐 Initializing FCM for web platform...');
    const messagingInstance = await messaging;
    if (!messagingInstance) {
      console.log('ℹ️ Firebase Messaging not supported in this browser, skipping FCM');
      return null;
    }

    // Request browser notification permission
    console.log('🔔 Requesting notification permission (web)...');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('⚠️ Web notification permission denied, FCM token not retrieved');
      return null;
    }

    // Get FCM token for web
    console.log('🔑 Fetching FCM token (web)...');
    try {
      const token = await getToken(messagingInstance, { vapidKey });
      if (!token) {
        console.warn('⚠️ Could not get FCM token for web (empty token)');
        return null;
      }

      console.log('✅ FCM token obtained (web):', token.substring(0, 20) + '...');
      fcmToken = token;
      fcmInitialized = true;

      // Save to Supabase
      if (userId) {
        await saveFcmTokenToSupabase(userId, token);
      } else {
        localStorage.setItem('pending_fcm_token', token);
        console.log('💾 FCM token stored locally (user not logged in yet)');
      }

      // Listen for foreground messages on web
      onMessage(messagingInstance, (payload) => {
        console.log('🔔 FCM foreground message received (web):', payload);
        // Show a browser notification manually since FCM suppresses foreground notifications
        if (payload.notification) {
          const { title = 'Notification', body = '' } = payload.notification;
          if (Notification.permission === 'granted') {
            new Notification(title, { body, icon: '/icon-192.png' });
          }
        }
      });

      return token;
    } catch (tokenErr) {
      console.error('❌ Error getting FCM token (web):', tokenErr);
      return null;
    }
  } catch (error) {
    console.warn('⚠️ FCM initialization warning:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Call this after user logs in to sync any pending FCM token that was saved before login.
 */
export async function syncPendingFcmToken(userId: string): Promise<void> {
  try {
    const pendingToken = localStorage.getItem('pending_fcm_token');
    if (pendingToken) {
      console.log('🔄 Syncing pending FCM token after login for user:', userId);
      await saveFcmTokenToSupabase(userId, pendingToken);
      localStorage.removeItem('pending_fcm_token');
    }

    // Also re-init FCM if not done yet (to make sure the current token is saved)
    if (!fcmInitialized) {
      await initializeFcm(userId);
    } else if (fcmToken) {
      // Already initialized, just save the token for this user
      await saveFcmTokenToSupabase(userId, fcmToken);
    }
  } catch (error) {
    console.error('❌ Error syncing pending FCM token:', error);
  }
}

/**
 * Get the current FCM token (if initialized)
 */
export function getCurrentFcmToken(): string | null {
  return fcmToken;
}
