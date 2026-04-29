
import { createClient } from '@supabase/supabase-client';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function checkSchema() {
  const { data, error } = await supabase.from('featured_products').select('*').limit(1);
  console.log('Schema:', Object.keys(data[0] || {}));
}
checkSchema();
