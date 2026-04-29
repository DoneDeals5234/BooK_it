import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { createPaymentRecord, updatePaymentRecord } from '@/lib/supabase-shop-owner-payments';
import { createPlanRecord, updatePlanRecord } from '@/lib/supabase-shop-owner-plans';
import toast from 'react-hot-toast';

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

// Load Razorpay SDK
export const loadRazorpaySDK = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export const initiateRazorpayPayment = async (
  options: PaymentOptions,
  onSuccess: (orderId: string) => void,
  onFailure?: (error: string) => void
): Promise<boolean> => {
  try {
    const paymentToast = toast.loading('Initiating payment...');

    // Load Razorpay SDK
    const isLoaded = await loadRazorpaySDK();
    if (!isLoaded) {
      toast.error('Failed to load payment gateway', { id: paymentToast });
      onFailure?.('Failed to load Razorpay');
      return false;
    }

    console.log('💳 Step 1: Creating order...');
    // Create order
    let orderData, orderError;
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/create-order`, {
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
      const result = await supabase.functions.invoke('create-order', {
        body: {
          amount: options.amount,
          userId: options.userId || '',
          userEmail: options.userEmail,
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

    const { orderId, keyId } = orderData;
    console.log('✅ Order created:', orderId);
    toast.success('Order created!', { id: paymentToast });

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

    // Razorpay checkout options
    const razorpayOptions = {
      key: keyId,
      amount: options.amount,
      currency: 'INR',
      name: 'Book It - Shop Owner',
      description: options.description,
      order_id: orderId,
      modal: {
        ondismiss: function() {
          console.log('❌ Checkout dismissed');
          toast.error('Payment cancelled');
        }
      },
      handler: async function (response: any) {
        const verifyingToast = toast.loading('Verifying payment...');
        console.log('🔐 Step 3: Verifying payment...');
        try {
          // Verify payment on backend
          const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-payment', {
            body: {
              orderId: orderId,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              userId: options.userId || '',
            },
          });

          if (verifyError || !verifyData?.success) {
            console.error('❌ Verification failed:', verifyError || verifyData?.error);
            toast.error('Payment Verification Failed', { id: verifyingToast });

            // Update payment record to failed if this is shop owner registration
            if (options.isShopOwnerRegistration) {
              await updatePaymentRecord(orderId, response.razorpay_payment_id, response.razorpay_signature, 'failed');
            }

            // Update plan record to failed if this is shop owner plan
            if (options.isShopOwnerPlan) {
              await updatePlanRecord(orderId, response.razorpay_payment_id, response.razorpay_signature, 'failed');
            }

            onFailure?.('Payment verification failed');
            return;
          }

          console.log('✅ Payment verified successfully');

          // Update payment record to success if this is shop owner registration
          if (options.isShopOwnerRegistration) {
            await updatePaymentRecord(orderId, response.razorpay_payment_id, response.razorpay_signature, 'success');
          }

          // Update plan record to success if this is shop owner plan
          if (options.isShopOwnerPlan) {
            await updatePlanRecord(orderId, response.razorpay_payment_id, response.razorpay_signature, 'success');
          }

          toast.success('Payment Successful! ✅', { id: verifyingToast });
          onSuccess(orderId);
        } catch (err) {
          console.error('❌ Error during verification:', err);
          toast.error('Error verifying payment', { id: verifyingToast });
          onFailure?.('Error verifying payment');
        }
      },
      prefill: {
        name: options.userName || '',
        email: options.userEmail || '',
        contact: options.userPhone || '',
      },
      notes: {
        userId: options.userId || '',
      },
      theme: {
        color: '#22c55e',
      },
      // UPI Intent Configuration
      method: {
        upi: true,
        netbanking: false,
        card: false,
        wallet: false
      },
      config: {
        display: {
          blocks: {
            upi: {
              name: 'UPI',
              instruments: [
                {
                  method: 'upi',
                  flow: 'intent'
                }
              ]
            }
          },
          sequence: ['block.upi'],
          preferences: {
            show_default_blocks: false
          }
        }
      }
    };

    const rzp = new (window as any).Razorpay(razorpayOptions);
    rzp.on('payment.failed', function (response: any) {
      console.error('❌ Payment failed event:', response.error);
      toast.error('Payment Failed: ' + response.error.description);
      onFailure?.(response.error.description);
    });
    rzp.open();
    return true;
  } catch (error) {
    console.error('Payment error:', error);
    toast.error(error instanceof Error ? error.message : 'Error initiating payment');
    onFailure?.(error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
};
