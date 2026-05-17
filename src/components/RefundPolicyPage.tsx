import React from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ShieldCheck, CreditCard, RefreshCw } from 'lucide-react';

export const RefundPolicyPage = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8 pt-20">
      <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="border-b border-slate-100 dark:border-slate-800 p-4 sm:p-6 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Refunds & Cancellations</h1>
        </div>
        <div className="p-4 sm:p-6 lg:p-8 text-slate-700 dark:text-slate-300 space-y-6 text-sm sm:text-base leading-relaxed">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold mb-2">
            <ShieldCheck className="h-5 w-5" />
            <span>Your Trust is Our Priority</span>
          </div>
          <p>At Book It, we strive to ensure a smooth and transparent transaction process for all our users. Please read our refund and cancellation policy carefully.</p>

          <div className="space-y-4 mt-6">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white mb-2">
                <CreditCard className="h-5 w-5 text-amber-500" />
                Order Cancellation
              </div>
              <p className="text-sm">If you cancel an order before it has been processed or shipped by the merchant, you are eligible for a full refund. Once the cancellation is approved, the refund amount will be credited back to your original payment method within <strong>5 to 6 working days</strong>.</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white mb-2">
                <RefreshCw className="h-5 w-5 text-green-500" />
                Returns & Refunds
              </div>
              <p className="text-sm">If you are not satisfied with a product or service, you can request a return based on the merchant's specific return policy. Once the merchant receives the returned item or acknowledges the issue, the refund will be processed and will appear in your account within <strong>5 to 6 working days</strong>.</p>
            </div>
          </div>

          <div className="mt-6 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
            <p>Note: The processing time may vary slightly depending on your bank or payment gateway (Cashfree). Working days exclude weekends and public holidays.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RefundPolicyPage;
