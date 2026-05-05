import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://omkrfehuvftntuqjmxqq.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ta3JmZWh1dmZ0bnR1cWpteHFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTkwNDM4MywiZXhwIjoyMDc3NDgwMzgzfQ.XGaLped_nvzTiQnycJHnodgYGb2QIA5N_-f3Qe8K3Xo";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const SHOP_ID = "1771360246996";

const PRODUCTS = [
  // Snacks
  { title: "Lays Classic Salted", price: 20, image_url: "https://www.bigbasket.com/media/uploads/p/l/102570_12-lays-potato-chips-classic-salted.jpg", description: "Crispy and salted potato chips." },
  { title: "Kurkure Masala Munch", price: 20, image_url: "https://www.bigbasket.com/media/uploads/p/l/266532_14-kurkure-namkeen-masala-munch.jpg", description: "Crunchy spicy snack." },
  { title: "Bingo Mad Angles", price: 20, image_url: "https://www.bigbasket.com/media/uploads/p/l/40003534_10-bingo-mad-angles-namkeen-achaari-masti.jpg", description: "Triangle chips with achari flavor." },
  { title: "Maggi 2-Minute Noodles", price: 14, image_url: "https://www.bigbasket.com/media/uploads/p/l/266109_15-maggi-2-minute-instant-noodles-masala.jpg", description: "Masala instant noodles." },
  { title: "Oreo Vanilla Biscuits", price: 30, image_url: "https://www.bigbasket.com/media/uploads/p/l/40001183_11-cadbury-oreo-sandwich-biscuits-vanilla-creme.jpg", description: "Crunchy cocoa biscuits with vanilla cream." },
  
  // Beverages
  { title: "Coca Cola 750ml", price: 45, image_url: "https://www.bigbasket.com/media/uploads/p/l/251006_12-coca-cola-soft-drink.jpg", description: "Refreshing soft drink." },
  { title: "Pepsi 750ml", price: 45, image_url: "https://www.bigbasket.com/media/uploads/p/l/251037_10-pepsi-soft-drink.jpg", description: "Cola soft drink." },
  
  // Dairy
  { title: "Amul Taaza Milk 1L", price: 54, image_url: "https://www.bigbasket.com/media/uploads/p/l/306135_1-amul-taaza-fresh-toned-milk.jpg", description: "Fresh toned milk." },
  { title: "Britannia Whole Wheat Bread", price: 45, image_url: "https://www.bigbasket.com/media/uploads/p/l/40003055_6-britannia-bread-shakti-enriched-whole-wheat.jpg", description: "Healthy whole wheat bread." },
  
  // Grocery
  { title: "Aashirvaad Atta 5kg", price: 245, image_url: "https://www.bigbasket.com/media/uploads/p/l/126906_8-aashirvaad-atta-whole-wheat.jpg", description: "Premium whole wheat flour." },
  { title: "Tata Salt 1kg", price: 28, image_url: "https://www.bigbasket.com/media/uploads/p/l/241600_5-tata-salt-iodized.jpg", description: "Iodized vacuum evaporated salt." },
  
  // Household
  { title: "Surf Excel Easy Wash 1kg", price: 145, image_url: "https://www.bigbasket.com/media/uploads/p/l/266160_18-surf-excel-easy-wash-detergent-powder.jpg", description: "Powerful detergent powder." }
];

async function insertProducts() {
  console.log("Starting MINIMAL product insertion...");
  for (const product of PRODUCTS) {
    const { data, error } = await supabase
      .from('featured_products')
      .insert({
        shop_id: SHOP_ID,
        title: product.title,
        price: product.price,
        image_url: product.image_url,
        description: product.description,
        is_active: true,
        display_order: 0
      })
      .select();
    
    if (error) {
      console.error(`❌ Error inserting ${product.title}:`, error.message);
    } else {
      console.log(`✅ Inserted ${product.title}`);
    }
  }
  console.log("Finished insertion.");
}

insertProducts();
