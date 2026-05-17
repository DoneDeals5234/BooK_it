import React from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Mail, Phone, MapPin, ShieldCheck, CreditCard, RefreshCw } from 'lucide-react';

const PageWrapper = ({ title, children }: { title: string, children: React.ReactNode }) => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8 pt-20">
      <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="border-b border-slate-100 dark:border-slate-800 p-4 sm:p-6 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
        </div>
        <div className="p-4 sm:p-6 lg:p-8 text-slate-700 dark:text-slate-300 space-y-6 text-sm sm:text-base leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );
};

export const ContactUsPage = () => (
  <PageWrapper title="Contact Us">
    <p>If you have any questions, concerns, or feedback about our platform, please feel free to reach out to us. We are here to help you.</p>
    
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center gap-4">
        <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
          <Mail className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Email Us</p>
          <a href="mailto:pv173597@gmail.com" className="text-sm font-bold text-slate-900 dark:text-white hover:text-blue-600">pv173597@gmail.com</a>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center gap-4">
        <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center text-green-600 dark:text-green-400">
          <Phone className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Call Us</p>
          <a href="tel:+917508990616" className="text-sm font-bold text-slate-900 dark:text-white hover:text-green-600">+91 7508990616</a>
        </div>
      </div>
    </div>

    <div className="mt-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-start gap-4">
      <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center text-red-600 dark:text-red-400 flex-shrink-0">
        <MapPin className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Operating Address</p>
        <p className="text-sm font-bold text-slate-900 dark:text-white">Rupnagar, Punjab, India</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">We are currently operating online and providing services to local shops.</p>
      </div>
    </div>
  </PageWrapper>
);

export const RefundPolicyPage = () => (
  <PageWrapper title="Refunds & Cancellations">
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
  </PageWrapper>
);

export const TermsConditionsPage = () => (
  <PageWrapper title="Terms & Conditions">
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
  </PageWrapper>
);
