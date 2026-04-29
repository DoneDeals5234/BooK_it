/**
 * Simplified App Lifecycle Detection
 * Works with current Capacitor version without external dependencies
 */

export type AppState = 'resumed' | 'paused' | 'destroyed';

let currentAppState: AppState = 'resumed';
let lifecycleListeners: ((state: AppState) => void)[] = [];
let isInitialized = false;

/**
 * Initialize app lifecycle detection using browser visibility API and page events
 */
export const initializeAppLifecycle = () => {
  if (isInitialized) return;

  // Method 1: Use Visibility API (most reliable)
  // Detects when user switches tabs or minimizes window
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      console.log('⏸️ App paused (visibility hidden)');
      currentAppState = 'paused';
      notifyListeners('paused');
    } else {
      console.log('🔄 App resumed (visibility visible)');
      currentAppState = 'resumed';
      notifyListeners('resumed');
    }
  });

  // Method 2: Listen to window focus events
  window.addEventListener('focus', () => {
    console.log('🔄 App resumed (window focus)');
    currentAppState = 'resumed';
    notifyListeners('resumed');
  });

  window.addEventListener('blur', () => {
    console.log('⏸️ App paused (window blur)');
    currentAppState = 'paused';
    notifyListeners('paused');
  });

  // Method 3: Listen to page visibility changes
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      console.log('🔄 App resumed (page restored from bfcache)');
      currentAppState = 'resumed';
      notifyListeners('resumed');
    }
  });

  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) {
      console.log('⏸️ App will be destroyed');
      currentAppState = 'destroyed';
      notifyListeners('destroyed');
    }
  });

  isInitialized = true;
  console.log('✅ App lifecycle initialized');
};

/**
 * Subscribe to app lifecycle changes
 */
export const onAppStateChange = (callback: (state: AppState) => void) => {
  lifecycleListeners.push(callback);
  // Immediately call with current state
  callback(currentAppState);
  
  // Return unsubscribe function
  return () => {
    lifecycleListeners = lifecycleListeners.filter(listener => listener !== callback);
  };
};

/**
 * Get current app state
 */
export const getAppState = (): AppState => {
  return currentAppState;
};

/**
 * Notify all listeners of state change
 */
const notifyListeners = (state: AppState) => {
  lifecycleListeners.forEach(listener => {
    try {
      listener(state);
    } catch (error) {
      console.error('Error in lifecycle listener:', error);
    }
  });
};

/**
 * Check if app is running in foreground
 */
export const isAppInForeground = (): boolean => {
  return currentAppState === 'resumed' && !document.hidden;
};

/**
 * Manual trigger for app pause (useful for testing)
 */
export const triggerAppPause = () => {
  console.log('🧪 Manually triggering app pause');
  currentAppState = 'paused';
  notifyListeners('paused');
};

/**
 * Manual trigger for app resume (useful for testing)
 */
export const triggerAppResume = () => {
  console.log('🧪 Manually triggering app resume');
  currentAppState = 'resumed';
  notifyListeners('resumed');
};
