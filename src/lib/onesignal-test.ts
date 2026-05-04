import { supabase } from './supabase';
import { sendPriorityNotification } from './onesignal-messaging';
import { toast } from 'react-hot-toast';

export const runOneSignalTest = async () => {
  try {
    console.log('🚀 Starting OneSignal Test...');
    
    // 1. Get a test user from shop_owners table
    const { data: owner, error: fetchError } = await supabase
      .from('shop_owners')
      .select('user_id, player_id, email')
      .not('user_id', 'is', null)
      .limit(1)
      .single();

    if (fetchError || !owner) {
      console.error('❌ Could not find a test owner in shop_owners table:', fetchError);
      toast.error('Could not find a shop owner to test with.');
      return;
    }

    console.log('👤 Testing with Owner:', owner.email, 'User ID:', owner.user_id);
    toast.loading('Sending test notification...', { id: 'onesignal-test' });

    // 2. Try to send notification using the priority system (which uses user_id as external_id fallback)
    const payload = {
      title: 'OneSignal API Test 🧪',
      body: 'This is a test notification to verify OneSignal API keys. If you see this, it works!',
      data: { type: 'test_notification' }
    };

    // We use the player_id if available, otherwise fallback to user_id (external_id)
    if (owner.player_id) {
      console.log('📱 Sending to direct Player ID:', owner.player_id);
      const { sendNotificationToPlayerIds } = await import('./onesignal-messaging');
      await sendNotificationToPlayerIds([owner.player_id], payload);
    } else {
      console.log('🆔 Sending to User ID (External ID):', owner.user_id);
      await sendPriorityNotification(owner.user_id, payload);
    }

    toast.success('Test notification sent! Check the console for API response.', { id: 'onesignal-test' });
    console.log('✅ OneSignal Test Completed Successfully');
  } catch (error: any) {
    console.error('❌ OneSignal Test Failed:', error);
    toast.error(`Test failed: ${error.message || 'Unknown error'}`, { id: 'onesignal-test' });
  }
};
