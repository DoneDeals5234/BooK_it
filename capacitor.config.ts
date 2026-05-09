import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bookbarber.app',
  appName: 'Book It',
  webDir: 'dist',
  plugins: {
    OneSignal: {
      appId: '71048c28-503e-49e5-89b1-0de00ccdca4b',
      googleProjectNumber: '1091592092089',
    },
    AlarmScheduler: {
      // AlarmScheduler plugin configuration
      // Plugin is auto-discovered by Capacitor
    },
  },
};

export default config;
