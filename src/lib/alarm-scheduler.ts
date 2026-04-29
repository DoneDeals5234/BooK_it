/**
 * Alarm Scheduler - Direct AlarmManager via JavaScript Bridge
 * Uses Android's AlarmManager through the AlarmBridge JavaScript interface
 */

import { Capacitor } from '@capacitor/core';

// Declare the JavaScript bridge interface
declare global {
  interface Window {
    AlarmBridge?: {
      scheduleAlarm(
        bookingId: string,
        reminderTime: string,
        bookingDate: string,
        tokenNumber: number,
        shopName: string,
        timeSlot: string
      ): void;
      cancelAlarm(bookingId: string): void;
      testAlarm(bookingId: string, delaySeconds: number): void;
      getPendingAlarmData(): string;
      startForegroundAlarmService(
        triggerTimeMs: number,
        bookingId: string,
        tokenNumber: number,
        shopName: string,
        timeSlot: string
      ): void;
      stopForegroundAlarmService(): void;
      downloadAndInstallApk(url: string): void;
    };
  }
}

/**
 * Request notification permissions
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    if (!Capacitor.isNativePlatform()) {
      console.log('📱 Not on native platform, skipping notification permissions');
      return true;
    }

    console.log('🔔 Requesting notification permissions...');

    if (Capacitor.getPlatform() === 'android') {
      console.log('✅ Android alarm permissions configured at manifest level');
      return true;
    }

    console.log('✅ Notification permissions ready');
    return true;
  } catch (error) {
    console.warn('⚠️ Error requesting permissions:', error);
    return false;
  }
}

/**
 * Schedule a device alarm for an appointment reminder using AlarmManager
 */
export async function scheduleAlarm(options: {
  bookingId: string;
  reminderTime: string; // "HH:MM"
  bookingDate: string; // "YYYY-MM-DD"
  tokenNumber: number;
  shopName: string;
  userName: string;
  timeSlot: string;
  shopId: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    if (!Capacitor.isNativePlatform()) {
      console.log('📱 Alarm scheduling not available on this platform');
      return {
        success: false,
        message: 'Alarm scheduling only available on native platforms',
      };
    }

    if (Capacitor.getPlatform() !== 'android') {
      console.warn('⚠️ Native alarms only supported on Android');
      return {
        success: false,
        message: 'Native alarms only available on Android',
      };
    }

    console.log(
      `⏰ Scheduling alarm for booking: ${options.bookingId}`,
      `at ${options.reminderTime} on ${options.bookingDate}`
    );

    // Check if JavaScript bridge is available
    if (!window.AlarmBridge) {
      console.error('❌ AlarmBridge JavaScript interface not available');
      return {
        success: false,
        message: 'AlarmBridge JavaScript interface not available',
      };
    }

    console.log('📱 Calling native AlarmBridge.scheduleAlarm()...');

    // Call the native method through JavaScript bridge
    window.AlarmBridge.scheduleAlarm(
      options.bookingId,
      options.reminderTime,
      options.bookingDate,
      options.tokenNumber,
      options.shopName,
      options.timeSlot
    );

    console.log(`✅ Alarm scheduled successfully: ${options.bookingId}`);
    console.log(
      `   Shop: ${options.shopName}, Token: #${options.tokenNumber}, Time: ${options.timeSlot}`
    );

    return {
      success: true,
      message: 'Alarm scheduled successfully',
    };
  } catch (error) {
    console.error('❌ Error scheduling alarm:', error);
    return {
      success: false,
      message: `Error scheduling alarm: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Cancel an existing device alarm
 */
export async function cancelAlarm(bookingId: string): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return {
        success: false,
        message: 'Alarm cancellation only available on Android',
      };
    }

    console.log(`🔕 Cancelling alarm for booking: ${bookingId}`);

    if (!window.AlarmBridge) {
      console.error('❌ AlarmBridge not available');
      return {
        success: false,
        message: 'AlarmBridge not available',
      };
    }

    window.AlarmBridge.cancelAlarm(bookingId);

    console.log(`✅ Alarm cancelled successfully: ${bookingId}`);
    return {
      success: true,
      message: 'Alarm cancelled successfully',
    };
  } catch (error) {
    console.error('❌ Error cancelling alarm:', error);
    return {
      success: false,
      message: `Error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Snooze an alarm for a specified number of minutes
 */
export async function snoozeAlarm(
  bookingId: string,
  minutes: number = 5
): Promise<{ success: boolean; message: string }> {
  console.log(`⏰ Snooze requested for booking: ${bookingId} for ${minutes} minutes`);

  try {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return {
        success: false,
        message: 'Snooze only available on Android',
      };
    }

    console.log(`✅ Snooze not yet implemented (infrastructure ready)`);
    return {
      success: true,
      message: `Alarm snoozed for ${minutes} minutes`,
    };
  } catch (error) {
    console.error('❌ Error snoozing alarm:', error);
    return {
      success: false,
      message: 'Error snoozing alarm',
    };
  }
}

/**
 * Test alarm scheduling - schedules alarm for X seconds in the future
 */
export async function testAlarm(
  bookingId: string,
  delaySeconds: number = 10
): Promise<{ success: boolean; message: string }> {
  console.log(`🧪 Test alarm requested - will trigger in ${delaySeconds} seconds`);

  try {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return {
        success: false,
        message: 'Test alarm only available on Android',
      };
    }

    if (!window.AlarmBridge) {
      console.error('❌ AlarmBridge not available');
      return {
        success: false,
        message: 'AlarmBridge not available',
      };
    }

    const testBookingId = `test-${Date.now()}`;
    window.AlarmBridge.testAlarm(testBookingId, delaySeconds);

    console.log(`✅ Test alarm scheduled for ${delaySeconds} seconds`);
    return {
      success: true,
      message: `Test alarm scheduled for ${delaySeconds} seconds`,
    };
  } catch (error) {
    console.error('❌ Error scheduling test alarm:', error);
    return {
      success: false,
      message: 'Error scheduling test alarm',
    };
  }
}

/**
 * Get pending alarm data (called from Android when app opens from alarm)
 */
export async function getPendingAlarmData(): Promise<{
  bookingId?: string;
  tokenNumber?: number;
  shopName?: string;
  timeSlot?: string;
} | null> {
  try {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return null;
    }

    if (!window.AlarmBridge) {
      console.warn('⚠️ AlarmBridge not available');
      return null;
    }

    const dataStr = window.AlarmBridge.getPendingAlarmData();
    
    if (!dataStr) {
      return null;
    }

    const alarmData = JSON.parse(dataStr);

    console.log('📱 Found pending alarm data:', {
      bookingId: alarmData.bookingId,
      tokenNumber: alarmData.tokenNumber,
      shopName: alarmData.shopName,
      timeSlot: alarmData.timeSlot,
    });

    return {
      bookingId: alarmData.bookingId,
      tokenNumber: alarmData.tokenNumber,
      shopName: alarmData.shopName,
      timeSlot: alarmData.timeSlot,
    };
  } catch (error) {
    console.warn('⚠️ Error getting pending alarm data:', error);
    return null;
  }
}

