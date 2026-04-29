import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import toast from 'react-hot-toast';

let lastBackPress = 0;
let backPressCount = 0;
let backPressTimeout: NodeJS.Timeout | null = null;

export const initializeBackButton = () => {
  if (!Capacitor.isNativePlatform()) {
    console.log('ℹ️ Web platform detected - back button listener not needed');
    return;
  }

  console.log('🎯 Initializing back button handler...');

  try {
    App.addListener('backButton', async () => {
      console.log('⬅️ Hardware back button pressed');
      console.log(`📊 history.length: ${window.history.length}`);

      // Check if we can go back in history
      if (window.history.length > 1) {
        console.log('↩️ Navigating back in history...');
        window.history.back();
        
        // Reset back press counter
        backPressCount = 0;
        if (backPressTimeout) {
          clearTimeout(backPressTimeout);
          backPressTimeout = null;
        }
      } else {
        // We're at the root - require double press to exit
        const now = Date.now();
        
        if (now - lastBackPress < 2000) {
          // Second press within 2 seconds
          console.log('👋 Double back press detected - exiting app');
          backPressCount = 0;
          if (backPressTimeout) {
            clearTimeout(backPressTimeout);
            backPressTimeout = null;
          }

          try {
            await App.exitApp();
          } catch (error) {
            console.error('Failed to exit app:', error);
          }
        } else {
          // First press or timeout passed
          console.log('📢 First back press at root - waiting for second press');
          backPressCount++;
          lastBackPress = now;

          toast('Press back again to exit', {
            duration: 2000,
            icon: '↩️',
          });

          // Reset counter after 2 seconds
          if (backPressTimeout) {
            clearTimeout(backPressTimeout);
          }
          backPressTimeout = setTimeout(() => {
            console.log('🔄 Back press timeout - resetting counter');
            backPressCount = 0;
            lastBackPress = 0;
            backPressTimeout = null;
          }, 2000);
        }
      }
    }).then(() => {
      console.log('✅ Back button listener successfully registered');
    }).catch((error) => {
      console.error('❌ Failed to register back button listener:', error);
    });
  } catch (error) {
    console.error('❌ Error during back button initialization:', error);
  }
};
