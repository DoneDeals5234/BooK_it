import { supabase } from '@/lib/supabase';
import { FeaturedProduct } from '@/types';

// Interfaces
export interface CartItem {
  id: string;
  userId: string;
  productId: string;
  quantity: number;
  createdAt: Date;
  product?: FeaturedProduct;
}

export interface ProductOrder {
  id: string;
  userId: string;
  shopId: string;
  productId: string;
  quantity: number;
  totalPrice: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  shippingAddress: string;
  createdAt: Date;
}

export interface ProductReview {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: Date;
}

// Global Products for Bazar
export const getAllActiveProducts = async (): Promise<FeaturedProduct[]> => {
  const { data, error } = await supabase
    .from('featured_products')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching all active products:', error);
    return [];
  }

  return (data || []).map(item => ({
    id: item.id,
    shopId: item.shop_id,
    title: item.title,
    price: item.price,
    originalPrice: item.original_price,
    discountPercentage: item.discount_percentage,
    imageUrl: item.image_url,
    description: item.description,
    isActive: item.is_active,
    displayOrder: item.display_order,
    stock: item.stock || item.inventory,
    maxPerCustomer: item.max_per_customer,
    createdAt: new Date(item.created_at),
    updatedAt: new Date(item.updated_at),
  }));
};

// Phased Fetching Functions for Ultra-fast Chunked Loading
export const getProductsPhase1 = async (offset = 0, limit = 10) => {
  const { data, error } = await supabase
    .from('featured_products')
    .select('id, title, created_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
    
  if (error) {
    console.error('Error in Phase 1:', error);
    return [];
  }
  return data;
};

export const getProductsPhase2 = async (ids: string[]) => {
  if (!ids || ids.length === 0) return [];
  const { data, error } = await supabase
    .from('featured_products')
    .select('id, price, original_price, discount_percentage, inventory, max_per_customer')
    .in('id', ids);
    
  if (error) {
    console.error('Error in Phase 2:', error);
    return [];
  }
  return data;
};

export const getProductsPhase3 = async (ids: string[]) => {
  if (!ids || ids.length === 0) return [];
  const { data, error } = await supabase
    .from('featured_products')
    .select('id, image_url, images, description, shop_id, category')
    .in('id', ids);
    
  if (error) {
    console.error('Error in Phase 3:', error);
    return [];
  }
  return data;
};


export const getProductById = async (productId: string): Promise<FeaturedProduct | null> => {
  const { data, error } = await supabase
    .from('featured_products')
    .select('*')
    .eq('id', productId)
    .single();

  if (error || !data) {
    console.error('Error fetching product by id:', error);
    return null;
  }

  return {
    id: data.id,
    shopId: data.shop_id,
    title: data.title,
    price: data.price,
    originalPrice: data.original_price,
    discountPercentage: data.discount_percentage,
    imageUrl: data.image_url,
    images: data.images || [],
    description: data.description,
    isActive: data.is_active,
    displayOrder: data.display_order,
    stock: data.stock || data.inventory,
    maxPerCustomer: data.max_per_customer,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
};

export const getSimilarProducts = async (shopId: string, currentProductId: string, limit = 5): Promise<FeaturedProduct[]> => {
  const { data, error } = await supabase
    .from('featured_products')
    .select('*')
    .eq('shop_id', shopId)
    .eq('is_active', true)
    .neq('id', currentProductId)
    .limit(limit);

  if (error) {
    console.error('Error fetching similar products:', error);
    return [];
  }

  return (data || []).map(item => ({
    id: item.id,
    shopId: item.shop_id,
    title: item.title,
    price: item.price,
    originalPrice: item.original_price,
    discountPercentage: item.discount_percentage,
    imageUrl: item.image_url,
    description: item.description,
    isActive: item.is_active,
    displayOrder: item.display_order,
    stock: item.stock || item.inventory,
    maxPerCustomer: item.max_per_customer,
    createdAt: new Date(item.created_at),
    updatedAt: new Date(item.updated_at),
  }));
};

// Cart
export const addToCart = async (userId: string, productId: string, quantity: number = 1): Promise<boolean> => {
  const { data: existing } = await supabase
    .from('cart_items')
    .select('*')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .single();

  if (existing) {
    const { error } = await supabase
      .from('cart_items')
      .update({ quantity: existing.quantity + quantity })
      .eq('id', existing.id);
    return !error;
  }

  const { error } = await supabase
    .from('cart_items')
    .insert({ user_id: userId, product_id: productId, quantity });

  if (error) {
    console.error('Error adding to cart:', error);
    return false;
  }
  return true;
};

export const getCartItems = async (userId: string): Promise<CartItem[]> => {
  const { data, error } = await supabase
    .from('cart_items')
    .select('*, product:featured_products(*)')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching cart items:', error);
    return [];
  }

  return (data || []).map(item => ({
    id: item.id,
    userId: item.user_id,
    productId: item.product_id,
    quantity: item.quantity,
    createdAt: new Date(item.created_at),
    product: item.product ? {
      id: item.product.id,
      shopId: item.product.shop_id,
      title: item.product.title,
      price: item.product.price,
      imageUrl: item.product.image_url,
      isActive: item.product.is_active,
      createdAt: new Date(item.product.created_at),
      updatedAt: new Date(item.product.updated_at),
    } : undefined
  }));
};

export const updateCartQuantity = async (userId: string, productId: string, quantity: number): Promise<boolean> => {
  if (quantity <= 0) {
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('user_id', userId)
      .eq('product_id', productId);
    return !error;
  }

  const { data: existing } = await supabase
    .from('cart_items')
    .select('id')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .single();

  if (existing) {
    const { error } = await supabase
      .from('cart_items')
      .update({ quantity })
      .eq('id', existing.id);
    return !error;
  } else {
    const { error } = await supabase
      .from('cart_items')
      .insert({ user_id: userId, product_id: productId, quantity });
    return !error;
  }
};

// Orders
export const createProductOrder = async (
  userId: string,
  shopId: string,
  productId: string,
  quantity: number,
  totalPrice: number,
  shippingAddress: string
): Promise<boolean> => {
  const { error } = await supabase
    .from('product_orders')
    .insert({
      user_id: userId,
      shop_id: shopId,
      product_id: productId,
      quantity,
      total_price: totalPrice,
      shipping_address: shippingAddress,
      status: 'pending'
    });

  if (error) {
    console.error('Error creating product order:', error);
    return false;
  }
  return true;
};

// Reviews
export const getProductReviews = async (productId: string): Promise<ProductReview[]> => {
  const { data, error } = await supabase
    .from('product_reviews')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching product reviews:', error);
    return [];
  }

  return (data || []).map(item => ({
    id: item.id,
    productId: item.product_id,
    userId: item.user_id,
    userName: item.user_name,
    rating: item.rating,
    comment: item.comment,
    createdAt: new Date(item.created_at)
  }));
};

export const addProductReview = async (
  productId: string,
  userId: string,
  userName: string,
  rating: number,
  comment: string
): Promise<ProductReview | null> => {
  const { data, error } = await supabase
    .from('product_reviews')
    .insert({
      product_id: productId,
      user_id: userId,
      user_name: userName,
      rating,
      comment
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding product review:', error);
    return null;
  }

  return {
    id: data.id,
    productId: data.product_id,
    userId: data.user_id,
    userName: data.user_name,
    rating: data.rating,
    comment: data.comment,
    createdAt: new Date(data.created_at)
  };
};
