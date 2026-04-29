/**
 * Production Booking System - Timer and Countdown Utilities
 * Manages 1-minute alarms, 60-second customer wait timers, and 2-minute total timeout
 */

// Timer configurations (in milliseconds)
export const BOOKING_TIMER_CONFIG = {
  OWNER_RESPONSE_TIMEOUT: 60 * 1000, // 1 minute for owner to respond
  CUSTOMER_WAIT_TIMER: 60 * 1000, // 60 second countdown shown to customer
  TOTAL_NEGOTIATION_TIMEOUT: 2 * 60 * 1000, // 2 minutes total for entire negotiation
  CUSTOMER_OFFER_RESPONSE_TIMEOUT: 60 * 1000, // 1 minute for customer to respond to counter-offer
};

// Timer state management
interface TimerState {
  startTime: number;
  duration: number;
  interval: NodeJS.Timeout | null;
}

const activeTimers = new Map<string, TimerState>();

/**
 * Start a countdown timer
 * @param timerId - Unique identifier for this timer
 * @param durationMs - Duration in milliseconds
 * @param onTick - Callback called every second with seconds remaining
 * @param onExpire - Callback when timer expires
 */
export const startCountdownTimer = (
  timerId: string,
  durationMs: number,
  onTick: (secondsRemaining: number) => void,
  onExpire: () => void
) => {
  // Cancel any existing timer with same ID
  stopCountdownTimer(timerId);

  const startTime = Date.now();
  const endTime = startTime + durationMs;

  const interval = setInterval(() => {
    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));

    onTick(remaining);

    if (remaining <= 0) {
      stopCountdownTimer(timerId);
      onExpire();
    }
  }, 1000);

  activeTimers.set(timerId, {
    startTime,
    duration: durationMs,
    interval,
  });

  // Trigger first tick immediately
  const remaining = Math.ceil(durationMs / 1000);
  onTick(remaining);
};

/**
 * Stop a countdown timer
 */
export const stopCountdownTimer = (timerId: string) => {
  const timer = activeTimers.get(timerId);
  if (timer?.interval) {
    clearInterval(timer.interval);
    activeTimers.delete(timerId);
  }
};

/**
 * Get remaining time for a timer in seconds
 */
export const getTimerSecondsRemaining = (timerId: string): number => {
  const timer = activeTimers.get(timerId);
  if (!timer) return 0;

  const elapsed = Date.now() - timer.startTime;
  const remaining = Math.max(0, Math.ceil((timer.duration - elapsed) / 1000));
  return remaining;
};

/**
 * Check if a timer is still active
 */
export const isTimerActive = (timerId: string): boolean => {
  return activeTimers.has(timerId);
};

/**
 * Clear all active timers (useful on unmount)
 */
export const clearAllTimers = () => {
  activeTimers.forEach((timer) => {
    if (timer.interval) {
      clearInterval(timer.interval);
    }
  });
  activeTimers.clear();
};

/**
 * Calculate seconds remaining until expiration
 */
export const getSecondsUntilExpiration = (expiresAt: Date): number => {
  const now = Date.now();
  const expirationTime = expiresAt.getTime();
  const remaining = Math.max(0, Math.ceil((expirationTime - now) / 1000));
  return remaining;
};

/**
 * Format seconds to MM:SS for display
 */
export const formatSecondsToMMSS = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Check if negotiation has expired
 */
export const isNegotiationExpired = (expiresAt: Date): boolean => {
  return Date.now() > expiresAt.getTime();
};

/**
 * Create timer IDs for different negotiation stages
 */
export const createTimerId = (requestId: string, stage: 'owner_response' | 'customer_wait' | 'customer_offer_response' | 'total') => {
  return `booking-negotiation-${requestId}-${stage}`;
};
