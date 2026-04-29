import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/**
 * Migrate shops from old categories (beauty-parlour, girl-saloon) to new category (parlour)
 * This should be called once on app initialization
 *
 * Note: This migration uses the service role key to bypass RLS policies.
 * For development environments, if the service role is not available,
 * the migration will attempt with the regular client and log warnings.
 *
 * Errors during migration are non-blocking to allow the app to continue functioning.
 */
export const migrateShopCategories = async (): Promise<void> => {
  // Skip migration if Supabase is not configured
  if (!isSupabaseConfigured) {
    console.log('ℹ️ Skipping shop category migration - Supabase not configured');
    return;
  }

  // Skip migration if no internet connection
  if (!navigator.onLine) {
    console.log('📡 Skipping shop category migration - No internet connection');
    return;
  }

  try {
    // Try to get service role client (if available in environment)
    const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

    // Use service role client if available, otherwise fall back to regular client
    let migrationClient = supabase;

    if (serviceRoleKey) {
      // Import createClient dynamically to avoid issues in non-Node environments
      const { createClient } = await import('@supabase/supabase-js');
      migrationClient = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        serviceRoleKey
      );
    } else {
      console.warn('⚠️ Service role key not available. Migration may fail if RLS is enabled on shops table.');
    }

    // Migrate beauty-parlour to parlour
    const { error: beautyError, count: beautyCount } = await migrationClient
      .from('shops')
      .update({ category: 'parlour' })
      .eq('category', 'beauty-parlour');

    if (beautyError) {
      if (beautyError.code === 'PGRST116') {
        // No rows found - this is fine, just log it
        console.log('ℹ️ No beauty-parlour shops found to migrate');
      } else {
        // Actual error - log details clearly
        console.warn(`⚠️ Error migrating beauty-parlour shops: ${beautyError.message} (code: ${beautyError.code})`);
      }
    } else {
      console.log('✅ Successfully migrated beauty-parlour shops to parlour');
    }

    // Migrate girl-saloon to parlour
    const { error: girlSaloonError, count: girlSaloonCount } = await migrationClient
      .from('shops')
      .update({ category: 'parlour' })
      .eq('category', 'girl-saloon');

    if (girlSaloonError) {
      if (girlSaloonError.code === 'PGRST116') {
        // No rows found - this is fine, just log it
        console.log('ℹ️ No girl-saloon shops found to migrate');
      } else {
        // Actual error - log details clearly
        console.warn(`⚠️ Error migrating girl-saloon shops: ${girlSaloonError.message} (code: ${girlSaloonError.code})`);
      }
    } else {
      console.log('✅ Successfully migrated girl-saloon shops to parlour');
    }

    console.log('✅ Shop category migration completed');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.warn('⚠️ Warning in migrateShopCategories:', errorMsg);
    if (errorStack) {
      console.debug('Stack trace:', errorStack);
    }
    // Don't throw - allow app to continue
  }
};
