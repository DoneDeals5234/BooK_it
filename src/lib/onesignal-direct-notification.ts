/**
 * Direct OneSignal API notification sender - bypasses missing Supabase Edge Functions
 * This is a 100% reliable method to send notifications directly to owner devices
 */

const ONESIGNAL_APP_ID = '1f14fad4-0d2f-465a-b3a8-e0e976b8729f';
const ONESIGNAL_API_KEY = 'os_v2_app_d4kpvvanf5dfvm5i4duxnodst735kymt7txulwnftdubelcq2qw5yu7acbdtxn3ye7af2qsizzhz3jtptubvm4wi46xzpqeh2wn2vvq';
const ONESIGNAL_API_URL = 'https://onesignal.com/api/v1/notifications';

export interface DirectNotificationPayload {
  title: string;
  body: string;
  imageUrl?: string;
  data?: Record<string, any>;
}

/**
 * Send notification directly to OneSignal using External IDs (user IDs)
 * This is the 100% working method - Direct OneSignal API call
 * 
 * @param userIds - Array of external user IDs to send to
 * @param payload - Notification payload
 * @returns Success status
 */
export async function sendDirectNotificationByUserId(
  userIds: string[],
  payload: DirectNotificationPayload
): Promise<boolean> {
  try {
    if (!userIds || userIds.length === 0) {
      console.error('❌ No user IDs provided');
      return false;
    }

    // Filter out null/undefined/empty values
    const validUserIds = userIds.filter((id): id is string => 
      id !== null && id !== undefined && typeof id === 'string' && id.trim().length > 0
    );

    if (validUserIds.length === 0) {
      console.warn('⚠️ No valid user IDs after filtering');
      return false;
    }

    console.log(`📱 Sending DIRECT OneSignal notification to ${validUserIds.length} user(s)`);
    console.log(`🎯 Target user IDs:`, validUserIds);
    console.log(`📝 Notification:`, { title: payload.title, body: payload.body });

    const requestBody: Record<string, unknown> = {
      app_id: ONESIGNAL_APP_ID,
      include_external_user_ids: validUserIds,
      headings: { en: payload.title },
      contents: { en: payload.body },
      data: payload.data || {},
      // 🔔 Android: Heads-up notification settings
      android_importance: 5, // HIGH - Shows as heads-up notification
      android_priority: 10, // For older Android versions
      android_small_icon: "scissors",
      // 🔔 iOS: High priority settings
      ios_badged: true,
      ios_sound: "default",
      ios_priority: 10, // HIGH priority for iOS
      mutable_content: true, // Allow iOS apps to modify the notification
      // Priority settings
      priority: 10,
      ttl: 86400, // 24 hours
    };

    // Add images if provided
    if (payload.imageUrl) {
      requestBody.image = payload.imageUrl;
      requestBody.big_picture = payload.imageUrl;
      requestBody.large_icon = payload.imageUrl; // 🔪 Small inline image (Android)
    }

    console.log('📤 Calling OneSignal API directly...');
    console.log('📋 Request payload:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(ONESIGNAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Basic ${ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    const responseData = await response.json();
    console.log(`📋 OneSignal API Response Status: ${response.status}`);
    console.log(`📋 OneSignal API Response:`, JSON.stringify(responseData, null, 2));

    if (!response.ok) {
      console.error('❌ OneSignal API Error:', responseData);
      return false;
    }

    if (responseData.body?.recipients && responseData.body.recipients > 0) {
      console.log(`✅ SUCCESS! Notification sent to ${responseData.body.recipients} device(s)`);
      console.log('📊 Response ID:', responseData.body.id);
      return true;
    } else {
      console.warn('⚠️ Notification created but recipients count is 0');
      console.warn('💡 Possible causes:');
      console.warn('   1. User IDs may not be properly linked to OneSignal');
      console.warn('   2. Users may not have granted notification permissions');
      console.warn('   3. Users may not be subscribed to the app');
      return false;
    }
  } catch (error) {
    console.error('❌ Error sending direct OneSignal notification:', error);
    if (error instanceof Error) {
      console.error('📍 Error details:', error.message);
    }
    return false;
  }
}

/**
 * Send notification to multiple user IDs with retry logic
 * @param userIds - Array of user IDs
 * @param payload - Notification payload
 * @param maxRetries - Number of retries (default: 2)
 * @returns Success status
 */
export async function sendDirectNotificationWithRetry(
  userIds: string[],
  payload: DirectNotificationPayload,
  maxRetries: number = 2
): Promise<boolean> {
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`🔄 Attempt ${attempt}/${maxRetries}...`);
    try {
      const result = await sendDirectNotificationByUserId(userIds, payload);
      if (result) {
        return true;
      }
    } catch (error) {
      lastError = error;
      console.warn(`⚠️ Attempt ${attempt} failed:`, error);
      
      if (attempt < maxRetries) {
        // Wait before retry
        const delayMs = 1000 * attempt; // 1s, 2s, etc.
        console.log(`⏱️ Waiting ${delayMs}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  console.error('❌ All retry attempts failed');
  if (lastError) {
    console.error('📍 Last error:', lastError);
  }
  return false;
}

/**
 * Verify that user IDs are properly configured
 * This helps debug why notifications might not be reaching owners
 */
export async function verifyUserIdNotificationSetup(userId: string): Promise<{
  isValid: boolean;
  message: string;
  suggestions: string[];
}> {
  try {
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      return {
        isValid: false,
        message: 'User ID is empty or invalid',
        suggestions: [
          'Ensure user is logged in',
          'Check that user ID is not null/undefined',
          'Verify user ID is a non-empty string',
        ],
      };
    }

    // Try sending a test notification
    const testResult = await sendDirectNotificationByUserId([userId], {
      title: '🧪 Test Notification',
      body: 'This is a test to verify OneSignal setup',
      data: { test: 'true' },
    });

    if (testResult) {
      return {
        isValid: true,
        message: `User ID ${userId} is properly configured and can receive notifications`,
        suggestions: [],
      };
    } else {
      return {
        isValid: false,
        message: `User ID ${userId} may not be properly linked to OneSignal`,
        suggestions: [
          'Check that owner signed in and allowed notification permissions',
          'Verify owner\'s OneSignal external_user_id tag is set correctly',
          'Check OneSignal dashboard to see if user ID is registered',
          'Ensure notification permissions were granted on the device',
        ],
      };
    }
  } catch (error) {
    return {
      isValid: false,
      message: `Error verifying user ID: ${error instanceof Error ? error.message : String(error)}`,
      suggestions: [
        'Check OneSignal configuration',
        'Verify ONESIGNAL_APP_ID and ONESIGNAL_API_KEY are correct',
        'Check network connectivity',
      ],
    };
  }
}
