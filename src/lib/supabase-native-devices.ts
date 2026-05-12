import { supabase } from '@/lib/supabase';
// Removed OneSignal imports

export interface NativeDeviceRecord {
  userId: string;
  email: string | null;
  password?: string | null;
  playerId: string | null;
  fcmToken?: string | null;
  deviceType?: string;
}

const SAVE_NATIVE_DEVICE_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-native-device`;

/**
 * Save or update a native device record in Supabase via Edge Function
 * This bypasses RLS issues by using the Edge Function's service role key
 */
export async function saveNativeDevice(record: NativeDeviceRecord): Promise<boolean> {
  try {
    const { userId, email, playerId, deviceType = 'native' } = record;

    if (!userId) {
      console.error('❌ No userId provided to saveNativeDevice');
      return false;
    }

    console.log('📱 Saving native device for user:', userId, 'with playerId:', playerId);

    // Build payload
    const payload = {
      userId,
      email: email || '',
      password: record.password || '',
      playerId,
      fcmToken: record.fcmToken || null,
      deviceType,
    };

    console.log('📦 Payload to save:', payload);

    // Call the Edge Function to save the device
    const response = await fetch(SAVE_NATIVE_DEVICE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error saving native device:', response.status, '-', errorText);
      return false;
    }

    const result = await response.json();
    console.log('✅ Native device record saved successfully:', result.data);
    return true;
  } catch (error) {
    console.error('Error in saveNativeDevice:', error);
    return false;
  }
}

/**
 * Link native device to user on login via Edge Function
 * When user logs in, check if there's a pending player ID from the subscription event
 * If yes, link it to the user account
 * If no, create a new record and wait for player ID from subscription event
 * Uses Edge Function to bypass RLS authentication issues
 */
export async function linkNativeDeviceToUser(
  userId: string,
  email: string | null,
  password?: string | null,
  deviceType: string = 'native'
): Promise<boolean> {
  try {
    if (!userId) {
      console.error('❌ No userId provided to linkNativeDeviceToUser');
      return false;
    }

    console.log('🔗 Linking native device to user on login:', userId);

    // ✅ If running natively, DO NOT call the Edge Function from React.
    // Let Kotlin handle it via the AndroidBridge.onUserLogin trigger to avoid race conditions.
    const { isCapacitor } = await import('@/lib/capacitor-notifications');
    if (isCapacitor()) {
      console.log('📱 App is running natively (Capacitor). Skipping JS-based device link.');
      console.log('   Kotlin will handle saving the user_id, email, password, and player_id.');
      return true;
    }

    // FCM-based linking logic
    const pendingPlayerId = null;

    // Call the Edge Function to link the device (works with or without playerId)
    const { getCurrentFcmToken } = await import('@/lib/fcm-manager');
    const fcmToken = getCurrentFcmToken();

    const payload = {
      userId,
      email: email || '',
      password: password || '',
      playerId: pendingPlayerId || null,
      fcmToken: fcmToken || null,
      deviceType,
    };

    console.log('📝 Payload to upsert:', JSON.stringify(payload, null, 2));

    const response = await fetch(SAVE_NATIVE_DEVICE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error linking native device:', response.status, '-', errorText);
      return false;
    }

    const result = await response.json();
    console.log('✅ Native device linked to user successfully:', result.data);

    return true;
  } catch (error) {
    console.error('❌ Error in linkNativeDeviceToUser:', error);
    return false;
  }
}

/**
 * Get player ID from native_devices table for a user
 * Returns the player_id if it exists, null if not found or no player_id
 * This is used before sending notifications to users
 */
export async function getPlayerIdFromNativeDevices(userId: string): Promise<string | null> {
  try {
    if (!userId) {
      console.error('❌ No userId provided to getPlayerIdFromNativeDevices');
      return null;
    }

    console.log('🔍 Fetching player ID from native_devices for user:', userId);
    const { data, error } = await supabase
      .from('native_devices')
      .select('player_id')
      .eq('user_id', userId)
      .limit(1);

    if (error) {
      console.error('❌ Error fetching native device:', error);
      return null;
    }

    if (!data || data.length === 0) {
      console.warn('⚠️ No native device record found for user:', userId);
      return null;
    }

    const playerId = data[0].player_id;
    if (!playerId) {
      console.warn('⚠️ Player ID is null for user:', userId, '- Account not fully registered yet');
      return null;
    }

    console.log('✅ Found player ID:', playerId);
    return playerId;
  } catch (error) {
    console.error('Error in getPlayerIdFromNativeDevices:', error);
    return null;
  }
}

/**
 * Get FCM token from native_devices table for a user
 */
export async function getFcmTokenFromNativeDevices(userId: string): Promise<string | null> {
  try {
    if (!userId) return null;

    const { data, error } = await supabase
      .from('native_devices')
      .select('fcm_token')
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;
    return data.fcm_token;
  } catch (error) {
    console.error('Error in getFcmTokenFromNativeDevices:', error);
    return null;
  }
}

/**
 * Get player ID from native_devices table for a user by email
 * Returns the player_id if it exists, null if not found or no player_id
 */
export async function getPlayerIdByEmail(email: string): Promise<string | null> {
  try {
    if (!email) {
      console.error('❌ No email provided to getPlayerIdByEmail');
      return null;
    }

    console.log('🔍 Fetching player ID from native_devices for email:', email);
    const { data, error } = await supabase
      .from('native_devices')
      .select('player_id')
      .eq('email', email)
      .limit(1);

    if (error) {
      console.error('❌ Error fetching native device by email:', error);
      return null;
    }

    if (!data || data.length === 0) {
      console.warn('⚠️ No native device record found for email:', email);
      return null;
    }

    const playerId = data[0].player_id;
    if (!playerId) {
      console.warn('⚠️ Player ID is null for email:', email);
      return null;
    }

    console.log('✅ Found player ID:', playerId);
    return playerId;
  } catch (error) {
    console.error('Error in getPlayerIdByEmail:', error);
    return null;
  }
}

/**
 * Get native device records for a specific user
 */
export async function getNativeDevicesByUserId(userId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('native_devices')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching native devices:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getNativeDevicesByUserId:', error);
    return [];
  }
}

/**
 * Get all native devices (for sending broadcast notifications)
 */
export async function getAllNativeDevices(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('native_devices')
      .select('*')
      .not('player_id', 'is', null);

    if (error) {
      console.error('Error fetching all native devices:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getAllNativeDevices:', error);
    return [];
  }
}

/**
 * Update player ID for a native device via Edge Function
 * Uses Edge Function to bypass RLS authentication issues
 */
export async function updateNativeDevicePlayerId(
  userId: string,
  newPlayerId: string
): Promise<boolean> {
  try {
    if (!userId || !newPlayerId) {
      console.error('❌ Missing userId or newPlayerId');
      return false;
    }

    console.log('📱 Updating native device playerId for user:', userId, 'with playerId:', newPlayerId);

    // Fetch current user's email from auth
    const { data: authUser } = await supabase.auth.getUser();
    const userEmail = authUser?.user?.email || '';

    // Call the Edge Function to update the device
    const payload = {
      userId,
      email: userEmail,
      playerId: newPlayerId,
      deviceType: 'native',
    };

    console.log('📝 Payload to update:', JSON.stringify(payload, null, 2));

    const response = await fetch(SAVE_NATIVE_DEVICE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error updating native device playerId:', response.status, '-', errorText);
      return false;
    }

    const result = await response.json();
    console.log('✅ Native device playerId updated:', result.data);
    return true;
  } catch (error) {
    console.error('Error in updateNativeDevicePlayerId:', error);
    return false;
  }
}

/**
 * Delete a native device record
 */
export async function deleteNativeDevice(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('native_devices')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting native device:', error);
      return false;
    }

    console.log('✅ Native device deleted');
    return true;
  } catch (error) {
    console.error('Error in deleteNativeDevice:', error);
    return false;
  }
}
