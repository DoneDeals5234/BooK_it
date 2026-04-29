/**
 * Layered Hybrid Heartbeat System
 * 
 * This implements multiple approaches stacked to ensure owner online status is detected:
 * Layer 1: Heartbeat via Edge Function with apikey header
 * Layer 2: Direct database update via Supabase client (fallback)
 * Layer 3: App lifecycle tracking for immediate status updates
 * Layer 4: Automatic retry with exponential backoff
 */

import { supabase } from './supabase';
import { isAppInForeground } from './app-lifecycle';

const HEARTBEAT_INTERVAL_MS = 45 * 1000; // 45 seconds
const HEARTBEAT_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shop-heartbeat`;
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000; // 1 second

let heartbeatInterval: NodeJS.Timeout | null = null;
let isHeartbeatActive = false;
let currentShopId: string | null = null;

/**
 * Start sending heartbeat signals - implements layered approach
 */
export const startShopHeartbeat = (shopId: string): void => {
  if (isHeartbeatActive) {
    console.log('Heartbeat already active');
    return;
  }

  currentShopId = shopId;
  isHeartbeatActive = true;
  console.log(`🚀 Starting layered heartbeat for shop: ${shopId}`);

  // Immediately send first heartbeat
  sendHeartbeatWithRetry(shopId);

  // Set up interval for subsequent heartbeats
  heartbeatInterval = setInterval(() => {
    if (isHeartbeatActive) {
      sendHeartbeatWithRetry(shopId);
    }
  }, HEARTBEAT_INTERVAL_MS);
};

/**
 * Stop sending heartbeat signals
 */
export const stopShopHeartbeat = (): void => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  isHeartbeatActive = false;
  currentShopId = null;
  console.log('🛑 Heartbeat stopped');
};

/**
 * Send immediate online status update (called when app resumes)
 */
export const sendImmediateOnlineUpdate = async (shopId: string): Promise<void> => {
  console.log(`⚡ Sending immediate online update for shop: ${shopId}`);
  try {
    // Try direct database update first (Layer 2)
    await updateShopStatusDirectly(shopId, 'online');
    console.log('✅ Immediate online update sent via direct database update');
  } catch (error) {
    console.warn('Failed to send immediate online update:', error);
  }
};

/**
 * Layer approach: Try multiple methods in sequence
 */
const sendHeartbeatWithRetry = async (shopId: string, attempt: number = 1): Promise<void> => {
  try {
    // Layer 1: Try Edge Function with multiple header approaches
    const success = await tryHeartbeatViaEdgeFunction(shopId);
    if (success) {
      console.log('✅ Heartbeat sent via Edge Function (Layer 1)');
      return;
    }

    // Layer 2: Fallback to direct database update
    console.log('⏳ Layer 1 failed, trying Layer 2 (direct database update)...');
    await updateShopStatusDirectly(shopId, 'online');
    console.log('✅ Heartbeat sent via direct database update (Layer 2)');
  } catch (error) {
    console.warn(`Heartbeat attempt ${attempt} failed:`, error);

    // Retry with exponential backoff
    if (attempt < RETRY_ATTEMPTS) {
      const delayMs = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      console.log(`🔄 Retrying heartbeat in ${delayMs}ms... (Attempt ${attempt + 1}/${RETRY_ATTEMPTS})`);
      setTimeout(() => {
        sendHeartbeatWithRetry(shopId, attempt + 1);
      }, delayMs);
    } else {
      console.error(`❌ Heartbeat failed after ${RETRY_ATTEMPTS} attempts`);
    }
  }
};

/**
 * Layer 1: Send heartbeat via Edge Function
 * Tries multiple header approaches for maximum compatibility
 */
const tryHeartbeatViaEdgeFunction = async (shopId: string): Promise<boolean> => {
  try {
    if (!HEARTBEAT_ENDPOINT) {
      console.warn('Heartbeat endpoint not configured');
      return false;
    }

    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    // Approach 1: Try with apikey header (standard Supabase approach)
    try {
      const response1 = await fetch(HEARTBEAT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey || '',
        },
        body: JSON.stringify({
          shopId,
          timestamp: new Date().toISOString(),
        }),
      });

      if (response1.ok) {
        console.log('✅ Edge Function request successful (apikey header)');
        return true;
      }
    } catch (e) {
      console.warn('Approach 1 (apikey) failed, trying Approach 2...');
    }

    // Approach 2: Try with Authorization Bearer header
    try {
      const response2 = await fetch(HEARTBEAT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          shopId,
          timestamp: new Date().toISOString(),
        }),
      });

      if (response2.ok) {
        console.log('✅ Edge Function request successful (Bearer header)');
        return true;
      }
    } catch (e) {
      console.warn('Approach 2 (Bearer) failed, trying Approach 3...');
    }

    // Approach 3: Try without auth header (if Edge Function allows public access)
    try {
      const response3 = await fetch(HEARTBEAT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shopId,
          timestamp: new Date().toISOString(),
        }),
      });

      if (response3.ok) {
        console.log('✅ Edge Function request successful (no auth header)');
        return true;
      }
    } catch (e) {
      console.warn('Approach 3 (no auth) failed');
    }

    return false;
  } catch (error) {
    console.warn('Error in Edge Function heartbeat:', error);
    return false;
  }
};

/**
 * Layer 2: Direct database update via Supabase client
 * This bypasses the Edge Function and directly updates the database
 */
const updateShopStatusDirectly = async (shopId: string, status: 'online' | 'offline'): Promise<void> => {
  try {
    const { error } = await supabase
      .from('shops')
      .update({
        last_ping_time: new Date().toISOString(),
        display_status: status,
      })
      .eq('id', shopId);

    if (error) {
      throw error;
    }

    console.log(`✅ Shop status updated directly to "${status}" in database`);
  } catch (error) {
    console.error('Error updating shop status directly:', error);
    throw error;
  }
};

/**
 * Check if heartbeat is currently active
 */
export const isHeartbeatRunning = (): boolean => {
  return isHeartbeatActive;
};

/**
 * Reset heartbeat interval
 */
export const resetHeartbeat = (shopId: string): void => {
  stopShopHeartbeat();
  startShopHeartbeat(shopId);
};

/**
 * Force immediate status update
 * Useful for testing or manual updates
 */
export const forceStatusUpdate = async (shopId: string, status: 'online' | 'offline'): Promise<void> => {
  console.log(`🔴 Force updating shop ${shopId} status to ${status}`);
  try {
    await updateShopStatusDirectly(shopId, status);
    console.log(`✅ Force status update completed`);
  } catch (error) {
    console.error('Force status update failed:', error);
    throw error;
  }
};
