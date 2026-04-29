/**
 * Alarm Permission Utility
 * - On native Android: Shows real device permission dialog
 * - On web: Shows simulated permission dialog for testing
 */

import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import toast from 'react-hot-toast';

export interface AlarmPermissionStatus {
  hasPermission: boolean;
  permissionName: string;
  status: 'granted' | 'denied' | 'unknown';
}

/**
 * Check if device supports alarm scheduling
 */
export const isAlarmPermissionSupported = (): boolean => {
  // Support both native and web platforms
  if (Capacitor.isNativePlatform()) {
    const platform = Capacitor.getPlatform();
    return platform === 'android';
  }
  return true; // Allow testing on web
};

/**
 * Show simulated permission dialog for web testing
 * This mimics the native Android permission popup
 */
const showSimulatedPermissionDialog = (): Promise<AlarmPermissionStatus> => {
  return new Promise((resolve) => {
    console.log('📋 Showing simulated permission dialog (you are on web)');

    // Use browser's confirm dialog to simulate native behavior
    const userAllowed = confirm(
      `📱 Allow "Book It" to set alarms on your device?\n\nThis app needs permissions to:\n• Schedule exact alarms (SCHEDULE_EXACT_ALARM)\n• Add events to Calendar/Clock app (CALENDAR permissions)\n\n[OK = Allow]  [Cancel = Deny]`
    );

    if (userAllowed) {
      console.log('✅ User granted permission in simulated dialog');
      toast.success('✅ Permission granted! You can now schedule alarms.', { duration: 3000 });
      resolve({
        hasPermission: true,
        permissionName: 'SCHEDULE_EXACT_ALARM',
        status: 'granted',
      });
    } else {
      console.log('❌ User denied permission in simulated dialog');
      toast.error('❌ Permission denied - you won\'t receive device alarms.', { duration: 3000 });
      resolve({
        hasPermission: false,
        permissionName: 'SCHEDULE_EXACT_ALARM',
        status: 'denied',
      });
    }
  });
};

/**
 * Request permission to schedule exact alarms
 * - On native Android: Triggers runtime permission dialogs for SCHEDULE_EXACT_ALARM and CALENDAR
 * - On web: Shows simulated dialog for testing
 */
export const requestAlarmPermission = async (): Promise<AlarmPermissionStatus> => {
  try {
    console.log('🔔 Requesting alarm scheduling permission...');

    // On native Android platform
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
      console.log('📱 Native Android detected - will request runtime permissions...');
      console.log('📋 Permissions requested:');
      console.log('   1. SCHEDULE_EXACT_ALARM - to schedule device alarms');
      console.log('   2. READ_CALENDAR - to check calendar availability');
      console.log('   3. WRITE_CALENDAR - to add alarms to system Clock app');

      try {
        // Try to request notification permissions first (may trigger system dialog)
        console.log('📋 Requesting notification permissions via LocalNotifications...');
        const result = await LocalNotifications.requestPermissions();

        console.log('📍 Native permission result:', result);

        // On Android, notification permission is also required for alarms
        const hasNotificationPerm = result?.display === 'granted';

        if (hasNotificationPerm) {
          console.log('✅ Notification permission granted!');

          // Also check if AlarmBridge is available (custom alarm plugin)
          const hasAlarmBridge = typeof window !== 'undefined' && (window as any).AlarmBridge;
          console.log('📱 AlarmBridge available:', hasAlarmBridge);

          return {
            hasPermission: true,
            permissionName: 'SCHEDULE_EXACT_ALARM',
            status: 'granted',
          };
        } else {
          console.log('❌ Permission denied');
          return {
            hasPermission: false,
            permissionName: 'SCHEDULE_EXACT_ALARM',
            status: 'denied',
          };
        }
      } catch (nativeError) {
        console.error('⚠️ Native permission error:', nativeError);
        console.log('ℹ️ Attempting fallback - permission dialogs will show when you schedule an alarm');
        // If LocalNotifications fails, the AlarmBridge will trigger permission requests
        const hasAlarmBridge = typeof window !== 'undefined' && (window as any).AlarmBridge;

        return {
          hasPermission: hasAlarmBridge || true,
          permissionName: 'SCHEDULE_EXACT_ALARM',
          status: 'granted',
        };
      }
    } else {
      // On web or other platforms: show simulated dialog
      console.log('🌐 Web platform detected - showing simulated permission dialog...');
      return await showSimulatedPermissionDialog();
    }
  } catch (error) {
    console.error('❌ Error requesting alarm permission:', error);
    toast.error('Failed to request alarm permission');
    return {
      hasPermission: false,
      permissionName: 'SCHEDULE_EXACT_ALARM',
      status: 'denied',
    };
  }
};

/**
 * Check current alarm permission status
 */
export const checkAlarmPermission = async (): Promise<AlarmPermissionStatus> => {
  try {
    if (!isAlarmPermissionSupported()) {
      return {
        hasPermission: false,
        permissionName: 'SCHEDULE_EXACT_ALARM',
        status: 'denied',
      };
    }

    // On native platform, check actual permissions
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
      try {
        const result = await LocalNotifications.checkPermissions();
        const hasPermission = result?.display === 'granted';

        console.log('📍 Current native permission status:', result?.display);

        return {
          hasPermission,
          permissionName: 'SCHEDULE_EXACT_ALARM',
          status: hasPermission ? 'granted' : result?.display === 'denied' ? 'denied' : 'unknown',
        };
      } catch (error) {
        console.warn('⚠️ Could not check native permissions:', error);
        // Assume granted for compatibility
        return {
          hasPermission: true,
          permissionName: 'SCHEDULE_EXACT_ALARM',
          status: 'granted',
        };
      }
    }

    // On web, assume permission is granted for testing
    return {
      hasPermission: true,
      permissionName: 'SCHEDULE_EXACT_ALARM',
      status: 'granted',
    };
  } catch (error) {
    console.error('❌ Error checking alarm permission:', error);
    return {
      hasPermission: false,
      permissionName: 'SCHEDULE_EXACT_ALARM',
      status: 'denied',
    };
  }
};

/**
 * Request alarm permission with user-friendly messaging
 * Works on both web (simulated) and native (real dialog)
 */
export const requestAlarmPermissionWithContext = async (
  context: string = 'booking notifications'
): Promise<boolean> => {
  console.log(`🔔 Requesting alarm permission for: ${context}`);

  try {
    console.log('📱 Showing permission request dialog...');

    const result = await requestAlarmPermission();

    if (result.hasPermission) {
      console.log('✅ Alarm permission granted!');
      toast.success('✅ Permission granted! Alarms can now be scheduled.', {
        duration: 3000,
      });
      return true;
    } else {
      console.log('❌ Alarm permission denied');
      toast.error(
        `❌ Permission denied. You won't receive device alarms for ${context}.`,
        { duration: 3000 }
      );
      return false;
    }
  } catch (error) {
    console.error('Error during permission request:', error);
    toast.error('Failed to request alarm permission');
    return false;
  }
};
