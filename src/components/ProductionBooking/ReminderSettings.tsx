import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Clock, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { startForegroundAlarmService } from '@/lib/alarm-scheduler';
import { supabase } from '@/lib/supabase';
import { formatIST } from '@/lib/utils';
import { sendNativeNotification } from '@/lib/native-notifications';

interface ReminderSettingsProps {
  bookingId: string;
  bookingDate: string;
  bookingTime: string;
  serviceName: string;
  shopName: string;
  shopId: string;
  customerName: string;
  customerPhone: string;
  tokenNumber?: number;
  onRemindersSaved: () => void;
}

export const ReminderSettings: React.FC<ReminderSettingsProps> = ({
  bookingId, bookingDate, bookingTime, serviceName, shopName, shopId, customerName, customerPhone, tokenNumber = 0, onRemindersSaved
}) => {
  const { user } = useAuth();
  const [selectedReminders, setSelectedReminders] = useState<string[]>(['15']);
  const [step, setStep] = useState<'select' | 'confirming' | 'confirmed'>('select');

  const handleToggleReminder = (val: string) => {
    setSelectedReminders(prev => prev.includes(val) ? prev.filter(r => r !== val) : [...prev, val]);
  };

  const handleConfirmReminders = async () => {
    if (!user || selectedReminders.length === 0) return;
    setStep('confirming');
    try {
      const earliestMin = Math.min(...selectedReminders.map(r => parseInt(r)));
      const primaryReminderTime = calculateReminderTime(bookingDate, bookingTime, earliestMin);

      // Schedule reminders (this should ideally be handled by a backend cron/trigger, 
      // but for now we update the booking and let the native alarm handle it)
      await supabase.from('bookings').update({
        reminder_time: primaryReminderTime,
        foreground_service_status: 'running'
      }).eq('id', bookingId);

      // Start native foreground alarm
      const [y, m, d] = bookingDate.split('-').map(Number);
      const [h, min] = bookingTime.split(':').map(Number);
      const triggerTimeMs = new Date(y, m - 1, d, h, min).getTime();

      await startForegroundAlarmService({
        bookingId, tokenNumber, shopName, timeSlot: bookingTime, triggerTimeMs
      });

      setStep('confirmed');
      setTimeout(onRemindersSaved, 1500);
    } catch (err) {
      setStep('select');
    }
  };

  if (step === 'confirmed') {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-green-50 h-full">
        <CheckCircle className="w-16 h-16 text-green-600 mb-4 animate-bounce" />
        <h3 className="text-2xl font-bold mb-2">All Set!</h3>
        <p className="text-gray-600">Reminders set for {serviceName} at {bookingTime}</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-6">Set Reminders</h2>
      <div className="space-y-3 mb-8">
        {['15', '30', '60'].map(val => (
          <label key={val} className={`flex items-center p-4 rounded-lg border-2 cursor-pointer ${selectedReminders.includes(val) ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
            <input type="checkbox" checked={selectedReminders.includes(val)} onChange={() => handleToggleReminder(val)} className="w-4 h-4" />
            <Clock className="w-5 h-5 ml-3 text-gray-600" />
            <span className="ml-3 font-medium">{val} minutes before</span>
          </label>
        ))}
      </div>
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onRemindersSaved}>Skip</Button>
        <Button className="flex-1" onClick={handleConfirmReminders} disabled={selectedReminders.length === 0}>
          {step === 'confirming' ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
};

function calculateReminderTime(d: string, t: string, mins: number): string {
  const [year, month, day] = d.split('-').map(Number);
  const [hour, minute] = t.split(':').map(Number);
  const date = new Date(year, month - 1, day, hour, minute);
  const rem = new Date(date.getTime() - mins * 60 * 1000);
  return `${rem.getHours().toString().padStart(2, '0')}:${rem.getMinutes().toString().padStart(2, '0')}`;
}
