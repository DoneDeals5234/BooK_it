import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://omkrfehuvftntuqjmxqq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlLWRlbW8iLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTc5OTUzNTYwMH0.PKKL6ybphx1DLBXw8xxpLZzEMbumsFJQ23nSnwmrVzE";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function findShop() {
  const { data, error } = await supabase
    .from('shops')
    .select('id, name')
    .ilike('name', '%Param Karyana%');
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Shops found:', JSON.stringify(data, null, 2));
}

findShop();
