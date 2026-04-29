import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Track if Supabase is properly configured
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

// Detailed logging for debugging
console.log('[Supabase Init] URL:', supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'undefined');
console.log('[Supabase Init] Anon Key:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'undefined');
console.log('[Supabase Init] isConfigured:', isSupabaseConfigured);

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables to enable backend features.');
}

if (supabaseUrl && supabaseAnonKey) {
  console.debug('Supabase initialized successfully');
}

// Create client with defaults to prevent runtime errors
// If credentials are missing, the client will fail gracefully on requests
console.log('[Supabase] Creating client with URL:', supabaseUrl);
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);
console.log('[Supabase] Client created successfully');
