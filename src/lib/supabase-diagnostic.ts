import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/**
 * Diagnostic utility to identify Supabase connectivity and permission issues
 */

export async function runSupabaseDiagnostic() {
  console.log('🔍 Starting Supabase Diagnostic...\n');
  
  if (!isSupabaseConfigured) {
    console.error('❌ Supabase is not configured');
    return;
  }

  console.log('✅ Supabase is configured');
  
  // Test 1: Check basic connectivity by trying to access the health endpoint
  console.log('\n📡 Test 1: Basic connectivity...');
  try {
    // Try to fetch user session (this doesn't require RLS permissions)
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.warn('  ⚠️ Session error:', sessionError.message);
    } else {
      console.log('  ✅ Session check passed. User:', session?.user?.email || 'Not authenticated');
    }
  } catch (e) {
    console.error('  ❌ Network error:', e instanceof Error ? e.message : String(e));
  }

  // Test 2: Try to access categories table
  console.log('\n📊 Test 2: Accessing categories table...');
  try {
    const { data, error, status } = await supabase
      .from('categories')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('  ❌ Error:', error.message);
      console.error('     Code:', error.code);
      console.error('     Hint:', error.hint);
      console.error('     Details:', error.details);
      
      if (error.code === 'PGRST116') {
        console.log('     → Table exists but no data');
      } else if (error.message.includes('permission')) {
        console.log('     → RLS policy is blocking access (permission denied)');
      } else if (error.message.includes('not found')) {
        console.log('     → Table might not exist');
      }
    } else {
      console.log('  ✅ Successfully accessed categories table. Records:', data?.length || 0);
    }
  } catch (e) {
    console.error('  ❌ Exception:', e instanceof Error ? e.message : String(e));
  }

  // Test 3: Try to access bookings table
  console.log('\n📅 Test 3: Accessing bookings table...');
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('  ❌ Error:', error.message);
      console.error('     Code:', error.code);
      console.error('     Hint:', error.hint);
      
      if (error.message.includes('permission')) {
        console.log('     → RLS policy is blocking access');
      }
    } else {
      console.log('  ✅ Successfully accessed bookings table. Records:', data?.length || 0);
    }
  } catch (e) {
    console.error('  ❌ Exception:', e instanceof Error ? e.message : String(e));
  }

  // Test 4: Try to access shops table
  console.log('\n🏪 Test 4: Accessing shops table...');
  try {
    const { data, error } = await supabase
      .from('shops')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('  ❌ Error:', error.message);
      console.error('     Code:', error.code);
      console.error('     Hint:', error.hint);
    } else {
      console.log('  ✅ Successfully accessed shops table. Records:', data?.length || 0);
    }
  } catch (e) {
    console.error('  ❌ Exception:', e instanceof Error ? e.message : String(e));
  }

  // Test 5: Check if anon key has proper permissions
  console.log('\n🔑 Test 5: Checking anon key credentials...');
  try {
    // Attempt a simple query instead of insert (inserting to categories often fails due to UUID constraints)
    console.log('  🔍 Testing categories access...');
    const { data: catData, error: catError } = await supabase
      .from('categories')
      .select('count')
      .limit(1);
    
    if (catError) {
      if (catError.message.includes('permission')) {
        console.log('  ⚠️ Anon key lacks write permissions (this is often intentional)');
      } else if (catError.code === 'PGRST502') {
        console.log('  ⚠️ Database connection issue or missing columns');
      } else {
        console.log('  ⚠️ Other permission error:', catError.message);
      }
    } else {
      console.log('  ✅ Read permission test passed');
    }
  } catch (e) {
    console.error('  ❌ Exception:', e instanceof Error ? e.message : String(e));
  }

  console.log('\n✅ Diagnostic complete. Check the errors above to identify the issue.\n');
}

// Run diagnostic immediately when imported
if (typeof window !== 'undefined') {
  // Run on next tick to ensure Supabase is initialized
  setTimeout(() => {
    console.log('📋 Supabase Diagnostic Report:');
    runSupabaseDiagnostic().catch(e => console.error('Diagnostic error:', e));
  }, 1000);
}
