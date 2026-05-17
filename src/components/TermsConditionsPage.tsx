import React from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

export const TermsConditionsPage = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8 pt-20">
      <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="border-b border-slate-100 dark:border-slate-800 p-4 sm:p-6 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Terms & Conditions</h1>
        </div>
        <div className="p-4 sm:p-6 lg:p-8 text-slate-700 dark:text-slate-300 space-y-6 text-sm sm:text-base leading-relaxed">
          <p>Welcome to Book It. By using our application and services, you agree to comply with and be bound by the following terms and conditions. Please review them carefully.</p>

          <div className="space-y-6 mt-6">
            <section>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-2">1. Introduction</h2>
              <p className="text-sm">Book It is a platform that connects users with local shops and service providers (like barbers, sellers, etc.). We facilitate bookings, product purchases, and communication between users and merchants.</p>
            </section>

            <section>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-2">2. User Accounts</h2>
              <p className="text-sm">To use certain features of the app, you may be required to create an account. You are responsible for maintaining the confidentiality of your account information and for all activities that occur under your account.</p>
            </section>

            <section>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-2">3. Bookings and Payments</h2>
              <p className="text-sm">When you book a service or purchase a product, you agree to pay the specified amount. Payments are processed securely through third-party gateways (like Cashfree). Merchants are responsible for providing the services and products as described.</p>
            </section>

            <section>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-2">4. Cancellations and Refunds</h2>
              <p className="text-sm">Cancellations and refunds are subject to our Refund Policy and the specific policies of the merchant you are transacting with. Approved refunds are processed within 5-6 working days.</p>
            </section>

            <section>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-2">5. Limitation of Liability</h2>
              <p className="text-sm">Book It acts as a facilitator and is not liable for the quality of services or products provided by independent merchants. Any disputes regarding services or products should be resolved directly with the merchant.</p>
            </section>

            <section>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-2">6. Modifications to Terms</h2>
              <p className="text-sm">We reserve the right to modify these terms at any time. Your continued use of the app after any changes indicates your acceptance of the new terms.</p>
            </section>
          </div>

          <div className="mt-6 text-xs text-slate-500 dark:text-slate-400 border-t pt-4">
            <p>Last updated: May 2026</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsConditionsPage;
