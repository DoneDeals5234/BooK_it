import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import toast from 'react-hot-toast';

interface UseDeviceBackButtonOptions {
  onBackPressed?: () => void; // Called when navigating back
  onDoubleBackPressed?: () => void; // Called on second consecutive back press (when exiting)
  onExitAttempt?: () => void; // Called when back is pressed on Home (to show dialog)
}

export const useDeviceBackButton = (options: UseDeviceBackButtonOptions = {}) => {
  const backPressCountRef = useRef(0);
  const backPressTimerRef = useRef<NodeJS.Timeout>();
  const lastBackPressRef = useRef(0);

  useEffect(() => {
    // Only add listener on native platforms
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const handleBackAction = async () => {
      console.log('⬅️ Back action triggered');
      
      const isHome = window.location.pathname === '/';
      console.log(`📍 Current Path: ${window.location.pathname}, Is Home: ${isHome}`);

      if (!isHome) {
        // Navigate back in history
        console.log('↩️ Navigating back...');
        
        if (options.onBackPressed) {
          options.onBackPressed();
        } else {
          window.history.back();
        }

        // Reset exit counter
        backPressCountRef.current = 0;
        if (backPressTimerRef.current) {
          clearTimeout(backPressTimerRef.current);
        }
      } else {
        // Handle exit attempt on home
        if (options.onExitAttempt) {
          options.onExitAttempt();
        } else {
          // Fallback to double press logic if no onExitAttempt provided
          const now = Date.now();
          if (backPressCountRef.current === 0) {
            backPressCountRef.current = 1;
            lastBackPressRef.current = now;
            
            toast('Press back again to exit', {
              duration: 2000,
              icon: '↩️',
            });

            backPressTimerRef.current = setTimeout(() => {
              backPressCountRef.current = 0;
            }, 2000);
          } else if (backPressCountRef.current === 1 && now - lastBackPressRef.current < 2000) {
            console.log('👋 Exiting app...');
            options.onDoubleBackPressed?.();
            await App.exitApp();
          }
        }
      }
    };

    // 1. Listen for Capacitor's standard backButton event
    const capacitorListener = App.addListener('backButton', handleBackAction);

    // 2. Listen for our custom "backbutton" event triggered from Kotlin
    // This is crucial because MainActivity.kt overrides the native behavior
    const customListener = (e: any) => {
      handleBackAction();
    };
    document.addEventListener('backbutton', customListener);

    return () => {
      capacitorListener.then(l => l.remove());
      document.removeEventListener('backbutton', customListener);
      if (backPressTimerRef.current) {
        clearTimeout(backPressTimerRef.current);
      }
    };
  }, [options]);
};

// For web browsers, we can also listen to the popstate event
export const useWebBackButton = (onBack: () => void) => {
  useEffect(() => {
    const handlePopState = () => {
      onBack();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [onBack]);
};
