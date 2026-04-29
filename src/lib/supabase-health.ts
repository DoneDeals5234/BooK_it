import { supabase, supabaseUrl } from '@/lib/supabase';

/**
 * Check if Supabase is reachable
 */
export async function checkSupabaseHealth(): Promise<boolean> {
  try {
    if (!supabaseUrl) {
      console.error('Supabase URL is not configured');
      return false;
    }

    // Try to make a simple health check request
    const response = await fetch(`${supabaseUrl}/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    return response.ok || response.status === 401; // 401 is acceptable since we're just checking if the server responds
  } catch (error) {
    console.error('Supabase health check failed:', error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Check if user has network connectivity
 */
export function hasNetworkConnectivity(): boolean {
  return navigator.onLine;
}

/**
 * Wait for network connectivity to be restored
 */
export async function waitForNetworkConnectivity(timeoutMs: number = 10000): Promise<boolean> {
  if (navigator.onLine) {
    return true;
  }

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      resolve(false);
    }, timeoutMs);

    const handleOnline = () => {
      clearTimeout(timeoutId);
      window.removeEventListener('online', handleOnline);
      resolve(true);
    };

    window.addEventListener('online', handleOnline);
  });
}
