import { useEffect } from 'react';
import { AlertCircle, Phone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface ReminderAlertDialogProps {
  isOpen: boolean;
  shopName: string;
  serviceName: string;
  bookingId: string;
  onConfirm: (bookingId: string) => void;
  onCancel: (bookingId: string) => void;
}

export const ReminderAlertDialog = ({
  isOpen,
  shopName,
  serviceName,
  bookingId,
  onConfirm,
  onCancel,
}: ReminderAlertDialogProps) => {

  useEffect(() => {
    if (isOpen) {
      // Auto-play notification sound if available
      playNotificationSound();
    }
  }, [isOpen]);

  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Create a bell-like sound
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);

      // Second tone
      setTimeout(() => {
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();

        osc2.connect(gain2);
        gain2.connect(audioContext.destination);

        osc2.frequency.value = 1000;
        osc2.type = 'sine';

        gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        osc2.start(audioContext.currentTime);
        osc2.stop(audioContext.currentTime + 0.5);
      }, 200);
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  };

  const handleConfirm = () => {
    onConfirm(bookingId);
  };

  const handleCancel = () => {
    onCancel(bookingId);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <Card className="w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 space-y-2">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-8 w-8 animate-pulse" />
            <h2 className="text-2xl font-bold">Appointment Reminder</h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Reminder Message */}
          <div className="space-y-3">
            <p className="text-lg font-semibold text-gray-900">
              🔔 Your appointment is coming up!
            </p>
            <div className="space-y-2 text-gray-700">
              <p>
                <span className="font-semibold">Service:</span> {serviceName}
              </p>
              <p>
                <span className="font-semibold">Location:</span> {shopName}
              </p>
            </div>
          </div>

          {/* Confirmation Question */}
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
            <p className="text-blue-900 font-medium">
              Are you coming to your appointment?
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-gray-50 p-4 flex gap-3">
          <Button
            onClick={handleCancel}
            variant="outline"
            className="flex-1 gap-2 h-12"
          >
            <X className="h-4 w-4" />
            Not Coming
          </Button>
          <Button
            onClick={handleConfirm}
            className="flex-1 bg-green-600 hover:bg-green-700 gap-2 h-12 text-white"
          >
            <Phone className="h-4 w-4" />
            Yes, I'm Coming
          </Button>
        </div>
      </Card>
    </div>
  );
};
