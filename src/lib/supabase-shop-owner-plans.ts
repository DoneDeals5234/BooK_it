import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export type PlanName = 'free' | 'basic' | 'pro' | 'premium';

export interface ShopOwnerPlan {
  id: string;
  email: string;
  plan_name: PlanName;
  plan_price: number;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
  payment_status: 'pending' | 'success' | 'failed';
  shop_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export const PLAN_DETAILS = {
  free: {
    name: 'FREE',
    price: 0, // Free plan
    priceDisplay: 'Free',
    subtitle: 'Forever Free',
    color: '#6b7280', // Gray color for free tier
    features: [
      { name: 'Register Your Shop', included: true },
      { name: 'Basic Settings', included: true },
      { name: 'Shop Location', included: true },
      { name: 'Contact Information', included: true },
      { name: 'Services Management', included: true },
      { name: 'Staff Members', included: true },
      { name: 'Time Slot Configuration', included: true },
      { name: 'Booking System', included: true },
      { name: 'World Chat Access', included: true },
      { name: 'Campaigns', included: false },
      { name: 'Featured Products', included: true },
      { name: 'Shop Offers', included: true },
      { name: 'Design Your Shop', included: false },
    ],
  },
  basic: {
    name: 'BASIC',
    price: 9900, // ₹99 in paise
    priceDisplay: '₹99',
    subtitle: 'One-Time',
    color: '#1a8a54', // Greenish from image
    features: [
      { name: 'City-Only Notifications', included: true },
      { name: 'Register Your Shop', included: true },
      { name: 'Geolocation Listing', included: true },
      { name: 'World Chat Access', included: true },
      { name: 'Personal DM Access', included: true },
      { name: 'Content Uploads', included: true },
      { name: 'Design Your Shop', included: true },
      { name: 'Campaigns', included: true },
      { name: 'Target Other Locations', included: false },
    ],
  },
  pro: {
    name: 'PRO',
    price: 29900, // ₹299 in paise
    priceDisplay: '₹299',
    subtitle: 'One-Time Fee',
    color: '#0066cc', // Blue from image
    features: [
      { name: 'City-Only Notifications', included: true },
      { name: 'Register Your Shop', included: true },
      { name: 'Geolocation Listing', included: true },
      { name: 'World Chat Access', included: true },
      { name: 'Personal DM Access', included: true },
      { name: 'Design Your Shop', included: true },
      { name: 'Campaigns', included: true },
      { name: 'Target Other Locations', included: false },
      { name: 'Website Builder', included: true },
    ],
  },
  premium: {
    name: 'PREMIUM',
    price: 49900, // ₹499 in paise
    priceDisplay: '₹499',
    subtitle: 'One-Time Fee',
    color: '#6b46c1', // Purple from image
    locked: true, // Plan is locked and cannot be purchased
    features: [
      { name: 'City-Only Notifications', included: true },
      { name: 'Register Your Shop', included: true },
      { name: 'Geolocation Listing', included: true },
      { name: 'World Chat Access', included: true },
      { name: 'Personal DM Access', included: true },
      { name: 'Target Any Location', included: true },
      { name: 'Website Builder', included: true },
    ],
  },
};

// Create a plan selection record
export const createPlanRecord = async (
  email: string,
  planName: PlanName,
  orderId: string
): Promise<string | null> => {
  try {
    const planPrice = PLAN_DETAILS[planName].price;

    const { data, error } = await supabase
      .from('shop_owner_plans')
      .insert({
        email,
        plan_name: planName,
        plan_price: planPrice,
        razorpay_order_id: orderId,
        payment_status: 'pending',
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating plan record:', error);
      return null;
    }

    return data?.id || null;
  } catch (error) {
    console.error('Error in createPlanRecord:', error);
    return null;
  }
};

// Update plan record when payment is verified
export const updatePlanRecord = async (
  orderId: string,
  paymentId: string,
  signature: string,
  status: 'success' | 'failed',
  shopId?: string
): Promise<boolean> => {
  try {
    const updateData: any = {
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
      payment_status: status,
      updated_at: new Date().toISOString(),
    };

    if (shopId) {
      updateData.shop_id = shopId;
    }

    const { error } = await supabase
      .from('shop_owner_plans')
      .update(updateData)
      .eq('razorpay_order_id', orderId);

    if (error) {
      console.error('Error updating plan record:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in updatePlanRecord:', error);
    return false;
  }
};

// Get plan by order ID
export const getPlanByOrderId = async (orderId: string): Promise<ShopOwnerPlan | null> => {
  try {
    const { data, error } = await supabase
      .from('shop_owner_plans')
      .select('*')
      .eq('razorpay_order_id', orderId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // No rows found
      console.error('Error getting plan record:', error);
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,
      email: data.email,
      plan_name: data.plan_name,
      plan_price: data.plan_price,
      razorpay_order_id: data.razorpay_order_id,
      razorpay_payment_id: data.razorpay_payment_id,
      razorpay_signature: data.razorpay_signature,
      payment_status: data.payment_status,
      shop_id: data.shop_id,
      created_at: new Date(data.created_at),
      updated_at: new Date(data.updated_at),
    };
  } catch (error) {
    console.error('Error in getPlanByOrderId:', error);
    return null;
  }
};

// Get latest successful plan for email
export const getLatestPlanForEmail = async (email: string): Promise<ShopOwnerPlan | null> => {
  if (!isSupabaseConfigured) {
    console.log('ℹ️ Supabase not configured, returning null for plan');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('shop_owner_plans')
      .select('*')
      .eq('email', email)
      .eq('payment_status', 'success')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.warn('⚠️ Error getting latest plan:', error);
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,
      email: data.email,
      plan_name: data.plan_name,
      plan_price: data.plan_price,
      razorpay_order_id: data.razorpay_order_id,
      razorpay_payment_id: data.razorpay_payment_id,
      razorpay_signature: data.razorpay_signature,
      payment_status: data.payment_status,
      shop_id: data.shop_id,
      created_at: new Date(data.created_at),
      updated_at: new Date(data.updated_at),
    };
  } catch (error) {
    console.error('Error in getLatestPlanForEmail:', error);
    return null;
  }
};
// Record a free plan for a user
export const recordFreePlan = async (email: string, shopId?: string): Promise<boolean> => {
  if (!isSupabaseConfigured) return true;

  try {
    const { error } = await supabase
      .from('shop_owner_plans')
      .insert({
        email,
        plan_name: 'free',
        plan_price: 0,
        payment_status: 'success',
        razorpay_order_id: `free_${Date.now()}`,
        shop_id: shopId || null,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error recording free plan:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error in recordFreePlan:', error);
    return false;
  }
};
