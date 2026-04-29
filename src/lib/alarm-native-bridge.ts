/**
 * Alarm Native Bridge - Uses Capacitor Local Notifications
 * Proxies to the main alarm-scheduler module which now uses Capacitor
 */

import {
  scheduleAlarm,
  cancelAlarm,
  getPendingAlarmData,
  testAlarm,
  requestNotificationPermissions,
} from './alarm-scheduler';

export async function scheduleAlarmNative(options: {
  bookingId: string;
  reminderTime: string;
  bookingDate: string;
  tokenNumber: number;
  shopName: string;
  userName: string;
  timeSlot: string;
  shopId: string;
}): Promise<boolean> {
  try {
    const result = await scheduleAlarm(options);
    return result.success;
  } catch (error) {
    console.error('Error scheduling alarm via native bridge:', error);
    return false;
  }
}

export async function cancelAlarmNative(bookingId: string): Promise<boolean> {
  try {
    const result = await cancelAlarm(bookingId);
    return result.success;
  } catch (error) {
    console.error('Error cancelling alarm via native bridge:', error);
    return false;
  }
}

export async function getPendingAlarmDataNative(): Promise<any> {
  try {
    return await getPendingAlarmData();
  } catch (error) {
    console.error('Error getting pending alarm data via native bridge:', error);
    return null;
  }
}

export async function testAlarmNative(bookingId: string, delaySeconds?: number): Promise<boolean> {
  try {
    const result = await testAlarm(bookingId, delaySeconds);
    return result.success;
  } catch (error) {
    console.error('Error scheduling test alarm via native bridge:', error);
    return false;
  }
}

export async function requestPermissionsNative(): Promise<boolean> {
  try {
    return await requestNotificationPermissions();
  } catch (error) {
    console.error('Error requesting permissions via native bridge:', error);
    return false;
  }
}
