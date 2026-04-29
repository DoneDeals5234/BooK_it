/**
 * Reminder Monitor
 * Polls the process-pending-reminder function every 1 minute
 * until the reminder is sent and marked as complete
 */

const SUPABASE_URL = "https://supabase.donedeals.shop";
const CHECK_INTERVAL = 60000; // 1 minute in milliseconds

interface ReminderMonitor {
  bookingId: string;
  intervalId: NodeJS.Timeout | null;
  attempts: number;
  maxAttempts: 1440; // 24 hours worth of 1-minute checks
}

const monitors = new Map<string, ReminderMonitor>();

/**
 * Start monitoring a reminder
 * Calls process-pending-reminder every 1 minute until it's sent
 */
export async function startReminderMonitor(bookingId: string): Promise<void> {
  if (!bookingId) {
    console.error("❌ Cannot start reminder monitor - missing bookingId");
    return;
  }

  // Don't start multiple monitors for the same booking
  if (monitors.has(bookingId)) {
    console.warn(`⚠️ Reminder monitor already running for booking ${bookingId}`);
    return;
  }

  console.log(`🔔 Starting reminder monitor for booking: ${bookingId}`);

  const monitor: ReminderMonitor = {
    bookingId,
    intervalId: null,
    attempts: 0,
    maxAttempts: 1440, // 24 hours
  };

  monitors.set(bookingId, monitor);

  // Check immediately first
  try {
    const sent = await checkReminder(bookingId);
    if (sent) {
      stopReminderMonitor(bookingId);
      return;
    }
  } catch (error) {
    console.warn("⚠️ First check failed, will retry:", error);
  }

  // Then check every 1 minute
  monitor.intervalId = setInterval(async () => {
    monitor.attempts++;
    console.log(
      `🔄 Reminder monitor check #${monitor.attempts} for booking ${bookingId}`
    );

    // Safety check: stop after 24 hours
    if (monitor.attempts >= monitor.maxAttempts) {
      console.warn(`⚠️ Reminder monitor exceeded max attempts (${monitor.maxAttempts}), stopping`);
      stopReminderMonitor(bookingId);
      return;
    }

    try {
      const sent = await checkReminder(bookingId);
      if (sent) {
        console.log(`✅ Reminder has been sent! Stopping monitor for ${bookingId}`);
        stopReminderMonitor(bookingId);
      }
    } catch (error) {
      console.warn(`⚠️ Check failed on attempt ${monitor.attempts}:`, error);
      // Continue checking - might be a temporary network error
    }
  }, CHECK_INTERVAL);

  console.log(`✅ Reminder monitor started for ${bookingId} - will check every 1 minute`);
}

/**
 * Stop monitoring a reminder
 */
export function stopReminderMonitor(bookingId: string): void {
  const monitor = monitors.get(bookingId);
  if (!monitor) {
    console.warn(`⚠️ No monitor found for booking ${bookingId}`);
    return;
  }

  if (monitor.intervalId) {
    clearInterval(monitor.intervalId);
    monitor.intervalId = null;
  }

  monitors.delete(bookingId);
  console.log(`🛑 Reminder monitor stopped for ${bookingId} (checked ${monitor.attempts} times)`);
}

/**
 * Check if a reminder should be sent
 * Calls the process-pending-reminder Edge Function
 */
async function checkReminder(bookingId: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/process-pending-reminder`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bookingId }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.warn(`⚠️ Check failed with status ${response.status}:`, data);
      return false;
    }

    console.log(`📊 Reminder status: ${data.message}`, data);

    // Check if reminder has been sent
    if (data.message === "Reminder sent and marked as complete") {
      console.log(`✅ Reminder successfully sent for ${bookingId}`);
      return true;
    }

    // If already sent, we're done
    if (data.message === "Reminder already sent") {
      console.log(`✅ Reminder was already sent for ${bookingId}`);
      return true;
    }

    // Not yet time to send
    if (data.message === "Not yet time to send") {
      const timeRemaining = data.timeRemaining || 0;
      const minutesRemaining = Math.ceil(timeRemaining / 60000);
      console.log(`⏳ Time remaining: ${minutesRemaining} minute(s)`);
      return false;
    }

    return false;
  } catch (error) {
    console.warn(`⚠️ Error checking reminder status:`, error);
    throw error;
  }
}

/**
 * Get monitor status for debugging
 */
export function getMonitorStatus(bookingId: string) {
  const monitor = monitors.get(bookingId);
  if (!monitor) {
    return null;
  }

  return {
    bookingId: monitor.bookingId,
    attempts: monitor.attempts,
    isRunning: monitor.intervalId !== null,
    maxAttempts: monitor.maxAttempts,
  };
}

/**
 * Stop all reminder monitors
 * Useful for cleanup when user navigates away
 */
export function stopAllReminderMonitors(): void {
  console.log(`🛑 Stopping ${monitors.size} reminder monitor(s)`);
  for (const [bookingId] of monitors) {
    stopReminderMonitor(bookingId);
  }
}
