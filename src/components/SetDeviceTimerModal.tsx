import React, { useState } from 'react';
import { X, Clock, AlertCircle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { setDeviceTimer } from '@/lib/device-timer';
import toast from 'react-hot-toast';

interface SetDeviceTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SetDeviceTimerModal: React.FC<SetDeviceTimerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [selectedMinutes, setSelectedMinutes] = useState(1);
  const [customMinutes, setCustomMinutes] = useState('');
  const [isRequesting, setIsRequesting] = useState(false);
  const [useCustom, setUseCustom] = useState(false);

  if (!isOpen) return null;

  const presetOptions = [1, 2, 3, 5, 10, 15, 20, 30];

  const handleSetTimer = async () => {
    try {
      setIsRequesting(true);
      console.log('⏱️ Starting timer flow...');

      const minutes = useCustom
        ? parseInt(customMinutes) || 1
        : selectedMinutes;

      if (minutes < 1 || minutes > 1440) {
        toast.error('Please enter a time between 1 and 1440 minutes');
        return;
      }

      const result = await setDeviceTimer(minutes, `Device Timer - ${minutes}m`);

      if (result.success) {
        console.log('✅ Timer set successfully!');
        console.log(`📍 Timer set via: ${result.method}`);

        // Close modal after short delay
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        console.error('❌ Timer setup failed', result.message);
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
            <Zap className="h-5 w-5 text-yellow-500" />
            <h2 className="text-xl font-bold">Set Device Timer</h2>
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
              <p className="font-medium">⏱️ Device Timer</p>
              <p className="text-xs mt-2">
                Device will ring after the timer expires. Works reliably on all Android devices with system timer integration.
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* Quick Presets */}
          <div>
            <label className="block text-sm font-medium mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Quick Select
            </label>
            <div className="grid grid-cols-4 gap-2">
              {presetOptions.map((minutes) => (
                <button
                  key={minutes}
                  onClick={() => {
                    setSelectedMinutes(minutes);
                    setUseCustom(false);
                  }}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    !useCustom && selectedMinutes === minutes
                      ? 'bg-yellow-500 text-white'
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {minutes}m
                </button>
              ))}
            </div>
          </div>

          {/* Custom Input */}
          <div>
            <label className="block text-sm font-medium mb-2">Custom Duration</label>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                max="1440"
                value={customMinutes}
                onChange={(e) => {
                  setCustomMinutes(e.target.value);
                  if (e.target.value) setUseCustom(true);
                }}
                placeholder="Enter minutes (1-1440)"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-medium"
                disabled={isRequesting}
              />
              <span className="px-3 py-2 bg-gray-50 dark:bg-slate-800 rounded-lg text-sm text-gray-600 dark:text-gray-400">
                min
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              ℹ️ Maximum 1440 minutes (24 hours)
            </p>
          </div>

          {/* Display Selected Time */}
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
              ⏰ Timer Duration:
            </p>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-2">
              {useCustom && customMinutes ? customMinutes : selectedMinutes} minute{(useCustom && customMinutes ? parseInt(customMinutes) : selectedMinutes) !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Flow Description */}
        <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <p className="text-xs text-amber-900 dark:text-amber-200 font-medium mb-2">
            📋 What happens next:
          </p>
          <ol className="text-xs text-amber-800 dark:text-amber-300 space-y-1">
            <li>1️⃣ Timer starts counting down</li>
            <li>2️⃣ Device will ring when timer expires</li>
            <li>3️⃣ Works even if app is closed</li>
            <li>4️⃣ You can set multiple timers</li>
          </ol>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1"
            disabled={isRequesting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSetTimer}
            className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white"
            disabled={isRequesting}
          >
            {isRequesting ? '⏳ Starting Timer...' : '▶️ Start Timer'}
          </Button>
        </div>

        {/* Footer Info */}
        <p className="text-xs text-muted-foreground mt-4 text-center">
          ⚡ Device timer runs in background
        </p>
      </div>
    </div>
  );
};
