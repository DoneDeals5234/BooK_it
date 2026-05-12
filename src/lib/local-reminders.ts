/**
 * Local reminder storage and scheduler
 * Stores reminders locally and checks periodically if they should be sent
 * This is a fallback mechanism when FCM scheduling fails on native devices
 */

export interface LocalReminder {
  id: string;
  userId: string;
  bookingId: string;
  reminderTime: string; // HH:MM format
  bookingDate: string; // YYYY-MM-DD format
  shopName: string;
  tokenNumber: number;
  userName: string;
  timeSlot: string;
  shopId: string;
  createdAt: number; // timestamp when reminder was created
  scheduledForTimestamp: number; // unix timestamp when reminder should fire
  sent: boolean;
  sentAt?: number;
  isShopOwnerAlarm?: boolean; // true if this is an alarm for shop owner to confirm customer
}

const STORAGE_KEY = 'bookbarber_reminders';
const CHECK_INTERVAL = 60000; // Check every minute

let checkIntervalId: NodeJS.Timeout | null = null;
let onAlarmCallback: ((reminder: LocalReminder) => void) | null = null;

/**
 * Set callback for when reminder alarm should trigger
 */
export function setAlarmCallback(callback: (reminder: LocalReminder) => void): void {
  onAlarmCallback = callback;
}

/**
 * Save a reminder locally
 * @returns The created LocalReminder object
 */
export function saveReminderLocally(
  userId: string,
  bookingId: string,
  reminderTime: string,
  bookingDate: string,
  shopName: string,
  tokenNumber: number,
  userName: string,
  timeSlot: string,
  shopId: string,
  timezoneOffsetHours: number = 0
): LocalReminder {
  // Calculate when the reminder should fire
  const [year, month, day] = bookingDate.split('-').map(Number);
  const [hour, minute] = reminderTime.split(':').map(Number);

  // Create a date in the user's local time
  // new Date(year, month, day, hour, minute) creates a date in the LOCAL timezone
  const localDate = new Date(year, month - 1, day, hour, minute, 0);
  const scheduledForTimestamp = Math.floor(localDate.getTime() / 1000);

  // Log for debugging
  const now = Math.floor(Date.now() / 1000);
  const secondsUntilReminder = scheduledForTimestamp - now;
  console.log(
    `📍 Reminder scheduled:\n` +
    `   Reminder time: ${reminderTime} on ${bookingDate}\n` +
    `   Scheduled for: ${new Date(scheduledForTimestamp * 1000).toLocaleString()}\n` +
    `   Current time:  ${new Date(now * 1000).toLocaleString()}\n` +
    `   Time until:    ${secondsUntilReminder}s (${Math.floor(secondsUntilReminder / 60)}m)`
  );

  const reminder: LocalReminder = {
    id: `${bookingId}-${Date.now()}`,
    userId,
    bookingId,
    reminderTime,
    bookingDate,
    shopName,
    tokenNumber,
    userName,
    timeSlot,
    shopId,
    createdAt: Math.floor(Date.now() / 1000),
    scheduledForTimestamp,
    sent: false,
  };

  const reminders = getAllReminders();
  reminders.push(reminder);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));

  console.log(
    `📍 Local reminder saved: ${bookingId} scheduled for ${new Date(scheduledForTimestamp * 1000).toLocaleString()}`
  );

  return reminder;
}

/**
 * Get all stored reminders
 */
export function getAllReminders(): LocalReminder[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error reading reminders from localStorage:', error);
    return [];
  }
}

/**
 * Get pending reminders (ready to send: scheduled time has arrived and not yet sent)
 * IMPORTANT: Reminder alarm will ONLY show if app is opened within 5 minutes of scheduled time
 */
export function getPendingReminders(): LocalReminder[] {
  const now = Math.floor(Date.now() / 1000);
  const allReminders = getAllReminders();
  const ALARM_WINDOW_SECONDS = 5 * 60; // 5 minutes = 300 seconds

  const pending = allReminders.filter((r) => {
    if (r.sent) {
      return false; // Skip already sent reminders
    }

    // Check if reminder time has arrived
    const hasTimePassed = r.scheduledForTimestamp <= now;

    if (!hasTimePassed) {
      // Log upcoming reminders for debugging
      const secondsRemaining = r.scheduledForTimestamp - now;
      const minutesRemaining = Math.floor(secondsRemaining / 60);
      console.log(
        `⏳ Reminder ${r.bookingId} not yet ready. ` +
        `Scheduled: ${new Date(r.scheduledForTimestamp * 1000).toLocaleString()}, ` +
        `Ready in: ${secondsRemaining}s (${minutesRemaining}m)`
      );
      return false;
    }

    // ✅ NEW: Check if we're within the 5-minute window
    // Alarm will only appear if app is opened within 300 seconds (5 minutes) of the reminder time
    const secondsSinceReminder = now - r.scheduledForTimestamp;
    const isWithinWindow = secondsSinceReminder <= ALARM_WINDOW_SECONDS;

    if (!isWithinWindow) {
      // Reminder time has passed but window expired
      const minutesLate = Math.floor(secondsSinceReminder / 60);
      console.log(
        `⛔ Reminder ${r.bookingId} EXPIRED (opened ${secondsSinceReminder}s / ${minutesLate}m after scheduled time). ` +
        `Scheduled: ${new Date(r.scheduledForTimestamp * 1000).toLocaleString()}, ` +
        `Opened now: ${new Date(now * 1000).toLocaleString()}`
      );
      return false;
    }

    // Reminder is within the active 5-minute window
    console.log(
      `✅ Reminder ${r.bookingId} is ACTIVE (opened ${secondsSinceReminder}s after scheduled time)`
    );
    return true;
  });

  if (pending.length > 0) {
    console.log(`✅ ${pending.length} reminder(s) are ready to trigger (within 5-minute window)`);
    pending.forEach((r) => {
      const now = Math.floor(Date.now() / 1000);
      const secondsSinceReminder = now - r.scheduledForTimestamp;
      console.log(
        `   - ${r.bookingId} at ${new Date(r.scheduledForTimestamp * 1000).toLocaleString()} ` +
        `(opened ${secondsSinceReminder}s after reminder time)`
      );
    });
  } else {
    const expiredReminders = getAllReminders().filter((r) => {
      if (r.sent) return false;
      const secondsSinceReminder = now - r.scheduledForTimestamp;
      return r.scheduledForTimestamp <= now && secondsSinceReminder > ALARM_WINDOW_SECONDS;
    });
    if (expiredReminders.length > 0) {
      console.log(`⛔ ${expiredReminders.length} reminder(s) have EXPIRED (outside 5-minute window)`);
    }
  }

  return pending;
}

