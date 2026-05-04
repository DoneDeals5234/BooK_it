import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('orders').select('created_at').order('created_at', { ascending: false }).limit(1);
  console.log('Latest order created_at:', data?.[0]?.created_at);
}

check();
