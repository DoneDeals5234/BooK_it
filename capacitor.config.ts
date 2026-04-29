import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bookbarber.app',
  appName: 'bookbarber',
  webDir: 'dist',
  plugins: {
    OneSignal: {
      appId: 'f2c5559b-9e99-4aa0-8924-237469824a88',
      googleProjectNumber: '1091592092089',
    },
    AlarmScheduler: {
      // AlarmScheduler plugin configuration
      // Plugin is auto-discovered by Capacitor
    },
  },
};

export default config;
