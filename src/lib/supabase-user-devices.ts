import { supabase } from '@/lib/supabase';
import { retryWithBackoff } from '@/lib/retry-utils';

export interface UserDeviceRecord {
  userId: string;
  email: string | null;
  password?: string | null;
  playerId: string | null;
}

// Save or update a user device record in Supabase via Edge Function
// This bypasses RLS issues for new users who are not yet "logged in" to Supabase
export async function saveUserDevice(record: UserDeviceRecord): Promise<boolean> {
  try {
    const { userId, email, playerId } = record;

    if (!userId) return false;

    console.log('🌐 Saving web device for user:', userId);

    const payload = {
      userId,
      email: email || '',
      password: record.password || '',
      playerId: playerId || '',
      deviceType: 'web',
    };

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-native-device`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error saving web device:', response.status, '-', errorText);
      return false;
    }

    const result = await response.json();
    console.log('✅ Web device record synced successfully:', result.data);
    return true;
  } catch (error) {
    console.error('Error in saveUserDevice:', error);
    return false;
  }
}

// Fetch user email from user_devices table
export async function getUserEmailFromDevices(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('user_devices')
      .select('email')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (error) {
      console.error('Error fetching user email from devices:', error);
      return null;
    }

    return data?.email || null;
  } catch (error) {
    console.error('Error in getUserEmailFromDevices:', error);
    return null;
  }
}

// Fetch user password from user_devices table
export async function getUserDevicePassword(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('user_devices')
      .select('password')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (error) {
      console.error('Error fetching user password from devices:', error);
      return null;
    }

    return data?.password || null;
  } catch (error) {
    console.error('Error in getUserDevicePassword:', error);
    return null;
  }
}

// Update user password in user_devices table
export async function updateUserDevicePassword(userId: string, newPassword: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_devices')
      .update({ password: newPassword })
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating user password in devices:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in updateUserDevicePassword:', error);
    return false;
  }
}

// Verify user credentials and check availability status from user_devices table
export async function verifyUserDeviceCredentials(email: string, password: string): Promise<{ userId: string | null; isAvailable: boolean; error?: string }> {
  try {
    const { data, error } = await retryWithBackoff(() =>
      supabase
        .from('user_devices')
        .select('user_id, is_available')
        .eq('email', email)
        .eq('password', password)
        .limit(1)
        .single()
    );

    if (error) {
      if (error.code === 'PGRST116') { // No rows found
        return { userId: null, isAvailable: false, error: 'Invalid email or password' };
      }
      console.error('Error verifying user device credentials:');
      console.error('  Code:', error.code || 'No code');
      console.error('  Message:', error.message || 'No message');
      console.error('  Details:', error.details || 'No details');
      console.error('  Hint:', (error as any).hint || 'No hint');
      console.error('  Full error:', JSON.stringify(error, null, 2));
      return { userId: null, isAvailable: false, error: 'System error during verification' };
    }

    return {
      userId: data.user_id,
      isAvailable: !!data.is_available
    };
  } catch (error) {
    console.error('Error in verifyUserDeviceCredentials:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return { userId: null, isAvailable: false, error: 'System error during verification - please check your connection' };
  }
}

// Set user availability status in user_devices table
// isAvailable = true means user is logged out (available to login)
// isAvailable = false means user is logged in (not available)
export async function setUserOnlineStatus(userId: string, isAvailable: boolean): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_devices')
      .update({ is_available: isAvailable })
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating user availability status:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in setUserOnlineStatus:', error);
    return false;
  }
}