/**
 * Get upcoming reminders (for debugging/display)
 */
export function getUpcomingReminders(): LocalReminder[] {
  const now = Math.floor(Date.now() / 1000);
  return getAllReminders().filter((r) => !r.sent && r.scheduledForTimestamp > now);
}

/**
 * Mark a reminder as sent
 */
export function markReminderAsSent(reminderId: string): void {
  const reminders = getAllReminders();
  const reminder = reminders.find((r) => r.id === reminderId);
  if (reminder) {
    reminder.sent = true;
    reminder.sentAt = Math.floor(Date.now() / 1000);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
    console.log(`✅ Reminder marked as sent: ${reminderId}`);
  }
}

/**
 * Delete a reminder
 */
export function deleteReminder(reminderId: string): void {
  const reminders = getAllReminders().filter((r) => r.id !== reminderId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
  console.log(`🗑️ Reminder deleted: ${reminderId}`);
}

/**
 * Start monitoring for reminders to send
 * This should be called once when the app initializes
 */
export function startReminderMonitor(onReminderReady: (reminder: LocalReminder) => void): void {
  if (checkIntervalId) {
    console.warn('⚠️ Reminder monitor already running');
    return;
  }

  console.log('🔔 Starting local reminder monitor...');

  // Check immediately on startup
  checkAndSendReminders(onReminderReady);

  // Then check every minute
  checkIntervalId = setInterval(() => {
    checkAndSendReminders(onReminderReady);
  }, CHECK_INTERVAL);
}

/**
 * Stop monitoring for reminders
 */
export function stopReminderMonitor(): void {
  if (checkIntervalId) {
    clearInterval(checkIntervalId);
    checkIntervalId = null;
    console.log('🛑 Reminder monitor stopped');
  }
}

/**
 * Check if any reminders are ready to send
 */
function checkAndSendReminders(onReminderReady: (reminder: LocalReminder) => void): void {
  // First, clean up any expired reminders (outside 1-minute window)
  markExpiredRemindersAsSent();

  const pending = getPendingReminders();

  if (pending.length > 0) {
    console.log(`🔔 Found ${pending.length} reminder(s) ready to send (within 1-minute window)`);
    pending.forEach((reminder) => {
      const now = Math.floor(Date.now() / 1000);
      const secondsSinceReminder = now - reminder.scheduledForTimestamp;
      console.log(
        `⏰ Triggering reminder: ${reminder.bookingId} ` +
        `(scheduled: ${new Date(reminder.scheduledForTimestamp * 1000).toLocaleString()}, ` +
        `opened: ${secondsSinceReminder}s after)`
      );
      // Trigger alarm if callback is set
      if (onAlarmCallback) {
        console.log('🔔 Triggering alarm for reminder:', reminder.bookingId);
        onAlarmCallback(reminder);
      }
      // Also call the original callback for other handlers
      onReminderReady(reminder);
      markReminderAsSent(reminder.id);
    });
  }
}

/**
 * Clean up reminders that have expired (outside the 5-minute window)
 * These reminders should not trigger alarms anymore
 */
export function markExpiredRemindersAsSent(): void {
  const now = Math.floor(Date.now() / 1000);
  const ALARM_WINDOW_SECONDS = 5 * 60; // 5 minutes = 300 seconds
  const reminders = getAllReminders();
  let markedCount = 0;

  const updated = reminders.map((r) => {
    if (r.sent) {
      return r; // Already sent, skip
    }

    if (r.scheduledForTimestamp <= now) {
      const secondsSinceReminder = now - r.scheduledForTimestamp;
      if (secondsSinceReminder > ALARM_WINDOW_SECONDS) {
        // Mark as sent since window has expired
        console.log(
          `🔔 Auto-marking reminder ${r.bookingId} as sent (window expired ${secondsSinceReminder}s ago)`
        );
        markedCount++;
        return {
          ...r,
          sent: true,
          sentAt: now,
        };
      }
    }

    return r;
  });

  if (markedCount > 0) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    console.log(`✅ Marked ${markedCount} expired reminder(s) as sent`);
  }
}

/**
 * Clean up old reminders (older than 7 days)
 */
export function cleanupOldReminders(): void {
  const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
  const reminders = getAllReminders().filter((r) => r.createdAt > sevenDaysAgo);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
  console.log(`🧹 Cleaned up old reminders`);
}

/**
 * Get reminder stats for debugging
 */
export function getReminderStats() {
  const all = getAllReminders();
  const pending = getPendingReminders();
  const upcoming = getUpcomingReminders();
  const sent = all.filter((r) => r.sent);

  return {
    total: all.length,
    pending: pending.length,
    upcoming: upcoming.length,
    sent: sent.length,
    oldestUnsent: upcoming.length > 0 ? upcoming[0] : null,
  };
}
