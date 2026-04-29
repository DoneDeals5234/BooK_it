import { supabase } from '@/lib/supabase';

/**
 * Initialize shop ordering columns if they don't exist
 * This is a one-time setup function to add is_pinned and pin_order columns to shops table
 */
export const initializeShopOrderingColumns = async () => {
  try {
    // Try to run the migration SQL
    const { error } = await supabase.rpc('init_shop_ordering', {});
    
    if (error && error.code !== 'PGRST204') {
      console.log('Shop ordering columns initialization result:', error?.message);
    }
    
    return true;
  } catch (error) {
    console.error('Error initializing shop ordering columns:', error);
    return false;
  }
};

/**
 * Alternative: Run setup SQL directly (requires calling this manually from Supabase dashboard)
 * Go to SQL Editor in Supabase dashboard and run:
 * 
 * ALTER TABLE shops ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;
 * ALTER TABLE shops ADD COLUMN IF NOT EXISTS pin_order INTEGER DEFAULT 999;
 * CREATE INDEX IF NOT EXISTS idx_shops_is_pinned ON shops(is_pinned DESC, pin_order ASC);
 */
export const getSetupSql = () => {
  return `
    ALTER TABLE shops ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;
    ALTER TABLE shops ADD COLUMN IF NOT EXISTS pin_order INTEGER DEFAULT 999;
    CREATE INDEX IF NOT EXISTS idx_shops_is_pinned ON shops(is_pinned DESC, pin_order ASC);
  `;
};
