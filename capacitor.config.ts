import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bookbarber.app',
  appName: 'Book It',
  webDir: 'dist',
  plugins: {
    AlarmScheduler: {
      // AlarmScheduler plugin configuration
    },
  },
};

export default config;
