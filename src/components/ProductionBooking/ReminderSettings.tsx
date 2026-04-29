import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Clock, CheckCircle } from 'lucide-react';
import { sendScheduledReminderNotification } from '@/lib/onesignal-messaging';
import { useAuth } from '@/contexts/AuthContext';
import { startForegroundAlarmService } from '@/lib/alarm-scheduler';
import { supabase } from '@/lib/supabase';

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
  bookingId,
  bookingDate,
  bookingTime,
  serviceName,
  shopName,
  shopId,
  customerName,
  customerPhone,
  tokenNumber = 0,
  onRemindersSaved,
}) => {
  const { user } = useAuth();
  const [selectedReminders, setSelectedReminders] = useState<string[]>(['15']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<'select' | 'confirming' | 'confirmed'>('select');

  const reminderOptions = [
    { value: '15', label: '15 minutes before' },
    { value: '30', label: '30 minutes before' },
    { value: '60', label: '1 hour before' },
    { value: '1440', label: '1 day before' },
  ];

  const [customMinutes, setCustomMinutes] = useState<string>('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const handleToggleReminder = (value: string) => {
    if (selectedReminders.includes(value)) {
      setSelectedReminders(selectedReminders.filter((r) => r !== value));
    } else {
      setSelectedReminders([...selectedReminders, value]);
    }
  };

  const handleAddCustomReminder = () => {
    if (!customMinutes || isNaN(parseInt(customMinutes)) || parseInt(customMinutes) <= 0) {
      return;
    }

    const minuteValue = customMinutes.toString();
    if (!selectedReminders.includes(minuteValue)) {
      setSelectedReminders([...selectedReminders, minuteValue]);
    }
    setCustomMinutes('');
    setShowCustomInput(false);
  };

  const handleSkip = async () => {
    try {
      // Even if skipping reminders, start foreground service for confirmation
      const [year, month, day] = bookingDate.split('-').map(Number);
      const [hour, minute] = bookingTime.split(':').map(Number);
      const bookingDateTime = new Date(year, month - 1, day, hour, minute, 0);
      const triggerTimeMs = bookingDateTime.getTime();

      console.log(`⏰ Starting foreground service for booking ${bookingId} (no reminders)`);

      const foregroundResult = await startForegroundAlarmService({
        bookingId,
        tokenNumber,
        shopName,
        timeSlot: bookingTime,
        triggerTimeMs,
      });

      if (foregroundResult.success) {
        console.log(`✅ Foreground service started for booking ${bookingId}`);
      }

      // Update booking to indicate foreground service is running
      await supabase
        .from('bookings')
        .update({ foreground_service_status: 'running' })
        .eq('id', bookingId);
    } catch (err) {
      console.error('Error starting foreground service on skip:', err);
    }

    setStep('confirmed');
    setTimeout(() => {
      onRemindersSaved();
    }, 1000);
  };

  const handleConfirmReminders = async () => {
    if (selectedReminders.length === 0) {
      return;
    }

    if (!user) {
      console.error('User not authenticated');
      return;
    }

    setStep('confirming');
    setIsSubmitting(true);

    try {
      // Use the first (earliest) reminder time as the primary reminder for foreground service
      const earliestMinutesBefore = Math.min(...selectedReminders.map(r => parseInt(r)));
      const primaryReminderTime = calculateReminderTime(bookingDate, bookingTime, earliestMinutesBefore);

      // Schedule each reminder
      for (const minutesBefore of selectedReminders) {
        const reminderTime = calculateReminderTime(bookingDate, bookingTime, parseInt(minutesBefore));

        await sendScheduledReminderNotification(
          user.uid,
          {
            bookingId,
            shopId,
            shopName,
            tokenNumber,
            userName: customerName,
            timeSlot: bookingTime,
            bookingDate,
            reminderTime,
          }
        );
      }

      // Update booking with reminder time
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          reminder_time: primaryReminderTime,
          foreground_service_status: 'running',
        })
        .eq('id', bookingId);

      if (updateError) {
        console.error('Error updating booking reminder time:', updateError);
      } else {
        console.log(`✅ Booking ${bookingId} updated with reminder time: ${primaryReminderTime}`);
      }

      // Start foreground service for the booking
      // Calculate trigger time: booking date + booking time
      const [year, month, day] = bookingDate.split('-').map(Number);
      const [hour, minute] = bookingTime.split(':').map(Number);
      const bookingDateTime = new Date(year, month - 1, day, hour, minute, 0);
      const triggerTimeMs = bookingDateTime.getTime();

      console.log(`⏰ Starting foreground service for booking ${bookingId}`);
      console.log(`   Trigger time: ${new Date(triggerTimeMs).toLocaleString()}`);
      console.log(`   Reminder time: ${primaryReminderTime}`);
      console.log(`   Token: #${tokenNumber}`);

      const foregroundResult = await startForegroundAlarmService({
        bookingId,
        tokenNumber,
        shopName,
        timeSlot: bookingTime,
        triggerTimeMs,
      });

      if (foregroundResult.success) {
        console.log(`✅ Foreground service started successfully for booking ${bookingId}`);
      } else {
        console.warn(`⚠️ Foreground service start had issues: ${foregroundResult.message}`);
      }

      setStep('confirmed');
      setTimeout(() => {
        onRemindersSaved();
      }, 1500);
    } catch (err) {
      console.error('Error saving reminders:', err);
      setIsSubmitting(false);
      setStep('select');
    }
  };

  if (step === 'confirmed') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-b from-green-50 to-white">
        <div className="text-center max-w-md">
          <div className="mb-4">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto animate-bounce" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">All Set!</h3>
          <p className="text-gray-600 mb-4">
            Your booking is confirmed for {serviceName} at {bookingTime}
          </p>
          <p className="text-sm text-gray-500">
            You'll receive reminders at the times you selected.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Set Booking Reminders</h2>
        <p className="text-gray-600">
          When would you like to be reminded about your booking?
        </p>
      </div>

      {/* Booking Summary */}
      <div className="bg-blue-50 rounded-lg p-4 mb-8 border border-blue-200">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-700">Service:</span>
            <span className="font-semibold text-gray-900">{serviceName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-700">Shop:</span>
            <span className="font-semibold text-gray-900">{shopName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-700">Date & Time:</span>
            <span className="font-semibold text-gray-900">
              {formatDate(bookingDate)} at {bookingTime}
            </span>
          </div>
        </div>
      </div>

      {/* Reminder Options */}
      <div className="mb-8">
        <Label className="text-base font-semibold mb-4 block">Select reminders:</Label>
        <div className="space-y-3">
          {reminderOptions.map((option) => (
            <label
              key={option.value}
              className="flex items-center p-4 rounded-lg border-2 cursor-pointer transition-all"
              style={{
                borderColor: selectedReminders.includes(option.value) ? '#3b82f6' : '#e5e7eb',
                backgroundColor: selectedReminders.includes(option.value) ? '#eff6ff' : '#fafafa',
              }}
            >
              <input
                type="checkbox"
                checked={selectedReminders.includes(option.value)}
                onChange={() => handleToggleReminder(option.value)}
                className="w-4 h-4 cursor-pointer"
              />
              <Clock className="w-5 h-5 ml-3 text-gray-600" />
              <span className="ml-3 font-medium text-gray-900">{option.label}</span>
            </label>
          ))}

          {/* Custom Reminder Time */}
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
            <button
              onClick={() => setShowCustomInput(!showCustomInput)}
              className="text-blue-600 hover:text-blue-700 font-semibold text-sm flex items-center gap-2 mb-2"
            >
              <span>+ Add Custom Time</span>
            </button>

            {showCustomInput && (
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Minutes before appointment
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(e.target.value)}
                    placeholder="e.g., 20, 45, 120"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <button
                  onClick={handleAddCustomReminder}
                  disabled={!customMinutes || isNaN(parseInt(customMinutes)) || parseInt(customMinutes) <= 0}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Add
                </button>
              </div>
            )}

            {/* Show selected custom reminders */}
            {selectedReminders.filter((r) => !reminderOptions.map((o) => o.value).includes(r)).length > 0 && (
              <div className="mt-3 pt-3 border-t border-blue-200 space-y-2">
                {selectedReminders
                  .filter((r) => !reminderOptions.map((o) => o.value).includes(r))
                  .map((customReminder) => (
                    <div
                      key={customReminder}
                      className="flex items-center justify-between bg-white p-2 rounded border border-blue-300"
                    >
                      <span className="text-sm font-medium text-gray-700">
                        {customReminder} minutes before
                      </span>
                      <button
                        onClick={() =>
                          setSelectedReminders(selectedReminders.filter((r) => r !== customReminder))
                        }
                        className="text-red-500 hover:text-red-700 text-sm font-semibold"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* No Reminder Option */}
      <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-600 mb-3">Don't want reminders?</p>
        <button
          onClick={handleSkip}
          className="text-blue-600 hover:text-blue-700 font-medium text-sm underline"
        >
          Skip reminders for now
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleSkip}
          disabled={step === 'confirming'}
          className="flex-1 py-3 rounded-lg font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all disabled:opacity-50"
        >
          Skip
        </button>
        <button
          onClick={handleConfirmReminders}
          disabled={selectedReminders.length === 0 || step === 'confirming'}
          className="flex-1 py-3 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 transition-all disabled:opacity-50"
        >
          {step === 'confirming' ? 'Setting up...' : 'Save Reminders'}
        </button>
      </div>

      {selectedReminders.length === 0 && step === 'select' && (
        <p className="mt-3 text-xs text-gray-500 text-center">
          Please select at least one reminder time or skip
        </p>
      )}
    </div>
  );
};

// Helper functions
function calculateReminderTime(bookingDate: string, bookingTime: string, minutesBefore: number): string {
  const [year, month, day] = bookingDate.split('-').map(Number);
  const [hour, minute] = bookingTime.split(':').map(Number);

  const bookingDateTime = new Date(year, month - 1, day, hour, minute, 0);
  const reminderDateTime = new Date(bookingDateTime.getTime() - minutesBefore * 60 * 1000);

  const reminderHour = reminderDateTime.getHours().toString().padStart(2, '0');
  const reminderMinute = reminderDateTime.getMinutes().toString().padStart(2, '0');

  return `${reminderHour}:${reminderMinute}`;
}

function getTimezoneOffset(): number {
  return -new Date().getTimezoneOffset() / 60;
}

function formatDate(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
