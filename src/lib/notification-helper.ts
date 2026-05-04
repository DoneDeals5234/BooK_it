import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import toast from 'react-hot-toast';

/**
 * Sends a local notification if running on a native platform,
 * otherwise just shows a toast.
 * 
 * @param title Notification title
 * @param body Notification body
 * @param id Optional unique ID for the notification
 */
export const sendLocalNotification = async (title: string, body: string, id: number = Math.floor(Math.random() * 10000)) => {
  console.log(`🔔 Sending local notification: ${title} - ${body}`);
  
  if (Capacitor.isNativePlatform()) {
    try {
      // Check/Request permissions first
      const permStatus = await LocalNotifications.checkPermissions();
      if (permStatus.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }

      await LocalNotifications.schedule({
        notifications: [
          {
            title,
            body,
            id,
            schedule: { at: new Date(Date.now() + 100) }, // Send almost immediately
            smallIcon: 'ic_notification_b', // Use our new red B icon
            sound: 'res://raw/order_ringtone', // Optional: could add a success sound if needed
            extra: {
              type: 'success'
            }
          }
        ]
      });
    } catch (error) {
      console.error('Error scheduling local notification:', error);
    }
  } else {
    // Web fallback - just toast
    toast.success(`${title}: ${body}`, {
      duration: 4000,
      icon: '🔔'
    });
  }
};

/**
 * Wraps toast.success to also send a local notification on native devices
 */
export const notifySuccess = (message: string, title: string = 'Success') => {
  toast.success(message);
  sendLocalNotification(title, message);
};
