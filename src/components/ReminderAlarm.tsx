import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { LocalReminder } from '@/lib/local-reminders';

interface ReminderAlarmProps {
  reminder: LocalReminder | null;
  onYes: (reminder: LocalReminder) => void;
  onNo: (reminder: LocalReminder) => void;
}

export const ReminderAlarm = ({ reminder, onYes, onNo }: ReminderAlarmProps) => {
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const alarmIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize audio and play alarm sound when reminder is triggered
  useEffect(() => {
    if (reminder) {
      initializeAudioAndPlay();
    }
  }, [reminder]);

  // Stop sound and cleanup when reminder is dismissed or component unmounts
  useEffect(() => {
    return () => {
      stopAlarm();
    };
  }, []);

  const initializeAudioAndPlay = () => {
    try {
      // Create audio context if it doesn't exist
      if (!audioContextRef.current) {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContext();
      }

      const audioContext = audioContextRef.current;

      // Resume audio context if it's suspended (required for user interaction)
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      playAlarmCycle(audioContext);
    } catch (error) {
      console.error('Error initializing audio:', error);
    }
  };

  const playAlarmCycle = (audioContext: AudioContext) => {
    // Stop any existing alarm
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
    }

    // Play alarm cycles continuously
    const playAlarmTone = () => {
      try {
        // Create oscillator for alarm sound
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Set up alarm tone: alternating frequencies for more noticeable sound
        const currentTime = audioContext.currentTime;
        const toneDuration = 0.5; // 500ms tone

        // First frequency (high pitch)
        oscillator.frequency.value = 1000;
        gainNode.gain.setValueAtTime(0.4, currentTime); // 40% volume for safety

        oscillator.start(currentTime);
        oscillator.stop(currentTime + toneDuration);

        // Play second tone with different frequency
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();
        osc2.connect(gain2);
        gain2.connect(audioContext.destination);

        osc2.frequency.value = 800;
        gain2.gain.setValueAtTime(0.4, currentTime + toneDuration);
        osc2.start(currentTime + toneDuration);
        osc2.stop(currentTime + toneDuration * 2);

      } catch (error) {
        console.error('Error playing alarm tone:', error);
      }
    };

    // Play initial tone
    playAlarmTone();

    // Repeat alarm every 1 second continuously
    alarmIntervalRef.current = setInterval(() => {
      playAlarmTone();
    }, 1000);
  };

  const stopAlarm = () => {
    // Clear the interval
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }

    // Stop oscillator if it's running
    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop();
      } catch {
        // Oscillator may already be stopped
      }
      oscillatorRef.current = null;
    }

    // Close audio context if needed
    if (audioContextRef.current && audioContextRef.current.state === 'running') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setTouchEnd(e.changedTouches[0].clientX);
    handleSwipe();
  };

  const handleSwipe = () => {
    if (!reminder) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50; // Swipe left
    const isRightSwipe = distance < -50; // Swipe right

    if (isLeftSwipe) {
      // Swipe left = NO
      handleNo();
    } else if (isRightSwipe) {
      // Swipe right = YES
      handleYes();
    }
  };

  const handleYes = () => {
    stopAlarm();
    if (reminder) {
      onYes(reminder);
    }
  };

  const handleNo = () => {
    stopAlarm();
    if (reminder) {
      onNo(reminder);
    }
  };

  if (!reminder) return null;

  return (
    <div
      className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >

      <div className="w-full h-full flex flex-col items-center justify-center p-6 space-y-8">
        {/* Alarm Icon */}
        <div className="relative w-32 h-32 animate-pulse">
          <div className="absolute inset-0 bg-red-500/20 rounded-full animate-ping" />
          <div className="absolute inset-0 flex items-center justify-center bg-red-500 rounded-full shadow-2xl">
            <div className="text-5xl animate-bounce">🔔</div>
          </div>
        </div>

        {/* Reminder Text */}
        <div className="text-center space-y-4 max-w-md">
          <h1 className="text-3xl font-bold text-white">
            Appointment Reminder!
          </h1>
          <p className="text-xl text-gray-200">
            Did you really want to go to the shop?
          </p>
        </div>

        {/* Booking Details */}
        <div className="bg-white/10 backdrop-blur border border-white/20 rounded-lg p-6 max-w-md w-full space-y-3 text-white">
          <div className="flex justify-between items-center">
            <span className="text-gray-300">Shop:</span>
            <span className="font-semibold text-lg">{reminder.shopName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-300">Time:</span>
            <span className="font-semibold text-lg">{reminder.timeSlot}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-300">Token:</span>
            <span className="font-semibold text-lg">#{reminder.tokenNumber}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-300">Name:</span>
            <span className="font-semibold text-lg">{reminder.userName}</span>
          </div>
        </div>

        {/* Swipe Instructions */}
        <div className="text-center space-y-4 max-w-md">
          <p className="text-gray-300 text-sm">
            Swipe left or right to answer
          </p>
          <div className="flex gap-4 justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-1 text-red-400 animate-bounce">
                <span className="text-2xl">←</span>
              </div>
              <span className="text-sm text-gray-400">No</span>
            </div>
            <div className="w-px bg-gray-600" />
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-1 text-green-400 animate-bounce">
                <span className="text-2xl">→</span>
              </div>
              <span className="text-sm text-gray-400">Yes</span>
            </div>
          </div>
        </div>

        {/* Buttons (for non-touch devices or accessibility) */}
        <div className="flex gap-4 pt-4 w-full max-w-md">
          <Button
            onClick={handleNo}
            variant="destructive"
            size="lg"
            className="flex-1 h-16 text-lg font-semibold gap-2"
          >
            <XCircle className="w-6 h-6" />
            No
          </Button>
          <Button
            onClick={handleYes}
            size="lg"
            className="flex-1 h-16 text-lg font-semibold gap-2 bg-green-600 hover:bg-green-700"
          >
            <CheckCircle2 className="w-6 h-6" />
            Yes
          </Button>
        </div>

        {/* Additional Info */}
        <p className="text-xs text-gray-500 text-center max-w-md">
          Your response will be sent to the shop owner immediately
        </p>
      </div>
    </div>
  );
};
