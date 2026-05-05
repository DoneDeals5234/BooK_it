import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://omkrfehuvftntuqjmxqq.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ta3JmZWh1dmZ0bnR1cWpteHFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTkwNDM4MywiZXhwIjoyMDc3NDgwMzgzfQ.XGaLped_nvzTiQnycJHnodgYGb2QIA5N_-f3Qe8K3Xo";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const SHOP_ID = "1771360246996";

const PRODUCTS = [
  // Dairy
  { title: "Amul Taaza Milk 1L", price: 54, original_price: 56, category: "dairy", image_url: "https://www.bigbasket.com/media/uploads/p/l/306135_1-amul-taaza-fresh-toned-milk.jpg" },
  { title: "Britannia Whole Wheat Bread", price: 45, original_price: 50, category: "dairy", image_url: "https://www.bigbasket.com/media/uploads/p/l/40003055_6-britannia-bread-shakti-enriched-whole-wheat.jpg" },
  
  // Snacks
  { title: "Lays Classic Salted", price: 20, original_price: 20, category: "snacks", image_url: "https://www.bigbasket.com/media/uploads/p/l/102570_12-lays-potato-chips-classic-salted.jpg" },
  { title: "Kurkure Masala Munch", price: 20, original_price: 20, category: "snacks", image_url: "https://www.bigbasket.com/media/uploads/p/l/266532_14-kurkure-namkeen-masala-munch.jpg" },
  { title: "Oreo Vanilla Biscuits", price: 30, original_price: 35, category: "snacks", image_url: "https://www.bigbasket.com/media/uploads/p/l/40001183_11-cadbury-oreo-sandwich-biscuits-vanilla-creme.jpg" },
  
  // Beverages
  { title: "Coca Cola 750ml", price: 45, original_price: 50, category: "beverages", image_url: "https://www.bigbasket.com/media/uploads/p/l/251006_12-coca-cola-soft-drink.jpg" },
  { title: "Pepsi 750ml", price: 45, original_price: 50, category: "beverages", image_url: "https://www.bigbasket.com/media/uploads/p/l/251037_10-pepsi-soft-drink.jpg" },
  
  // Instant
  { title: "Maggi 2-Minute Noodles", price: 14, original_price: 14, category: "instant", image_url: "https://www.bigbasket.com/media/uploads/p/l/266109_15-maggi-2-minute-instant-noodles-masala.jpg" },
  
  // Grocery
  { title: "Aashirvaad Atta 5kg", price: 245, original_price: 270, category: "grocery", image_url: "https://www.bigbasket.com/media/uploads/p/l/126906_8-aashirvaad-atta-whole-wheat.jpg" },
  { title: "Tata Salt 1kg", price: 28, original_price: 28, category: "grocery", image_url: "https://www.bigbasket.com/media/uploads/p/l/241600_5-tata-salt-iodized.jpg" },
  
  // Household
  { title: "Surf Excel Easy Wash 1kg", price: 145, original_price: 160, category: "household", image_url: "https://www.bigbasket.com/media/uploads/p/l/266160_18-surf-excel-easy-wash-detergent-powder.jpg" },
  { title: "Lux Soft Glow Soap", price: 35, original_price: 40, category: "household", image_url: "https://www.bigbasket.com/media/uploads/p/l/40223449_1-lux-soft-glow-beauty-soap-rose-vitamin-e-for-glowing-skin.jpg" }
];

async function insertProducts() {
  console.log("Starting product insertion for Param Karyana Store...");
  
  // First, clear existing products for this shop to avoid duplicates
  const { error: deleteError } = await supabase
    .from('featured_products')
    .delete()
    .eq('shop_id', SHOP_ID);
    
  if (deleteError) console.error("Error clearing old products:", deleteError.message);

  for (const product of PRODUCTS) {
    const { error } = await supabase
      .from('featured_products')
      .insert({
        shop_id: SHOP_ID,
        title: product.title,
        price: product.price,
        original_price: product.original_price,
        category: product.category,
        image_url: product.image_url,
        is_active: true,
        display_order: 0
      });
    
    if (error) {
      console.error(`❌ Error inserting ${product.title}:`, error.message);
    } else {
      console.log(`✅ Inserted ${product.title} (${product.category})`);
    }
  }
  console.log("Finished insertion.");
}

insertProducts();
