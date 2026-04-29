import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

console.log('Initializing cleanup-temporary-chats function...');

serve(async (req) => {
  try {
    // Only allow POST requests (from cron scheduler)
    if (req.method === 'POST') {
      console.log('🧹 Temporary chats cleanup triggered at 1 AM IST');

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

      // Step 1: Count expired chats before deletion
      const { data: expiredChats, error: fetchError } = await supabase
        .from('temporary_chats')
        .select('id, shop_id, user_name, created_at', { count: 'exact' })
        .lt('expires_at', new Date().toISOString());

      if (fetchError) {
        console.error('Error fetching expired chats:', fetchError);
      } else {
        console.log(`📊 Found ${expiredChats?.length || 0} expired chats to delete`);
        if (expiredChats && expiredChats.length > 0) {
          console.log('Sample chats being deleted:', expiredChats.slice(0, 3));
        }
      }

      // Step 2: Delete all expired chats
      const { error: deleteError, count: deletedCount } = await supabase
        .from('temporary_chats')
        .delete()
        .lt('expires_at', new Date().toISOString());

      if (deleteError) {
        console.error('❌ Error deleting expired chats:', deleteError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Failed to delete expired chats',
            error: deleteError.message
          }),
          { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
          }
        );
      }

      console.log(`✅ Successfully deleted all expired chats. Rows affected: ${deletedCount}`);

      // Step 3: Get count of remaining active chats
      const { data: remainingChats, error: countError } = await supabase
        .from('temporary_chats')
        .select('id', { count: 'exact' })
        .gt('expires_at', new Date().toISOString());

      const remainingCount = !countError ? remainingChats?.length || 0 : 0;

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Temporary chats cleanup completed successfully',
          chatsDeleted: deletedCount || 0,
          chatsRemaining: remainingCount,
          timestamp: new Date().toISOString(),
          description: 'Expired temporary chats have been deleted. Active chats are preserved.',
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
    console.error('❌ Error in cleanup-temporary-chats:', error);
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
