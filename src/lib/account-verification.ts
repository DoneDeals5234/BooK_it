import { supabase } from '@/lib/supabase';
import { retryWithBackoff } from '@/lib/retry-utils';

export interface VerificationResult {
  success: boolean;
  message: string;
  verified: boolean;
  accountId?: string;
  email?: string;
}

/**
 * Verify and secure account creation in user_devices table
 * This adds an additional layer of security to ensure accounts are properly stored
 */
export async function verifyAccountCreation(
  userId: string,
  email: string,
  password?: string | null
): Promise<VerificationResult> {
  try {
    // Step 1: Validate inputs
    if (!userId || !email) {
      return {
        success: false,
        message: 'Invalid user ID or email',
        verified: false,
      };
    }

    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return {
        success: false,
        message: 'Invalid email format',
        verified: false,
      };
    }

    console.log('[Account Verification] Starting verification for:', email);

    // Step 2: Check if account already exists in user_devices
    const { data: existingAccount, error: checkError } = await retryWithBackoff(
      () => supabase
        .from('user_devices')
        .select('id, email, user_id, created_at')
        .eq('user_id', userId)
        .limit(1),
      2,
      500
    );

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('[Account Verification] Error checking existing account:', checkError);
      return {
        success: false,
        message: 'Failed to verify account existence',
        verified: false,
      };
    }

    // Step 3: If account exists, verify it
    if (existingAccount && existingAccount.length > 0) {
      const account = existingAccount[0];
      console.log('[Account Verification] Account found:', {
        id: account.id,
        email: account.email,
        created: account.created_at,
      });

      return {
        success: true,
        message: 'Account already verified and stored securely',
        verified: true,
        accountId: account.id,
        email: account.email,
      };
    }

    // Step 4: Create new account entry
    const payload: any = {
      user_id: userId,
      email: email,
    };

    if (password) {
      payload.password = password;
    }

    const { data: newAccount, error: createError } = await retryWithBackoff(
      () => supabase
        .from('user_devices')
        .insert([payload])
        .select('id, email, user_id, created_at')
        .single(),
      2,
      500
    );

    if (createError) {
      console.error('[Account Verification] Error creating account:', createError);
      return {
        success: false,
        message: `Failed to create account: ${createError.message}`,
        verified: false,
      };
    }

    if (!newAccount) {
      return {
        success: false,
        message: 'Account creation returned no data',
        verified: false,
      };
    }

    console.log('[Account Verification] Account created and verified:', {
      id: newAccount.id,
      email: newAccount.email,
    });

    // Step 5: Verify the account was actually stored
    const { data: verifyAccount, error: verifyError } = await retryWithBackoff(
      () => supabase
        .from('user_devices')
        .select('id, email, user_id')
        .eq('id', newAccount.id)
        .single(),
      2,
      500
    );

    if (verifyError || !verifyAccount) {
      console.error('[Account Verification] Verification failed:', verifyError);
      return {
        success: false,
        message: 'Account verification failed after creation',
        verified: false,
      };
    }

    return {
      success: true,
      message: 'Account successfully created and verified',
      verified: true,
      accountId: newAccount.id,
      email: newAccount.email,
    };
  } catch (error) {
    console.error('[Account Verification] Unexpected error:', error);
    return {
      success: false,
      message: 'Unexpected error during account verification',
      verified: false,
    };
  }
}

/**
 * Get verified account details
 */
export async function getVerifiedAccount(userId: string): Promise<VerificationResult> {
  try {
    const { data, error } = await retryWithBackoff(
      () => supabase
        .from('user_devices')
        .select('id, email, user_id, created_at')
        .eq('user_id', userId)
        .limit(1),
      2,
      500
    );

    if (error) {
      console.error('[Account Verification] Error fetching account:', error);
      return {
        success: false,
        message: 'Failed to fetch account',
        verified: false,
      };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        message: 'Account not found',
        verified: false,
      };
    }

    const account = data[0];
    return {
      success: true,
      message: 'Account verified',
      verified: true,
      accountId: account.id,
      email: account.email,
    };
  } catch (error) {
    console.error('[Account Verification] Unexpected error:', error);
    return {
      success: false,
      message: 'Unexpected error during account verification',
      verified: false,
    };
  }
}

/**
 * Verify account integrity - ensure all required fields exist
 */
export async function verifyAccountIntegrity(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_devices')
      .select('id, email, user_id')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      console.warn('[Account Verification] Account integrity check failed for user:', userId);
      return false;
    }

    // Check all required fields exist
    const hasRequiredFields = data.id && data.email && data.user_id;
    if (!hasRequiredFields) {
      console.warn('[Account Verification] Account missing required fields:', data);
      return false;
    }

    console.log('[Account Verification] Account integrity verified:', userId);
    return true;
  } catch (error) {
    console.error('[Account Verification] Error checking account integrity:', error);
    return false;
  }
}
