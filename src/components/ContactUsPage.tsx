import React from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Mail, Phone, MapPin } from 'lucide-react';

export const ContactUsPage = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8 pt-20">
      <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="border-b border-slate-100 dark:border-slate-800 p-4 sm:p-6 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Contact Us</h1>
        </div>
        <div className="p-4 sm:p-6 lg:p-8 text-slate-700 dark:text-slate-300 space-y-6 text-sm sm:text-base leading-relaxed">
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
        </div>
      </div>
    </div>
  );
};

export default ContactUsPage;
