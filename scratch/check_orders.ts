
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_code, otp_code, created_at')
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) {
    console.error('Error fetching orders:', error)
    return
  }

  console.log('Last 5 orders:')
  console.table(data)
}

checkOrders()
