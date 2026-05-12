import { Capacitor } from '@capacitor/core';

/**
 * Check if running in Capacitor/native environment
 */
export function isCapacitor(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Empty implementation of OneSignal initialization to prevent import errors
 */
export async function initializeCapacitorOneSignal(): Promise<void> {
  console.log('ℹ️ OneSignal has been removed from the project.');
}

export async function setupAndroidNotificationChannels(): Promise<void> {
  // FCM channels are handled in MainActivity.kt
}

export function setupSubscriptionListener(): void {
  // Removed OneSignal listener
}

export function setupNativeNotificationListeners(): void {
  // Handled by @capacitor/push-notifications in fcm-manager.ts
}

export async function ensureCapacitorNotificationPermissions(): Promise<boolean> {
  return true;
}

export function onCapacitorPushNotification(callback: (data: any) => void): () => void {
  return () => {};
}

export function onCapacitorPushNotificationClick(callback: (data: any) => void): () => void {
  return () => {};
}

export async function ensurePlayerIdCapturedAfterLogin(userId: string): Promise<void> {
  // Removed OneSignal logic
}
