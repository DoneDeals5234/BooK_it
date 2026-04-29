import { supabase } from './supabase';

export interface KhataBookCustomer {
  id: string;
  shop_id: string;
  customer_name: string;
  phone_number?: string;
  total_amount_to_collect: number;
  remaining_amount: number;
  status: 'pending' | 'settled';
  created_at: string;
  updated_at: string;
}

export interface KhataBookPayment {
  id: string;
  customer_id: string;
  shop_id: string;
  amount_paid: number;
  payment_date: string;
  notes?: string;
  created_at: string;
}

/**
 * Get all khata book customers for a specific shop
 */
export async function getKhataBookCustomers(shopId: string): Promise<KhataBookCustomer[]> {
  try {
    const { data, error } = await supabase
      .from('khata_book_customers')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching khata book customers:', {
        message: error.message,
        code: error.code,
        details: error.details,
      });
      throw new Error(error.message || 'Failed to fetch customers');
    }
    return data || [];
  } catch (error) {
    console.error('Error fetching khata book customers:', error instanceof Error ? error.message : error);
    throw error;
  }
}

/**
 * Add a new customer to khata book
 */
export async function addKhataBookCustomer(
  shopId: string,
  customerName: string,
  phoneNumber: string | null,
  totalAmount: number
): Promise<KhataBookCustomer> {
  try {
    const { data, error } = await supabase
      .from('khata_book_customers')
      .insert({
        shop_id: shopId,
        customer_name: customerName,
        phone_number: phoneNumber,
        total_amount_to_collect: totalAmount,
        remaining_amount: totalAmount,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding khata book customer:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      throw new Error(error.message || 'Failed to add customer');
    }
    return data;
  } catch (error) {
    console.error('Error adding khata book customer:', error instanceof Error ? error.message : error);
    throw error;
  }
}

/**
 * Update customer information
 */
export async function updateKhataBookCustomer(
  customerId: string,
  updates: Partial<KhataBookCustomer>
): Promise<KhataBookCustomer> {
  try {
    const { data, error } = await supabase
      .from('khata_book_customers')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', customerId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating khata book customer:', error);
    throw error;
  }
}

/**
 * Delete a customer from khata book
 */
export async function deleteKhataBookCustomer(customerId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('khata_book_customers')
      .delete()
      .eq('id', customerId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting khata book customer:', error);
    throw error;
  }
}

/**
 * Record a payment for a customer
 */
export async function recordKhataBookPayment(
  customerId: string,
  shopId: string,
  amountPaid: number,
  notes?: string
): Promise<KhataBookPayment> {
  try {
    // First, record the payment
    const { data: paymentData, error: paymentError } = await supabase
      .from('khata_book_payments')
      .insert({
        customer_id: customerId,
        shop_id: shopId,
        amount_paid: amountPaid,
        notes: notes || null,
        payment_date: new Date().toISOString(),
      })
      .select()
      .single();

    if (paymentError) throw paymentError;

    // Then, update the customer's remaining amount
    const customerResponse = await supabase
      .from('khata_book_customers')
      .select('remaining_amount')
      .eq('id', customerId)
      .single();

    if (customerResponse.error) throw customerResponse.error;

    const currentRemaining = customerResponse.data.remaining_amount;
    const newRemaining = Math.max(0, currentRemaining - amountPaid);
    const newStatus = newRemaining === 0 ? 'settled' : 'pending';

    await supabase
      .from('khata_book_customers')
      .update({
        remaining_amount: newRemaining,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', customerId);

    return paymentData;
  } catch (error) {
    console.error('Error recording khata book payment:', error);
    throw error;
  }
}

/**
 * Get all payments for a specific customer
 */
export async function getCustomerPayments(customerId: string): Promise<KhataBookPayment[]> {
  try {
    const { data, error } = await supabase
      .from('khata_book_payments')
      .select('*')
      .eq('customer_id', customerId)
      .order('payment_date', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching customer payments:', error);
    throw error;
  }
}

/**
 * Get total collection statistics for a shop
 */
export async function getKhataBookStats(shopId: string): Promise<{
  totalCustomers: number;
  activeCustomers: number;
  totalOutstanding: number;
  totalCollected: number;
}> {
  try {
    const { data: customers, error: customersError } = await supabase
      .from('khata_book_customers')
      .select('total_amount_to_collect, remaining_amount, status')
      .eq('shop_id', shopId);

    if (customersError) throw customersError;

    const stats = {
      totalCustomers: customers?.length || 0,
      activeCustomers: customers?.filter(c => c.status === 'pending').length || 0,
      totalOutstanding: customers?.reduce((sum, c) => sum + (c.remaining_amount || 0), 0) || 0,
      totalCollected: customers?.reduce((sum, c) => sum + ((c.total_amount_to_collect || 0) - (c.remaining_amount || 0)), 0) || 0,
    };

    return stats;
  } catch (error) {
    console.error('Error fetching khata book stats:', error);
    throw error;
  }
}
