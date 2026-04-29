import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Bell, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { scheduleAlarm, startForegroundAlarmService, stopForegroundAlarmService } from '@/lib/alarm-scheduler';
import toast from 'react-hot-toast';

interface TestAlarmModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TestAlarmModal: React.FC<TestAlarmModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [selectedTime, setSelectedTime] = useState('12:00');
  const [alarmTitle, setAlarmTitle] = useState('Test Alarm');
  const [alarmMessage, setAlarmMessage] = useState('This is a test alarm notification');
  const [isScheduling, setIsScheduling] = useState(false);

  if (!isOpen) return null;

  const handleScheduleTestAlarm = async () => {
    try {
      setIsScheduling(true);
      console.log('⏰ Scheduling test alarm:', {
        selectedTime,
        alarmTitle,
        alarmMessage,
      });

      // Convert time string (HH:MM) to proper format
      const now = new Date();
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const alarmDate = new Date();
      alarmDate.setHours(hours, minutes, 0, 0);

      // If time is in the past, set for tomorrow
      if (alarmDate < now) {
        alarmDate.setDate(alarmDate.getDate() + 1);
      }

      // Format date as YYYY-MM-DD
      const year = alarmDate.getFullYear();
      const month = String(alarmDate.getMonth() + 1).padStart(2, '0');
      const date = String(alarmDate.getDate()).padStart(2, '0');
      const bookingDate = `${year}-${month}-${date}`;

      // Format time as HH:MM
      const reminderTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

      console.log('⏰ Alarm scheduled for:', alarmDate.toLocaleString());
      console.log('⏰ Date format:', bookingDate);
      console.log('⏰ Time format:', reminderTime);

      // Schedule the alarm with proper parameters
      await scheduleAlarm({
        bookingId: `test-alarm-${Date.now()}`,
        reminderTime: reminderTime,
        bookingDate: bookingDate,
        tokenNumber: 0,
        shopName: 'Test Shop',
        userName: 'Test User',
        timeSlot: selectedTime,
        shopId: 'test-shop',
      });

      toast.success(
        `Test alarm scheduled for ${alarmDate.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}`
      );
      onClose();
    } catch (error) {
      console.error('❌ Error scheduling test alarm:', error);
      toast.error('Failed to schedule alarm');
    } finally {
      setIsScheduling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg max-w-md w-full mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Test Alarm</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 min-h-0">
          <div className="space-y-4">
            {/* Info */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-900 dark:text-blue-200 font-medium">
                ℹ️ Permission Dialog
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                When you click "Schedule Alarm", the system will ask for permissions (just like location permission).
                You'll see a permission dialog to grant calendar & alarm access.
              </p>
            </div>

            {/* Form */}
            <div className="space-y-4">
              {/* Title Input */}
              <div>
                <label className="block text-sm font-medium mb-2">Alarm Title</label>
                <input
                  type="text"
                  value={alarmTitle}
                  onChange={(e) => setAlarmTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  placeholder="Enter alarm title"
                  disabled={isScheduling}
                />
              </div>

              {/* Message Input */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Alarm Message
                </label>
                <textarea
                  value={alarmMessage}
                  onChange={(e) => setAlarmMessage(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm resize-none"
                  rows={3}
                  placeholder="Enter alarm message"
                  disabled={isScheduling}
                />
              </div>

              {/* Time Input */}
              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Select Time
                </label>
                <div className="flex gap-2">
                  <input
                    type="time"
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    disabled={isScheduling}
                  />
                  <div className="text-sm text-muted-foreground flex items-center px-2">
                    {selectedTime}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  If time is in the past, alarm will be set for tomorrow.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <Button
                onClick={onClose}
                variant="outline"
                className="flex-1"
                disabled={isScheduling}
              >
                Cancel
              </Button>
              <Button
                onClick={handleScheduleTestAlarm}
                className="flex-1 bg-primary hover:bg-primary/90"
                disabled={isScheduling}
              >
                {isScheduling ? '⏰ Scheduling...' : '⏰ Schedule Alarm'}
              </Button>
            </div>

            {/* Info */}
            <div className="text-xs text-muted-foreground mt-4 space-y-2">
              <p className="text-center">
                📱 System permission dialogs will appear automatically (like location permission)
              </p>
              <p className="text-center">
                ✅ Grant calendar & alarm permissions, then your alarm appears in Clock app
              </p>
              <p className="text-center">
                🔔 The alarm will trigger at the scheduled time
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
