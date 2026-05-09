import { supabase } from '@/lib/supabase';
import { FeaturedProduct } from '@/types';

// Get featured products for a shop
export const getFeaturedProductsByShopId = async (shopId: string): Promise<FeaturedProduct[]> => {
  const { data, error } = await supabase
    .from('featured_products')
    .select('*')
    .eq('shop_id', shopId)
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Error fetching featured products:', error);
    return [];
  }

  return (data || []).map(item => ({
    id: item.id,
    shopId: item.shop_id,
    title: item.title,
    price: item.price,
    originalPrice: item.original_price,
    discountPercentage: item.discount_percentage,
    category: item.category,
    imageUrl: item.image_url,
    description: item.description,
    isActive: item.is_active,
    displayOrder: item.display_order,
    inventory: item.inventory,
    createdAt: new Date(item.created_at),
    updatedAt: new Date(item.updated_at),
  }));
};

// Get a single featured product by ID
export const getFeaturedProductById = async (productId: string): Promise<FeaturedProduct | null> => {
  const { data, error } = await supabase
    .from('featured_products')
    .select('*')
    .eq('id', productId)
    .single();

  if (error || !data) {
    console.error('Error fetching featured product:', error);
    return null;
  }

  return {
    id: data.id,
    shopId: data.shop_id,
    title: data.title,
    price: data.price,
    originalPrice: data.original_price,
    discountPercentage: data.discount_percentage,
    category: data.category,
    imageUrl: data.image_url,
    description: data.description,
    isActive: data.is_active,
    displayOrder: data.display_order,
    inventory: data.inventory,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
};

// Add a new featured product
export const addFeaturedProduct = async (
  shopId: string,
  title: string,
  price: number,
  imageUrl: string,
  description?: string,
  originalPrice?: number,
  discountPercentage?: number,
  category?: string
): Promise<FeaturedProduct | null> => {
  // Validate image size (warn if larger than 2MB as base64)
  if (imageUrl.startsWith('data:')) {
    const sizeInKB = (imageUrl.length * 0.75) / 1024; // Base64 is ~33% larger than binary
    if (sizeInKB > 2048) {
      throw new Error(`Image is too large (${Math.round(sizeInKB)}KB). Please use an image smaller than 2MB.`);
    }
  }

  const { data, error } = await supabase
    .from('featured_products')
    .insert({
      shop_id: shopId,
      title,
      price,
      original_price: originalPrice,
      discount_percentage: discountPercentage,
      category: category,
      image_url: imageUrl,
      description,
      is_active: true,
      display_order: 0,
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding featured product:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      status: error.status,
    });
    throw new Error(`Failed to add product: ${error.message || 'Unknown error'}`);
  }

  return {
    id: data.id,
    shopId: data.shop_id,
    title: data.title,
    price: data.price,
    originalPrice: data.original_price,
    discountPercentage: data.discount_percentage,
    category: data.category,
    imageUrl: data.image_url,
    description: data.description,
    isActive: data.is_active,
    displayOrder: data.display_order,
    inventory: data.inventory,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
};

// Update a featured product
export const updateFeaturedProduct = async (
  productId: string,
  updates: Partial<Omit<FeaturedProduct, 'id' | 'createdAt'>>
): Promise<FeaturedProduct | null> => {
  const updateData: any = {};
  
  if (updates.title !== undefined) updateData.title = updates.title;
  if (updates.price !== undefined) updateData.price = updates.price;
  if (updates.originalPrice !== undefined) updateData.original_price = updates.originalPrice;
  if (updates.discountPercentage !== undefined) updateData.discount_percentage = updates.discountPercentage;
  if (updates.category !== undefined) updateData.category = updates.category;
  if (updates.imageUrl !== undefined) updateData.image_url = updates.imageUrl;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
  if (updates.displayOrder !== undefined) updateData.display_order = updates.displayOrder;

  const { data, error } = await supabase
    .from('featured_products')
    .update({ ...updateData, updated_at: new Date().toISOString() })
    .eq('id', productId)
    .select()
    .single();

  if (error) {
    console.error('Error updating featured product:', error);
    return null;
  }

  return {
    id: data.id,
    shopId: data.shop_id,
    title: data.title,
    price: data.price,
    originalPrice: data.original_price,
    discountPercentage: data.discount_percentage,
    category: data.category,
    imageUrl: data.image_url,
    description: data.description,
    isActive: data.is_active,
    displayOrder: data.display_order,
    inventory: data.inventory,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
};

// Delete a featured product
export const deleteFeaturedProduct = async (productId: string): Promise<void> => {
  const { error } = await supabase
    .from('featured_products')
    .delete()
    .eq('id', productId);

  if (error) {
    console.error('Error deleting featured product:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    throw new Error(`Failed to delete product: ${error.message || 'Unknown error'}`);
  }
};
