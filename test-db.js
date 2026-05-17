import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const shopId = '1771360246996';
  console.log('Testing for shop:', shopId);
  
  const { data: owners } = await supabase.from('native_shop_owners').select('*').eq('shop_id', shopId);
  console.log('Owners:', owners);
  
  if (owners && owners.length > 0) {
    const userIds = owners.map(o => o.user_id);
    const { data: devices } = await supabase.from('native_devices').select('*').in('user_id', userIds);
    console.log('Devices:', devices);
  }
}

test();
