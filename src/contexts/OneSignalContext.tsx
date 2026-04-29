import React, { createContext, useContext, useEffect, useState } from 'react';
import { initializeCapacitorOneSignal, isCapacitor } from '@/lib/capacitor-notifications';
import { initializeOneSignal } from '@/lib/onesignal-messaging';

interface OneSignalContextType {
  isInitialized: boolean;
  isInitializing: boolean;
  error: string | null;
}

const OneSignalContext = createContext<OneSignalContextType>({
  isInitialized: false,
  isInitializing: true,
  error: null,
});

export function OneSignalProvider({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const initializeNotifications = async () => {
      const startTime = Date.now();
      const minimumSplashScreenDuration = 3000; // 3 seconds

      try {
        if (!mounted) return;

        console.log('🔔 Starting OneSignal initialization...');

        if (isCapacitor()) {
          console.log('📱 Initializing OneSignal for native (Capacitor) app...');
          await initializeCapacitorOneSignal();
        } else {
          console.log('🌐 Initializing OneSignal for web app...');
          await initializeOneSignal();
        }

        if (!mounted) return;
        console.log('✅ OneSignal initialization complete');
        setIsInitialized(true);
        setError(null);
      } catch (err) {
        if (!mounted) return;

        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('❌ OneSignal initialization failed:', errorMessage);
        setError(errorMessage);
        // Still mark as initialized even on error, so app can continue
        setIsInitialized(true);
      } finally {
        if (!mounted) return;

        // Ensure splash screen is visible for at least 3 seconds
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, minimumSplashScreenDuration - elapsedTime);

        if (remainingTime > 0) {
          setTimeout(() => {
            if (mounted) {
              setIsInitializing(false);
            }
          }, remainingTime);
        } else {
          setIsInitializing(false);
        }
      }
    };

    initializeNotifications().catch((error) => {
      console.error('Uncaught error during OneSignal initialization:', error);
      if (mounted) {
        // Even on error, respect the minimum splash screen duration
        setTimeout(() => {
          if (mounted) {
            setIsInitializing(false);
            setIsInitialized(true);
          }
        }, 3000);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <OneSignalContext.Provider value={{ isInitialized, isInitializing, error }}>
      {children}
    </OneSignalContext.Provider>
  );
}

export function useOneSignal() {
  const context = useContext(OneSignalContext);
  if (!context) {
    throw new Error('useOneSignal must be used within OneSignalProvider');
  }
  return context;
}
