import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export interface AppUpdateData {
  id: number;
  current_version: string;
  latest_version: string;
  update_enabled: boolean;
  apk_url: string | null;
  update_message: string;
  created_at: string;
  updated_at: string;
}

interface AppUpdateContextType {
  updateData: AppUpdateData | null;
  loading: boolean;
  error: string | null;
  hasUpdate: boolean;
  localVersion: string;
  refreshUpdateData: () => Promise<void>;
}

const AppUpdateContext = createContext<AppUpdateContextType | undefined>(undefined);

export const useAppUpdate = () => {
  const context = useContext(AppUpdateContext);
  if (!context) {
    throw new Error('useAppUpdate must be used within AppUpdateProvider');
  }
  return context;
};

export const AppUpdateProvider = ({ children }: { children: ReactNode }) => {
  const [updateData, setUpdateData] = useState<AppUpdateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localVersion, setLocalVersion] = useState('0.0.0');

  const fetchUpdateData = async () => {
    try {
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('app_updates')
        .select('*')
        .single();

      if (fetchError) throw fetchError;
      setUpdateData(data);
    } catch (err) {
      console.error('Error fetching app update data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch update data');
    } finally {
      setLoading(false);
    }
  };

  const getLocalVersion = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const info = await CapacitorApp.getInfo();
        if (info?.version) {
          setLocalVersion(info.version);
        }
      } else {
        console.log('Running in web environment, local version remains 0.0.0');
      }
    } catch (e) {
      console.log('Error getting app version:', e);
    }
  };

  const refreshUpdateData = async () => {
    setLoading(true);
    await fetchUpdateData();
    await getLocalVersion();
  };

  useEffect(() => {
    fetchUpdateData();
    getLocalVersion();

    // Subscribe to real-time changes using Supabase v2 API
    const channel = supabase
      .channel('app_updates_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_updates' },
        (payload) => {
          if (payload.new) {
            setUpdateData(payload.new as AppUpdateData);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const hasUpdate =
    updateData !== null &&
    updateData.update_enabled &&
    (localVersion !== updateData.latest_version ||
     (localVersion === '0.0.0' && updateData.update_enabled)); // Allow showing in web preview/dev if enabled

  const value: AppUpdateContextType = {
    updateData,
    loading,
    error,
    hasUpdate,
    localVersion,
    refreshUpdateData,
  };

  return (
    <AppUpdateContext.Provider value={value}>
      {children}
    </AppUpdateContext.Provider>
  );
};
