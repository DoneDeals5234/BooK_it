import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { createPaymentRecord, updatePaymentRecord } from '@/lib/supabase-shop-owner-payments';
import { createPlanRecord, updatePlanRecord } from '@/lib/supabase-shop-owner-plans';
import toast from 'react-hot-toast';
import { load } from '@cashfreepayments/cashfree-js';

export interface PaymentOptions {
  amount: number; // Amount in paise (e.g., 100 for ₹1)
  description: string;
  userEmail: string;
  userName?: string;
  userPhone?: string;
  userId?: string;
  isShopOwnerRegistration?: boolean; // Flag to save to shop_owner_payments table
  planName?: string; // Shop owner plan name (basic, pro, premium)
  isShopOwnerPlan?: boolean; // Flag to save to shop_owner_plans table
}

export interface PaymentResponse {
  success: boolean;
  orderId?: string;
  error?: string;
}

export const initiateCashfreePayment = async (
  options: PaymentOptions,
  onSuccess: (orderId: string) => void,
  onFailure?: (error: string) => void
): Promise<boolean> => {
  try {
    const paymentToast = toast.loading('Initiating Cashfree payment...');

    console.log('💳 Step 1: Creating order...');
    // Create order using our Supabase Edge Function
    let orderData, orderError;
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/create-cashfree-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'apikey': supabaseAnonKey
        },
        body: JSON.stringify({
          amount: options.amount,
          userId: options.userId || '',
          userEmail: options.userEmail,
          userPhone: options.userPhone || '9999999999',
          customerName: options.userName || 'Shop Owner',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP error! status: ${response.status}`);
      }

      orderData = await response.json();
    } catch (err) {
      console.error('Fetch error:', err);
      // Fallback to invoke if fetch fails
      const result = await supabase.functions.invoke('create-cashfree-order', {
        body: {
          amount: options.amount,
          userId: options.userId || '',
          userEmail: options.userEmail,
          userPhone: options.userPhone || '9999999999',
          customerName: options.userName || 'Shop Owner',
        },
      });
      orderData = result.data;
      orderError = result.error;
    }

    if (orderError || !orderData) {
      toast.error('Failed to create order', { id: paymentToast });
      onFailure?.('Failed to create order');
      return false;
    }

    const { orderId, paymentSessionId } = orderData;
    console.log('✅ Order created:', orderId);
    toast.success('Order created! Opening gateway...', { id: paymentToast });

    // Save payment record for shop owner registration
    if (options.isShopOwnerRegistration) {
      console.log('💾 Saving payment record...');
      await createPaymentRecord(options.userEmail, options.amount, orderId);
    }

    // Save plan record for shop owner plan selection
    if (options.isShopOwnerPlan && options.planName) {
      console.log('💾 Saving plan record for plan:', options.planName);
      await createPlanRecord(options.userEmail, options.planName as any, orderId);
    }

    // Step 2: Initialize Cashfree SDK
    const cashfree = await load({
      mode: "production", // Switch to "sandbox" if testing
    });

    if (!cashfree) {
      throw new Error('Cashfree SDK failed to load');
    }

    const checkoutOptions = {
      paymentSessionId: paymentSessionId,
      redirectTarget: "_modal",
    };

    // Step 3: Start Checkout
    cashfree.checkout(checkoutOptions).then((result) => {
      if (result.error) {
        console.error("Cashfree checkout error:", result.error);
        toast.error('Payment Failed: ' + result.error.message);
        onFailure?.(result.error.message || 'Payment failed');
        
        // Update records to failed
        if (options.isShopOwnerRegistration) {
          updatePaymentRecord(orderId, 'failed', '', 'failed').catch(console.error);
        }
        if (options.isShopOwnerPlan) {
          updatePlanRecord(orderId, 'failed', '', 'failed').catch(console.error);
        }
      }
      
      if (result.redirect) {
        console.log("Payment will be redirected");
      }
      
      if (result.paymentDetails) {
        console.log("Payment has been completed, verifying...");
        
        // Step 4: Verify Payment
        const verifyingToast = toast.loading('Verifying payment...');
        supabase.functions.invoke('verify-cashfree-payment', {
          body: { orderId: orderId }
        }).then(async ({ data: verifyData, error: verifyError }) => {
          if (verifyError || !verifyData?.success) {
             console.error('❌ Verification failed:', verifyError || verifyData?.error);
             toast.error('Payment Verification Failed', { id: verifyingToast });

             if (options.isShopOwnerRegistration) {
               await updatePaymentRecord(orderId, result.paymentDetails?.paymentMessage || 'unknown', '', 'failed');
             }
             if (options.isShopOwnerPlan) {
               await updatePlanRecord(orderId, result.paymentDetails?.paymentMessage || 'unknown', '', 'failed');
             }
             
             onFailure?.('Payment verification failed');
          } else {
             console.log('✅ Payment verified successfully');
             
             // In Cashfree, we don't have separate signature strings on frontend, just orderId
             if (options.isShopOwnerRegistration) {
               await updatePaymentRecord(orderId, orderId, 'verified', 'success');
             }
             if (options.isShopOwnerPlan) {
               await updatePlanRecord(orderId, orderId, 'verified', 'success');
             }
             
             toast.success('Payment Successful! ✅', { id: verifyingToast });
             onSuccess(orderId);
          }
        });
      }
    });

    return true;
  } catch (error) {
    console.error('Payment error:', error);
    toast.error(error instanceof Error ? error.message : 'Error initiating payment');
    onFailure?.(error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
};