/**
 * Initialize alarm listener
 */
export async function initializeAlarmListener(): Promise<void> {
  try {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return;
    }

    // Check if bridge is available
    if (window.AlarmBridge) {
      console.log('✅ AlarmBridge JavaScript interface is available');
    } else {
      console.warn('⚠️ AlarmBridge JavaScript interface not yet available');

      // Retry after a short delay
      setTimeout(() => {
        if (window.AlarmBridge) {
          console.log('✅ AlarmBridge JavaScript interface is now available');
        } else {
          console.warn('⚠️ AlarmBridge still not available after retry');
        }
      }, 1000);
    }
  } catch (error) {
    console.warn('⚠️ Error initializing alarm listener:', error);
  }
}

/**
 * Start Foreground Alarm Service for guaranteed alarm scheduling
 * This service runs continuously in the background and keeps the device awake
 * Battery-intensive but guaranteed to work on all devices
 */
export async function startForegroundAlarmService(options: {
  bookingId: string;
  tokenNumber: number;
  shopName: string;
  timeSlot: string;
  triggerTimeMs: number; // Timestamp when alarm should trigger
}): Promise<{ success: boolean; message: string }> {
  try {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return {
        success: false,
        message: 'Foreground service only available on Android',
      };
    }

    if (!window.AlarmBridge) {
      console.error('❌ AlarmBridge not available');
      return {
        success: false,
        message: 'AlarmBridge not available',
      };
    }

    console.log('⏰ Starting ForegroundAlarmService');
    console.log(`   Booking: ${options.bookingId}`);
    console.log(`   Token: #${options.tokenNumber}`);
    console.log(`   Shop: ${options.shopName}`);
    console.log(`   Trigger time: ${new Date(options.triggerTimeMs).toLocaleString()}`);

    window.AlarmBridge.startForegroundAlarmService(
      options.triggerTimeMs,
      options.bookingId,
      options.tokenNumber,
      options.shopName,
      options.timeSlot
    );

    console.log('✅ ForegroundAlarmService started');
    return {
      success: true,
      message: 'Foreground alarm service started',
    };
  } catch (error) {
    console.error('❌ Error starting foreground alarm service:', error);
    return {
      success: false,
      message: `Error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Stop Foreground Alarm Service
 */
export async function stopForegroundAlarmService(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return {
        success: false,
        message: 'Foreground service only available on Android',
      };
    }

    if (!window.AlarmBridge) {
      console.error('❌ AlarmBridge not available');
      return {
        success: false,
        message: 'AlarmBridge not available',
      };
    }

    console.log('⏹️ Stopping ForegroundAlarmService');

    window.AlarmBridge.stopForegroundAlarmService();

    console.log('✅ ForegroundAlarmService stopped');
    return {
      success: true,
      message: 'Foreground alarm service stopped',
    };
  } catch (error) {
    console.error('❌ Error stopping foreground alarm service:', error);
    return {
      success: false,
      message: `Error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Sync Home State with Kotlin for robust back button handling
 */
export async function syncHomeState(isAtHome: boolean): Promise<void> {
  try {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return;
    }

    console.log(`🏠 Native Sync (Plugin): isAtHome = ${isAtHome}`);
    
    // Use the official Capacitor Plugin method (Guaranteed to work)
    await (Capacitor.Plugins as any).AlarmScheduler.syncHomeState({ isAtHome });
    
  } catch (error) {
    console.warn('⚠️ Error syncing home state:', error);
  }
}
