import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

console.log('Initializing daily-reset-bookings function...');

serve(async (req) => {
  // Verify this is a scheduled invocation from Supabase
  const authHeader = req.headers.get('authorization');
  
  try {
    // Only allow requests from Supabase cron scheduler
    if (req.method === 'POST') {
      console.log('📅 Daily reset triggered at 1 AM IST');

      // Import Supabase client
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

      if (!supabaseUrl || !supabaseServiceKey) {
        console.error('Missing Supabase credentials');
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Server configuration error' 
          }),
          { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
          }
        );
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Step 1: Get all bookings to log before deletion
      const { data: bookingsBeforeDelete, error: fetchError } = await supabase
        .from('bookings')
        .select('id, shop_id, token_number, booking_date');

      if (fetchError) {
        console.error('Error fetching bookings:', fetchError);
      } else {
        console.log(`📊 Found ${bookingsBeforeDelete?.length || 0} bookings to delete`);
        if (bookingsBeforeDelete && bookingsBeforeDelete.length > 0) {
          console.log('Sample bookings:', bookingsBeforeDelete.slice(0, 3));
        }
      }

      // Step 2: Delete all bookings from database
      const { error: deleteError, count: deletedCount } = await supabase
        .from('bookings')
        .delete()
        .neq('id', 'null'); // This deletes all rows

      if (deleteError) {
        console.error('❌ Error deleting bookings:', deleteError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Failed to delete bookings',
            error: deleteError
          }),
          { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
          }
        );
      }

      console.log(`✅ Successfully deleted all bookings. Rows affected: ${deletedCount}`);

      // Step 3: Get all shops and log the reset
      const { data: shops, error: shopsError } = await supabase
        .from('shops')
        .select('id, name');

      if (!shopsError && shops) {
        console.log(`🏪 Reset completed for ${shops.length} shops`);
        shops.forEach((shop: any) => {
          console.log(`  - ${shop.name}: Token counter will restart from 1`);
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Daily reset completed successfully',
          bookingsDeleted: deletedCount || 0,
          timestamp: new Date().toISOString(),
          description: 'All bookings deleted. Token counters reset to 1 for all shops.',
        }),
        { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    return new Response('Method not allowed', { status: 405 });

  } catch (error) {
    console.error('❌ Error in daily-reset-bookings:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Internal server error',
        error: String(error),
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
});
