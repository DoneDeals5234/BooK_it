// Firebase Cloud Messaging Service Worker
// This file is required for FCM web push notifications to work in background
// Place this file at: public/firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyB_LZZpIxG8fFpWMDpEyEHHAxtcyt8poXo",
  authDomain: "barber-app-6993a.firebaseapp.com",
  databaseURL: "https://barber-app-6993a-default-rtdb.firebaseio.com",
  projectId: "barber-app-6993a",
  storageBucket: "barber-app-6993a.firebasestorage.app",
  messagingSenderId: "1091592092089",
  appId: "1:1091592092089:web:ae75ea10d45a0479eade68",
  measurementId: "G-07JT5Y9LCH"
});

const messaging = firebase.messaging();

// Handle background notifications (when app tab is not in focus)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background message received:', payload);

  const notificationTitle = payload.notification?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: payload.data || {},
    // Show notification even if app is in background
    requireInteraction: false,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event);
  event.notification.close();

  // Open the app when notification is clicked
  event.waitUntil(
    clients.openWindow('/')
  );
});
