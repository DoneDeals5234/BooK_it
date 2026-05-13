import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import toast from 'react-hot-toast';

interface UseDeviceBackButtonOptions {
  onBackPressed?: () => void; // Called when navigating back
  onDoubleBackPressed?: () => void; // Called on second consecutive back press (when exiting)
  onExitAttempt?: () => void; // Called when back is pressed on Home (to show dialog)
  priority?: number; // Higher priority handlers run first
  disabled?: boolean;
}

// Global stack to keep track of active back button handlers
const handlers: { id: string; priority: number; handler: () => boolean | Promise<boolean> }[] = [];

// Initialize the global listener once
// Register Capacitor listener if available
if (Capacitor.isNativePlatform()) {
  App.addListener('backButton', async (data) => {
    handleBackAction();
  });
}

// Listen for custom "backbutton" event from Kotlin (works in ANY webview)
document.addEventListener('backbutton', () => {
  handleBackAction();
});

// Universal back handler logic
async function handleBackAction() {
  console.log('⬅️ Back Button Pressed (Global Handler)');
  
  // Sort handlers by priority (descending)
  const sortedHandlers = [...handlers].sort((a, b) => b.priority - a.priority);
  
  for (const entry of sortedHandlers) {
    const consumed = await entry.handler();
    if (consumed) {
      console.log(`✅ Back event consumed by handler: ${entry.id}`);
      return; // Stop propagation
    }
  }
  
  // Fallback if no handler consumed the event
  console.log('⚠️ No handler consumed the back event, performing default action');
  if (window.location.pathname !== '/') {
    window.history.back();
  }
}

export const useDeviceBackButton = (options: UseDeviceBackButtonOptions = {}) => {
  const { onBackPressed, onExitAttempt, priority = 0, disabled = false } = options;
  const handlerId = useRef(`handler-${Math.random().toString(36).substr(2, 9)}`);
  
  // Use refs to keep callbacks stable without triggering re-renders of the effect
  const callbacksRef = useRef({ onBackPressed, onExitAttempt });
  
  useEffect(() => {
    callbacksRef.current = { onBackPressed, onExitAttempt };
  }, [onBackPressed, onExitAttempt]);

  useEffect(() => {
    if (disabled) {
      return;
    }

    const currentHandler = async (): Promise<boolean> => {
      // In Capacitor, the root is usually '/' or '/index.html'
      const isHome = window.location.pathname === '/' || window.location.pathname === '/index.html';
      const currentCallbacks = callbacksRef.current;
      
      // 1. Try to handle as a back navigation first if not at home
      if (currentCallbacks.onBackPressed) {
        if (!isHome || priority > 0) {
          const result = (currentCallbacks.onBackPressed as any)();
          if (result !== false) {
            return true;
          }
        }
      }

      // 2. If at home, handle as an exit attempt
      if (isHome && currentCallbacks.onExitAttempt) {
        currentCallbacks.onExitAttempt();
        return true; // Consumed
      }

      // 3. App-level fallback: if we have NO specific handler but we are NOT at home, force go to home
      if (!isHome && priority === 0 && !currentCallbacks.onBackPressed) {
        window.location.href = '/';
        return true;
      }

      return false;
    };

    // Register this handler
    handlers.push({
      id: handlerId.current,
      priority,
      handler: currentHandler
    });

    return () => {
      // Unregister
      const index = handlers.findIndex(h => h.id === handlerId.current);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    };
  }, [priority, disabled]);
};

// For web browsers
export const useWebBackButton = (onBack: () => void) => {
  useEffect(() => {
    const handlePopState = () => onBack();
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [onBack]);
};
