/**
 * Device Timer Scheduling Utility
 *
 * Sets timers using the device's native Clock/Timer app.
 * Opens Android's native timer which works reliably across all devices.
 */

import { Capacitor } from '@capacitor/core';
import toast from 'react-hot-toast';

export interface TimerResult {
  success: boolean;
  message: string;
  method?: 'native-timer' | 'simulated';
  timerId?: string;
}

/**
 * Check if device supports timer scheduling
 */
export const isTimerSupported = (): boolean => {
  return true; // Native timers work on all platforms
};

/**
 * Set a device timer that rings after specified minutes
 * Opens the device's native Clock/Timer app
 */
export const setDeviceTimer = async (minutes: number, label: string = 'Device Timer'): Promise<TimerResult> => {
  try {
    console.log(`\n⏱️ Setting device timer for ${minutes} minute(s)...`);
    console.log(`📝 Label: "${label}"`);

    if (!Capacitor.isNativePlatform()) {
      // Web platform - simulate with browser timer
      return setWebTimer(minutes, label);
    }

    if (Capacitor.getPlatform() !== 'android') {
      console.log('❌ Timers only supported on Android');
      return {
        success: false,
        message: 'Timers only supported on Android',
      };
    }

    // Android - open native timer
    console.log('📱 Android detected - opening native timer app...');
    return openNativeTimer(minutes, label);
  } catch (error) {
    console.error('❌ Error setting timer:', error);
    return {
      success: false,
      message: `Failed to set timer: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};

/**
 * Open the device's native Android timer app
 */
const openNativeTimer = async (minutes: number, label: string): Promise<TimerResult> => {
  try {
    const durationSeconds = minutes * 60;

    console.log(`⏰ Opening native timer for ${durationSeconds} seconds`);
    console.log(`📱 Timer label: ${label}`);

    // Check if AlarmBridge (MainActivity bridge) is available
    const alarmBridge = (window as any).AlarmBridge;

    if (!alarmBridge || typeof alarmBridge.openSystemTimer !== 'function') {
      throw new Error('AlarmBridge.openSystemTimer not available - app not built for native');
    }

    // Call native method to open system timer
    alarmBridge.openSystemTimer(durationSeconds, label);

    console.log(`✅ TIMER SUCCESS: Native timer app opened`);
    console.log(`⏱️ Duration: ${minutes} minute${minutes > 1 ? 's' : ''}`);
    console.log(`📍 Label: ${label}`);

    toast.success(`⏱️ Timer app opened\nSet ${minutes} minute${minutes > 1 ? 's' : ''} in your device's Clock app`, {
      duration: 4000,
      icon: '⏱️',
    });

    return {
      success: true,
      message: `Timer app opened - set ${minutes} minute${minutes > 1 ? 's' : ''} in your device's Clock app`,
      method: 'native-timer',
    };
  } catch (error) {
    console.error('❌ Native timer failed:', error);
    throw error;
  }
};

/**
 * Set timer on web platform (for testing)
 */
const setWebTimer = async (minutes: number, label: string): Promise<TimerResult> => {
  try {
    console.log(`🌐 Web platform - setting browser timer for ${minutes} minute(s)`);

    const durationMs = minutes * 60 * 1000;

    // Set browser timer
    setTimeout(() => {
      console.log(`⏰ Timer expired: ${label}`);
      // Trigger notification on web
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('⏱️ Timer', {
          body: label,
          tag: 'timer-' + Date.now(),
          requireInteraction: true,
        });
      }

      // Play alert sound if possible
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 1);
      } catch (e) {
        console.log('Could not play alert sound');
      }
    }, durationMs);

    console.log(`✅ TIMER SUCCESS: Web timer set for ${minutes} minute(s)`);
    toast.success(`⏱️ Timer set for ${minutes} minute${minutes > 1 ? 's' : ''}\n${label}`, {
      duration: 3000,
      icon: '⏱️',
    });

    return {
      success: true,
      message: `Timer set for ${minutes} minute${minutes > 1 ? 's' : ''}`,
      method: 'simulated',
    };
  } catch (error) {
    console.error('❌ Web timer error:', error);
    return {
      success: false,
      message: `Failed to set timer: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};
