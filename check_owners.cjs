const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://database.donedeals.shop/';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlLWRlbW8iLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTc5OTUzNTYwMH0.PKKL6ybphx1DLBXw8xxpLZzEMbumsFJQ23nSnwmrVzE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log('Querying shop_owners...');
  const { data: webOwners, error: err1 } = await supabase
    .from('shop_owners')
    .select('*')
    .eq('email', 'hghgchcg@gmail.com');

  if (err1) {
    console.error('Error fetching shop_owners:', err1);
  } else {
    console.log('--- Web Shop Owners (shop_owners) ---');
    console.log(webOwners);
  }

  console.log('Querying user_profiles...');
  const { data: userProfiles, error: err3 } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('email', 'hghgchcg@gmail.com');

  if (err3) {
    console.error('Error fetching user_profiles:', err3);
  } else {
    console.log('--- User Profiles ---');
    console.log(userProfiles);
  }
}

check();
