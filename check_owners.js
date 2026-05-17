const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://database.donedeals.shop/';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlLWRlbW8iLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTc5OTUzNTYwMH0.PKKL6ybphx1DLBXw8xxpLZzEMbumsFJQ23nSnwmrVzE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log('Querying shop_owners...');
  const { data: webOwners, error: err1 } = await supabase
    .from('shop_owners')
    .select('*');

  if (err1) {
    console.error('Error fetching shop_owners:', err1);
  } else {
    console.log('--- Web Shop Owners (shop_owners) ---');
    console.log(webOwners);
  }

  console.log('Querying native_shop_owners...');
  const { data: nativeOwners, error: err2 } = await supabase
    .from('native_shop_owners')
    .select('*');

  if (err2) {
    console.error('Error fetching native_shop_owners:', err2);
  } else {
    console.log('--- Native Shop Owners (native_shop_owners) ---');
    console.log(nativeOwners);
  }
}

check();
