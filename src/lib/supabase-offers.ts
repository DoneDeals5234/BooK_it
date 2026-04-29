import { supabase } from '@/lib/supabase';
import { ShopOffer } from '@/types';
import { sendBroadcastNotification } from '@/lib/onesignal-messaging';

// Get active offers for a shop (for customer view)
export const getActiveOffersByShopId = async (shopId: string): Promise<ShopOffer[]> => {
  const { data, error } = await supabase
    .from('shop_offers')
    .select('*')
    .eq('shop_id', shopId)
    .eq('is_active', true)
    .gt('valid_until', new Date().toISOString())
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Error fetching shop offers:', error);
    return [];
  }

  return (data || []).map(item => ({
    id: item.id,
    shopId: item.shop_id,
    title: item.title,
    description: item.description,
    imageUrl: item.image_url,
    discountPercentage: item.discount_percentage,
    discountAmount: item.discount_amount,
    validFrom: new Date(item.valid_from),
    validUntil: new Date(item.valid_until),
    isActive: item.is_active,
    displayOrder: item.display_order,
    createdAt: new Date(item.created_at),
    updatedAt: new Date(item.updated_at),
  }));
};

// Get all offers for a shop (for admin view - includes expired/inactive)
export const getAllOffersByShopId = async (shopId: string): Promise<ShopOffer[]> => {
  const { data, error } = await supabase
    .from('shop_offers')
    .select('*')
    .eq('shop_id', shopId)
    .order('valid_until', { ascending: false })
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Error fetching shop offers:', error);
    return [];
  }

  return (data || []).map(item => ({
    id: item.id,
    shopId: item.shop_id,
    title: item.title,
    description: item.description,
    imageUrl: item.image_url,
    discountPercentage: item.discount_percentage,
    discountAmount: item.discount_amount,
    validFrom: new Date(item.valid_from),
    validUntil: new Date(item.valid_until),
    isActive: item.is_active,
    displayOrder: item.display_order,
    createdAt: new Date(item.created_at),
    updatedAt: new Date(item.updated_at),
  }));
};

// Get a single offer by ID
export const getOfferById = async (offerId: string): Promise<ShopOffer | null> => {
  const { data, error } = await supabase
    .from('shop_offers')
    .select('*')
    .eq('id', offerId)
    .single();

  if (error || !data) {
    console.error('Error fetching offer:', error);
    return null;
  }

  return {
    id: data.id,
    shopId: data.shop_id,
    title: data.title,
    description: data.description,
    imageUrl: data.image_url,
    discountPercentage: data.discount_percentage,
    discountAmount: data.discount_amount,
    validFrom: new Date(data.valid_from),
    validUntil: new Date(data.valid_until),
    isActive: data.is_active,
    displayOrder: data.display_order,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
};

// Add a new offer
export const addOffer = async (
  shopId: string,
  title: string,
  validUntil: Date,
  imageUrl?: string,
  description?: string,
  discountPercentage?: number,
  discountAmount?: number,
  validFrom?: Date
): Promise<ShopOffer | null> => {
  // Validate image size if provided
  if (imageUrl && imageUrl.startsWith('data:')) {
    const sizeInKB = (imageUrl.length * 0.75) / 1024;
    if (sizeInKB > 2048) {
      throw new Error(`Image is too large (${Math.round(sizeInKB)}KB). Please use an image smaller than 2MB.`);
    }
  }

  // Validate discount parameters
  if (!discountPercentage && !discountAmount) {
    throw new Error('Please provide either a discount percentage or discount amount');
  }

  const { data, error } = await supabase
    .from('shop_offers')
    .insert({
      shop_id: shopId,
      title,
      description,
      image_url: imageUrl,
      discount_percentage: discountPercentage || null,
      discount_amount: discountAmount || null,
      valid_from: validFrom || new Date(),
      valid_until: validUntil,
      is_active: true,
      display_order: 0,
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding offer:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      status: error.status,
    });
    throw new Error(`Failed to add offer: ${error.message || 'Unknown error'}`);
  }

  // Send broadcast notification to all users about the new offer
  try {
    sendBroadcastNotification(
      `New Offer: ${title}`,
      description || 'Check out this new deal!',
      imageUrl,
      shopId
    );
  } catch (notifyError) {
    console.warn('⚠️ Failed to send broadcast notification for new offer:', notifyError);
  }

  return {
    id: data.id,
    shopId: data.shop_id,
    title: data.title,
    description: data.description,
    imageUrl: data.image_url,
    discountPercentage: data.discount_percentage,
    discountAmount: data.discount_amount,
    validFrom: new Date(data.valid_from),
    validUntil: new Date(data.valid_until),
    isActive: data.is_active,
    displayOrder: data.display_order,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
};

// Update an offer
export const updateOffer = async (
  offerId: string,
  updates: Partial<Omit<ShopOffer, 'id' | 'shopId' | 'createdAt'>>
): Promise<ShopOffer | null> => {
  const updateData: any = {};
  
  if (updates.title !== undefined) updateData.title = updates.title;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.imageUrl !== undefined) updateData.image_url = updates.imageUrl;
  if (updates.discountPercentage !== undefined) updateData.discount_percentage = updates.discountPercentage;
  if (updates.discountAmount !== undefined) updateData.discount_amount = updates.discountAmount;
  if (updates.validFrom !== undefined) updateData.valid_from = updates.validFrom;
  if (updates.validUntil !== undefined) updateData.valid_until = updates.validUntil;
  if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
  if (updates.displayOrder !== undefined) updateData.display_order = updates.displayOrder;

  const { data, error } = await supabase
    .from('shop_offers')
    .update({ ...updateData, updated_at: new Date().toISOString() })
    .eq('id', offerId)
    .select()
    .single();

  if (error) {
    console.error('Error updating offer:', error);
    return null;
  }

  return {
    id: data.id,
    shopId: data.shop_id,
    title: data.title,
    description: data.description,
    imageUrl: data.image_url,
    discountPercentage: data.discount_percentage,
    discountAmount: data.discount_amount,
    validFrom: new Date(data.valid_from),
    validUntil: new Date(data.valid_until),
    isActive: data.is_active,
    displayOrder: data.display_order,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
};

// Delete an offer
export const deleteOffer = async (offerId: string): Promise<void> => {
  const { error } = await supabase
    .from('shop_offers')
    .delete()
    .eq('id', offerId);

  if (error) {
    console.error('Error deleting offer:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    throw new Error(`Failed to delete offer: ${error.message || 'Unknown error'}`);
  }
};
