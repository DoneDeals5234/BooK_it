import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'
import '@/lib/fetch-handler'
import '@/lib/supabase-diagnostic'
import { initializeBackButton } from '@/lib/back-button-init'

// Initialize back button handler as early as possible
console.log('🚀 Initializing app...');
initializeBackButton();

// Register Service Worker for PWA/Caching
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').then(registration => {
      console.log('SW registered: ', registration);
    }).catch(registrationError => {
      console.log('SW registration failed: ', registrationError);
    });
  });
}

// Handle global unhandled errors to prevent crashes during initialization
window.addEventListener('error', (event) => {
  console.error('Global error caught:', event.error);
  // Don't prevent default - let React's error boundary handle it
});

window.addEventListener('unhandledrejection', (event) => {
  // Suppress Firebase initialization errors in native environments
  if (event.reason?.message?.includes('unsupported-browser') ||
      event.reason?.message?.includes('SERVICE_NOT_AVAILABLE') ||
      event.reason?.message?.includes('AUTHENTICATION_FAILED')) {
    console.warn('ℹ️ Suppressing initialization error in native environment:', event.reason?.message);
    event.preventDefault();
  } else {
    console.error('Unhandled promise rejection:', event.reason);
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <Toaster position="top-center" />
  </React.StrictMode>,
)
