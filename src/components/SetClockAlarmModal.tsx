import React, { useState } from 'react';
import { X, Clock, AlertCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { requestClockAlarmPermission, setClockAlarm, openDeviceClockForAlarm } from '@/lib/clock-app-permission';
import toast from 'react-hot-toast';

interface SetClockAlarmModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SetClockAlarmModal: React.FC<SetClockAlarmModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [selectedTime, setSelectedTime] = useState('07:00');
  const [isRequesting, setIsRequesting] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);

  if (!isOpen) return null;

  /**
   * Request permission first, then set alarm
   */
  const handleRequestPermissionAndSetAlarm = async () => {
    try {
      setIsRequesting(true);
      console.log('🔔 Starting permission + alarm flow...');

      // Step 1: Request permission
      console.log('📋 Step 1: Requesting clock app permission...');
      const permissionResult = await requestClockAlarmPermission();

      if (!permissionResult.hasPermission) {
        console.log('❌ Permission denied - stopping alarm setup');
        toast.error('Permission denied - cannot set device alarm');
        setIsRequesting(false);
        return;
      }

      console.log('✅ Step 1: Permission granted!');
      setHasPermission(true);

      // Step 2: Set the alarm
      console.log('⏰ Step 2: Setting device clock alarm...');
      const [hours, minutes] = selectedTime.split(':').map(Number);

      const result = await setClockAlarm(hours, minutes, 'Device Alarm');

      if (result.success) {
        console.log('✅ Step 2: Alarm set successfully!');
        console.log(`📍 Alarm set via: ${result.method}`);

        // Show success message with method used
        const methodLabel = {
          intent: '📲 Via Clock App Intent',
          alarmmanager: '⚙️ Via AlarmManager',
          cordova: '🔌 Via Cordova Plugin',
          simulated: '🧪 Simulated (Web)',
        }[result.method || 'unknown'] || '✓ Via system';

        toast.success(`${methodLabel}\n${result.message}`, {
          duration: 4000,
        });

        // Close modal
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        console.error('❌ Step 2: Failed to set alarm', result.message);
        toast.error(`Failed: ${result.message}`);
      }
    } catch (error) {
      console.error('❌ Unexpected error:', error);
      toast.error('Unexpected error - please try again');
    } finally {
      setIsRequesting(false);
    }
  };

  /**
   * Open device's native Clock app directly
   */
  const handleOpenDeviceClock = async () => {
    try {
      setIsRequesting(true);
      console.log('📱 Opening device Clock app...');

      const [hours, minutes] = selectedTime.split(':').map(Number);
      const result = await openDeviceClockForAlarm(hours, minutes, 'Device Alarm');

      if (result.success) {
        console.log('✅ Clock app opened successfully');
        // Close modal after a short delay
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        console.error('❌ Failed to open Clock app', result.message);
        toast.error(`Failed: ${result.message}`);
      }
    } catch (error) {
      console.error('❌ Unexpected error:', error);
      toast.error('Unexpected error - please try again');
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg max-w-md w-full mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Set Device Alarm</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-900 dark:text-blue-200">
              <p className="font-medium">📱 Device Alarm</p>
              <p className="text-xs mt-2">
                Creates an alarm that rings at a specific time. Works best on devices with standard power management. If alarms aren't ringing reliably, try using <strong>Timer</strong> instead (more reliable across all devices).
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* Time Input */}
          <div>
            <label className="block text-sm font-medium mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Select Alarm Time
            </label>
            <div className="flex gap-2">
              <input
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-medium"
                disabled={isRequesting}
              />
              <div className="text-sm font-medium text-muted-foreground flex items-center px-3 py-2 bg-gray-50 dark:bg-slate-800 rounded-lg">
                {selectedTime}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              ℹ️ The alarm will be set for the selected time
            </p>
          </div>
        </div>

        {/* Flow Description */}
        <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <p className="text-xs text-amber-900 dark:text-amber-200 font-medium mb-2">
            📋 What happens next:
          </p>
          <ol className="text-xs text-amber-800 dark:text-amber-300 space-y-1">
            <li>1️⃣ Permission dialog appears (like location permission)</li>
            <li>2️⃣ Grant "Clock App" permission</li>
            <li>3️⃣ Alarm is created in your device's Clock app</li>
            <li>4️⃣ Alarm will trigger at the scheduled time</li>
          </ol>
        </div>

        {/* Comparison Info */}
        <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
          <details className="text-xs text-purple-900 dark:text-purple-200">
            <summary className="cursor-pointer font-medium">📊 Alarm vs Timer</summary>
            <div className="mt-3 space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white dark:bg-slate-800 p-2 rounded">
                  <p className="font-semibold text-blue-600 dark:text-blue-400">Alarm</p>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">✓ Set for specific time</p>
                  <p className="text-gray-600 dark:text-gray-400">✗ May not work on some devices</p>
                  <p className="text-gray-600 dark:text-gray-400">✓ Battery optimized</p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-2 rounded">
                  <p className="font-semibold text-red-600 dark:text-red-400">Timer</p>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">✓ Set countdown duration</p>
                  <p className="text-gray-600 dark:text-gray-400">✓ Works on all devices</p>
                  <p className="text-gray-600 dark:text-gray-400">✓ More reliable</p>
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                💡 <strong>Tip:</strong> If your device has aggressive power management (Samsung, OnePlus, OPPO), use Timer instead.
              </p>
            </div>
          </details>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-6">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1"
            disabled={isRequesting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleOpenDeviceClock}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white"
            disabled={isRequesting}
            title="Opens your device's Clock app so you can set the alarm yourself"
          >
            {isRequesting ? '⏳ Opening...' : '📱 Open Clock App'}
          </Button>
          <Button
            onClick={handleRequestPermissionAndSetAlarm}
            className="flex-1 bg-primary hover:bg-primary/90"
            disabled={isRequesting}
          >
            {isRequesting ? '⏳ Setting Alarm...' : '⏰ Set Alarm'}
          </Button>
        </div>

        {/* Footer Info */}
        <p className="text-xs text-muted-foreground mt-4 text-center">
          ✅ Permission dialog will appear automatically on next step
        </p>
      </div>
    </div>
  );
};
