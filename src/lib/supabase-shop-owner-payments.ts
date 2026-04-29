import { supabase } from '@/lib/supabase';

export interface ShopOwnerPayment {
  id: string;
  email: string;
  amount: number;
  currency: string;
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
  payment_status: 'pending' | 'success' | 'failed';
  created_at: Date;
  updated_at: Date;
}

// Create a payment record when order is created
export const createPaymentRecord = async (
  email: string,
  amount: number,
  orderId: string
): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from('shop_owner_payments')
      .insert({
        email,
        amount,
        currency: 'INR',
        razorpay_order_id: orderId,
        payment_status: 'pending',
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating payment record:', error);
      return null;
    }

    return data?.id || null;
  } catch (error) {
    console.error('Error in createPaymentRecord:', error);
    return null;
  }
};

// Update payment record when payment is verified
export const updatePaymentRecord = async (
  orderId: string,
  paymentId: string,
  signature: string,
  status: 'success' | 'failed'
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('shop_owner_payments')
      .update({
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
        payment_status: status,
        updated_at: new Date().toISOString(),
      })
      .eq('razorpay_order_id', orderId);

    if (error) {
      console.error('Error updating payment record:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in updatePaymentRecord:', error);
    return false;
  }
};

// Get payment by order ID
export const getPaymentByOrderId = async (orderId: string): Promise<ShopOwnerPayment | null> => {
  try {
    const { data, error } = await supabase
      .from('shop_owner_payments')
      .select('*')
      .eq('razorpay_order_id', orderId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // No rows found
      console.error('Error getting payment record:', error);
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,
      email: data.email,
      amount: data.amount,
      currency: data.currency,
      razorpay_order_id: data.razorpay_order_id,
      razorpay_payment_id: data.razorpay_payment_id,
      razorpay_signature: data.razorpay_signature,
      payment_status: data.payment_status,
      created_at: new Date(data.created_at),
      updated_at: new Date(data.updated_at),
    };
  } catch (error) {
    console.error('Error in getPaymentByOrderId:', error);
    return null;
  }
};

// Get payment by email
export const getPaymentsByEmail = async (email: string): Promise<ShopOwnerPayment[]> => {
  try {
    const { data, error } = await supabase
      .from('shop_owner_payments')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error getting payments:', error);
      return [];
    }

    return (data || []).map(payment => ({
      id: payment.id,
      email: payment.email,
      amount: payment.amount,
      currency: payment.currency,
      razorpay_order_id: payment.razorpay_order_id,
      razorpay_payment_id: payment.razorpay_payment_id,
      razorpay_signature: payment.razorpay_signature,
      payment_status: payment.payment_status,
      created_at: new Date(payment.created_at),
      updated_at: new Date(payment.updated_at),
    }));
  } catch (error) {
    console.error('Error in getPaymentsByEmail:', error);
    return [];
  }
};

// Check if user already paid for registration
export const hasCompletedPayment = async (email: string): Promise<boolean> => {
  try {
    const payments = await getPaymentsByEmail(email);
    return payments.some(p => p.payment_status === 'success');
  } catch (error) {
    console.error('Error in hasCompletedPayment:', error);
    return false;
  }
};
