import React, { createContext, useContext, useEffect, useState } from 'react';
import { initializeFcm } from '@/lib/fcm-manager';

interface NotificationContextType {
  isInitialized: boolean;
  isInitializing: boolean;
  error: string | null;
}

const NotificationContext = createContext<NotificationContextType>({
  isInitialized: false,
  isInitializing: true,
  error: null,
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const initializeNotifications = async () => {
      const startTime = Date.now();
      const minimumSplashScreenDuration = 2000; // 2 seconds

      try {
        if (!mounted) return;

        // ── FCM initialization ──
        console.log('🚀 Initializing FCM notification system...');
        await initializeFcm(null);

        if (!mounted) return;
        console.log('✅ Notification initialization complete');

        setIsInitialized(true);
        setError(null);
      } catch (err) {
        if (!mounted) return;

        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('❌ Notification initialization failed:', errorMessage);
        setError(errorMessage);
        setIsInitialized(true); // App must continue
      } finally {
        if (!mounted) return;

        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, minimumSplashScreenDuration - elapsedTime);

        setTimeout(() => {
          if (mounted) {
            setIsInitializing(false);
          }
        }, remainingTime);
      }
    };

    initializeNotifications();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <NotificationContext.Provider value={{ isInitialized, isInitializing, error }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
}

// Transition complete - OneSignal aliases removed
