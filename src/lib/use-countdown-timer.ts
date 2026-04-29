import { useState, useEffect, useCallback } from 'react';

interface CountdownTimerOptions {
  duration: number; // in milliseconds
  onExpire?: () => void;
  autoStart?: boolean;
}

export const useCountdownTimer = (options: CountdownTimerOptions) => {
  const { duration, onExpire, autoStart = true } = options;
  const [secondsRemaining, setSecondsRemaining] = useState(Math.ceil(duration / 1000));
  const [isExpired, setIsExpired] = useState(false);
  const [isActive, setIsActive] = useState(autoStart);

  useEffect(() => {
    if (!isActive || isExpired) return;

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        const newValue = prev - 1;
        if (newValue <= 0) {
          setIsExpired(true);
          setIsActive(false);
          onExpire?.();
          return 0;
        }
        return newValue;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, isExpired, onExpire]);

  const start = useCallback(() => {
    if (!isExpired) {
      setIsActive(true);
    }
  }, [isExpired]);

  const pause = useCallback(() => {
    setIsActive(false);
  }, []);

  const resume = useCallback(() => {
    if (!isExpired) {
      setIsActive(true);
    }
  }, [isExpired]);

  const reset = useCallback(() => {
    setSecondsRemaining(Math.ceil(duration / 1000));
    setIsExpired(false);
    setIsActive(autoStart);
  }, [duration, autoStart]);

  return {
    secondsRemaining,
    isExpired,
    isActive,
    start,
    pause,
    resume,
    reset,
  };
};

// Utility function to format seconds to MM:SS
export const formatCountdown = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};
