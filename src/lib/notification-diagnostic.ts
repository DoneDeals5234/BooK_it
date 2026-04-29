import { supabase } from '@/lib/supabase';

/**
 * Diagnostic tool to verify OneSignal and notification setup
 */
export async function diagnoseNotificationSetup(userId: string): Promise<{
  userId: string;
  oneSignalAvailable: boolean;
  oneSignalUserIdSet: boolean;
  supabaseSessionValid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  console.log('🔍 Starting notification diagnostic...');
  console.log('🆔 User ID:', userId);

  // Check OneSignal availability
  let oneSignalAvailable = false;
  let oneSignalUserIdSet = false;

  try {
    const oneSignal = window.OneSignal as any;
    if (oneSignal) {
      oneSignalAvailable = true;
      console.log('✅ OneSignal is available');

      // Try to check if user ID is set
      if (oneSignal.User && oneSignal.User.pushSubscriptionId) {
        const pushSubId = await oneSignal.User.pushSubscriptionId;
        console.log('📱 OneSignal push subscription ID:', pushSubId);
        oneSignalUserIdSet = !!pushSubId;
      }
    } else {
      errors.push('OneSignal not available in window');
      console.warn('⚠️ OneSignal not found');
    }
  } catch (e) {
    errors.push(`OneSignal check failed: ${e}`);
    console.error('❌ OneSignal check error:', e);
  }

  // Check Supabase session
  let supabaseSessionValid = false;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      supabaseSessionValid = true;
      console.log('✅ Supabase session is valid');
      console.log('📧 Authenticated as:', session.user.email);
    } else {
      errors.push('No Supabase session found');
      console.warn('⚠️ No Supabase session');
    }
  } catch (e) {
    errors.push(`Supabase session check failed: ${e}`);
    console.error('❌ Supabase session error:', e);
  }

  const diagnostics = {
    userId,
    oneSignalAvailable,
    oneSignalUserIdSet,
    supabaseSessionValid,
    errors,
  };

  console.log('📋 Diagnostic Results:', diagnostics);

  return diagnostics;
}

/**
 * Test the notification endpoint with minimal payload
 */
export async function testNotificationEndpoint(userId: string): Promise<boolean> {
  try {
    console.log('🧪 Testing notification endpoint...');

    const { data: { session } } = await supabase.auth.getSession();
    const authHeader = session?.access_token 
      ? `Bearer ${session.access_token}` 
      : `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`;

    const testPayload = {
      user_ids: [userId],
      title: '🧪 Test Notification',
      body: 'This is a test notification to verify the setup',
    };

    console.log('📤 Sending test payload:', testPayload);

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-notification-by-userid`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify(testPayload),
      }
    );

    console.log('📡 Response status:', response.status);

    const responseText = await response.text();
    console.log('📋 Response:', responseText);

    if (response.ok) {
      console.log('✅ Test notification sent successfully!');
      return true;
    } else {
      console.error('❌ Test notification failed:', responseText);
      return false;
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    return false;
  }
}
