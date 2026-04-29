import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import type { LocalReminder } from '@/lib/local-reminders';

interface ReminderToastProps {
  reminder: LocalReminder | null;
  onYes: (reminder: LocalReminder) => void;
  onNo: (reminder: LocalReminder) => void;
}

export const ReminderToast = ({ reminder, onYes, onNo }: ReminderToastProps) => {
  const [timeLeft, setTimeLeft] = useState(30);
  const [sliderPos, setSliderPos] = useState(50); // 0 = no, 50 = neutral, 100 = yes
  const [answered, setAnswered] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const alarmIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  // Initialize audio and play alarm sound when reminder appears
  useEffect(() => {
    if (reminder) {
      initializeAndPlayAlarm();
    }
    return () => {
      stopAlarm();
    };
  }, [reminder]);

  // Timer for auto-dismiss after 30 seconds
  useEffect(() => {
    if (!reminder || answered) return;

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, 30 - elapsed);
      setTimeLeft(remaining);

      // Auto-dismiss when timer reaches 0
      if (remaining === 0) {
        clearInterval(interval);
        stopAlarm();
        setAnswered(true);
        onNo(reminder);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [reminder, onNo, answered]);

  const initializeAndPlayAlarm = () => {
    try {
      // Create or resume audio context
      if (!audioContextRef.current) {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContext();
      }

      const audioContext = audioContextRef.current;

      // Resume audio context if suspended (required for mobile)
      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(err => console.warn('Could not resume audio context:', err));
      }

      startAlarmSound(audioContext);
    } catch (error) {
      console.error('Error initializing alarm sound:', error);
    }
  };

  const startAlarmSound = (audioContext: AudioContext) => {
    // Stop any existing alarm
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
    }

    // Play initial tone
    playAlarmTone(audioContext);

    // Repeat alarm tone every 1.5 seconds continuously
    alarmIntervalRef.current = setInterval(() => {
      if (reminder) {
        playAlarmTone(audioContext);
      }
    }, 1500);
  };

  const playAlarmTone = (audioContext: AudioContext) => {
    try {
      const now = audioContext.currentTime;
      const toneDuration = 0.3; // 300ms per tone
      const gapDuration = 0.2; // 200ms gap between tones

      // Tone 1: High frequency
      const osc1 = audioContext.createOscillator();
      const gain1 = audioContext.createGain();
      osc1.connect(gain1);
      gain1.connect(audioContext.destination);

      osc1.frequency.value = 1200; // High pitch alarm
      gain1.gain.setValueAtTime(0.3, now); // 30% volume for safety
      osc1.start(now);
      osc1.stop(now + toneDuration);

      // Tone 2: Lower frequency (after gap)
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);

      osc2.frequency.value = 900; // Medium pitch
      gain2.gain.setValueAtTime(0.3, now + toneDuration + gapDuration);
      osc2.start(now + toneDuration + gapDuration);
      osc2.stop(now + toneDuration * 2 + gapDuration);
    } catch (error) {
      console.error('Error playing alarm tone:', error);
    }
  };

  const stopAlarm = () => {
    // Clear the alarm interval
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state === 'running') {
      try {
        audioContextRef.current.close();
      } catch {
        // Ignore errors when closing
      }
      audioContextRef.current = null;
    }
  };

  const handleSliderStart = () => {
    isDraggingRef.current = true;
  };

  const handleSliderEnd = () => {
    isDraggingRef.current = false;
    
    // Check if user dragged to yes or no
    if (sliderPos <= 25) {
      // User dragged to NO
      stopAlarm();
      setAnswered(true);
      onNo(reminder!);
    } else if (sliderPos >= 75) {
      // User dragged to YES
      stopAlarm();
      setAnswered(true);
      onYes(reminder!);
    } else {
      // Reset to middle if not fully dragged
      setSliderPos(50);
    }
  };

  const handleSliderMove = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !sliderRef.current) return;

    const rect = sliderRef.current.getBoundingClientRect();
    let clientX = 0;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
    } else {
      clientX = e.clientX;
    }

    const relativeX = clientX - rect.left;
    const percentage = (relativeX / rect.width) * 100;
    const clamped = Math.max(0, Math.min(100, percentage));

    setSliderPos(clamped);
  };

  if (!reminder) return null;

  const questionText = reminder.isShopOwnerAlarm
    ? `Is ${reminder.userName} coming for token #${reminder.tokenNumber}?`
    : 'Are you still coming?';

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      {/* Semi-transparent backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Main alarm container */}
      <div
        className="relative w-full max-w-xs bg-gradient-to-b from-red-500 to-red-600 rounded-3xl shadow-2xl overflow-hidden"
        style={{ aspectRatio: '9/14' }}
      >
        {/* Purple border accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-purple-500" />

        {/* Content container */}
        <div className="h-full flex flex-col items-center justify-between p-6">
          {/* Dancing Clock Section */}
          <div className="pt-4">
            <div className="relative w-24 h-24">
              {/* Clock icon with dancing animation */}
              <div className="absolute inset-0 flex items-center justify-center animate-bounce"
                style={{
                  animation: 'bounce 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite',
                  transformOrigin: 'center',
                }}>
                <svg
                  className="w-20 h-20 text-white drop-shadow-lg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  {/* Clock circle */}
                  <circle cx="12" cy="12" r="9" />
                  {/* Hour hand */}
                  <line x1="12" y1="12" x2="12" y2="7" strokeLinecap="round" />
                  {/* Minute hand */}
                  <line x1="12" y1="12" x2="15" y2="12" strokeLinecap="round" />
                  {/* Left bell */}
                  <circle cx="7" cy="4" r="1.5" />
                  <path d="M 6.5 4 Q 6 5 6 6" fill="none" />
                  {/* Right bell */}
                  <circle cx="17" cy="4" r="1.5" />
                  <path d="M 17.5 4 Q 18 5 18 6" fill="none" />
                  {/* Bottom tick */}
                  <line x1="12" y1="20" x2="12" y2="21" strokeLinecap="round" />
                </svg>
              </div>

              {/* Ringing circle icon in center */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center animate-pulse">
                  <Bell className="w-4 h-4 text-red-500" />
                </div>
              </div>
            </div>
          </div>

          {/* Question text box */}
          <div className="flex-1 flex items-center justify-center px-4">
            <div className="bg-white rounded-lg p-6 shadow-lg text-center min-h-20 flex items-center justify-center">
              <p className="text-slate-800 font-semibold text-base leading-tight">
                {questionText}
              </p>
            </div>
          </div>

          {/* Booking info - compact version */}
          <div className="text-white text-xs mb-2 text-center space-y-0.5">
            <p>{reminder.shopName}</p>
            <p>{reminder.timeSlot} • Token #{reminder.tokenNumber}</p>
          </div>

          {/* Interactive slider */}
          <div className="w-full space-y-3">
            {/* Slider track */}
            <div
              ref={sliderRef}
              className="relative h-12 bg-green-500 rounded-full shadow-lg cursor-grab active:cursor-grabbing overflow-hidden"
              onMouseMove={handleSliderMove}
              onMouseUp={handleSliderEnd}
              onMouseLeave={handleSliderEnd}
              onTouchMove={handleSliderMove}
              onTouchEnd={handleSliderEnd}
            >
              {/* Slider labels */}
              <div className="absolute inset-0 flex items-center justify-between px-6 pointer-events-none">
                <span className="text-white font-bold text-sm">No</span>
                <span className="text-white font-bold text-sm">Yes</span>
              </div>

              {/* Draggable circle */}
              <div
                className="absolute top-1/2 w-10 h-10 bg-green-700 rounded-full shadow-md transform -translate-y-1/2 pointer-events-auto transition-none"
                style={{
                  left: `calc(${sliderPos}% - 20px)`,
                  cursor: isDraggingRef.current ? 'grabbing' : 'grab',
                }}
                onMouseDown={handleSliderStart}
                onTouchStart={handleSliderStart}
              >
                <div className="w-full h-full rounded-full bg-gradient-to-b from-green-600 to-green-800 flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full opacity-60" />
                </div>
              </div>
            </div>

            {/* Timer text */}
            <p className="text-white text-center text-sm font-medium">
              Will close in {timeLeft}s
            </p>
          </div>
        </div>

        {/* Style for bounce animation */}
        <style>{`
          @keyframes bounce {
            0%, 100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-8px);
            }
          }
        `}</style>
      </div>
    </div>
  );
};
