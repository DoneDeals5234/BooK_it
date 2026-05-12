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
if (Capacitor.isNativePlatform()) {
  App.addListener('backButton', async (data) => {
    console.log('⬅️ Device Back Button Pressed');
    
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
  });

  // Listen for custom "backbutton" event from Kotlin
  document.addEventListener('backbutton', () => {
    App.dispatchEvent('backButton', { canGoBack: true });
  });
}

export const useDeviceBackButton = (options: UseDeviceBackButtonOptions = {}) => {
  const { onBackPressed, onExitAttempt, priority = 0, disabled = false } = options;
  const backPressCountRef = useRef(0);
  const backPressTimerRef = useRef<NodeJS.Timeout>();
  const lastBackPressRef = useRef(0);
  const handlerId = useRef(`handler-${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || disabled) {
      return;
    }

    const currentHandler = async (): Promise<boolean> => {
      const isHome = window.location.pathname === '/';
      
      // 1. Try to handle as a back navigation first if not at home
      // OR if the component explicitly wants to handle back events even at home (e.g. closing a sub-modal)
      if (onBackPressed) {
        // We only call onBackPressed if we're not at home, 
        // OR if the component specifically wants to intercept home-level back presses
        if (!isHome || priority > 0) {
          const result = (onBackPressed as any)();
          // If the handler explicitly returns false, it means it didn't consume the event
          if (result !== false) {
            return true;
          }
        }
      }

      // 2. If at home, handle as an exit attempt
      if (isHome && onExitAttempt) {
        onExitAttempt();
        return true; // Consumed
      }

      // If no handler consumed it and we're not at home, bubble up to default behavior (history.back)
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
      if (backPressTimerRef.current) {
        clearTimeout(backPressTimerRef.current);
      }
    };
  }, [onBackPressed, onExitAttempt, priority, disabled]);
};

// For web browsers
export const useWebBackButton = (onBack: () => void) => {
  useEffect(() => {
    const handlePopState = () => onBack();
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [onBack]);
};
