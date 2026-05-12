
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkFcmTokens() {
  const email = 'hghgchcg@gmail.com';
  
  // Find user_id first
  const { data: profile, error: pError } = await supabase
    .from('user_profiles')
    .select('user_id')
    .eq('email', email)
    .single();

  if (pError || !profile) {
    console.error('User profile not found:', pError?.message);
    return;
  }

  const userId = profile.user_id;
  console.log(`🔍 Checking FCM tokens for User ID: ${userId} (${email})`);

  const { data: devices, error: dError } = await supabase
    .from('native_devices')
    .select('*')
    .eq('user_id', userId);

  if (dError) {
    console.error('Error fetching devices:', dError.message);
    return;
  }

  if (!devices || devices.length === 0) {
    console.log('❌ No devices found for this user in native_devices table.');
  } else {
    console.log(`✅ Found ${devices.length} device(s):`);
    console.table(devices.map(d => ({
      user_id: d.user_id,
      fcm_token: d.fcm_token ? (d.fcm_token.substring(0, 20) + '...') : 'NULL',
      player_id: d.player_id ? (d.player_id.substring(0, 10) + '...') : 'NULL',
      device_type: d.device_type,
      last_active: d.last_active
    })));
  }
}

checkFcmTokens()
