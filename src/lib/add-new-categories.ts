import { supabase } from '@/lib/supabase';

/**
 * Add new shop categories: Chemist, Hardware, Electrical, and Food Cart
 * This function inserts new categories into the categories table
 */
export const addNewShopCategories = async (): Promise<void> => {
  try {
    console.log('🔄 Adding new shop categories...');

    // Get the current highest display_order
    const { data: existingCategories } = await supabase
      .from('categories')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1);

    const maxOrder = (existingCategories && existingCategories.length > 0)
      ? existingCategories[0].display_order + 1
      : 1;

    // New categories to add
    const newCategories = [
      {
        name: 'Chemist',
        slug: 'chemist',
        icon: '💊',
        description: 'Medicine stores and pharmacies',
        display_order: maxOrder,
      },
      {
        name: 'Hardware',
        slug: 'hardware',
        icon: '🔨',
        description: 'Hardware and tools shops',
        display_order: maxOrder + 1,
      },
      {
        name: 'Electrical',
        slug: 'electrical',
        icon: '⚡',
        description: 'Electrical supply stores',
        display_order: maxOrder + 2,
      },
      {
        name: 'Food Cart',
        slug: 'food-cart',
        icon: '🍽️',
        description: 'Food carts and street food vendors',
        display_order: maxOrder + 3,
      },
    ];

    // Insert categories
    const { data, error } = await supabase
      .from('categories')
      .insert(newCategories)
      .select();

    if (error) {
      console.error('❌ Error adding categories:', error);
      throw error;
    }

    console.log('✅ Successfully added new categories:', data?.map(c => c.name).join(', '));
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ Error in addNewShopCategories:', errorMsg);
    throw error;
  }
};
