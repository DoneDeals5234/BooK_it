import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getMessaging, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyB_LZZpIxG8fFpWMDpEyEHHAxtcyt8poXo",
  authDomain: "barber-app-6993a.firebaseapp.com",
  databaseURL: "https://barber-app-6993a-default-rtdb.firebaseio.com",
  projectId: "barber-app-6993a",
  storageBucket: "barber-app-6993a.firebasestorage.app",
  messagingSenderId: "1091592092089",
  appId: "1:1091592092089:web:ae75ea10d45a0479eade68",
  measurementId: "G-07JT5Y9LCH"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Initialize Firebase Messaging (safely handle unsupported environments like Capacitor)
export const messaging = (async () => {
  try {
    // Add a timeout to isSupported() as it can hang in some environments
    const isSupportedPromise = isSupported();
    const timeoutPromise = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5000));
    
    const supported = await Promise.race([isSupportedPromise, timeoutPromise]);
    
    if (supported) {
      return getMessaging(app);
    }
    console.log('ℹ️ Firebase Messaging not supported or timed out in this environment');
    return null;
  } catch (error) {
    console.warn('⚠️ Error initializing Firebase Messaging:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
})();

// Set persistence to local
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error('Error setting persistence:', error);
});
