
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSchema() {
  // We can't directly query pg_attribute without more permissions usually, 
  // but we can try to insert a dummy record and check the error, 
  // or use the 'rpc' to get schema if defined.
  // Alternatively, let's just try to fetch one row and see the keys.
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching order schema:', error.message);
    return;
  }

  if (data && data.length > 0) {
    console.log('✅ Columns in orders table:');
    console.log(Object.keys(data[0]).join(', '));
  } else {
    console.log('No orders found to inspect columns.');
  }
}

checkSchema()
