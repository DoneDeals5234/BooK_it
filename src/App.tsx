import { useState, useEffect, useCallback, lazy, Suspense, lazy as preload } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { PublishedWebsite } from '@/components/PublishedWebsite';
import { AuthProvider } from '@/contexts/AuthContext';
import { UserProfileProvider, useUserProfile } from '@/contexts/UserProfileContext';
import { OneSignalProvider, useOneSignal } from '@/contexts/OneSignalContext';
import { ReminderAlarmProvider, useReminderAlarm } from '@/contexts/ReminderAlarmContext';
import { AppUpdateProvider } from '@/contexts/AppUpdateContext';
import { LoginPopup } from '@/components/LoginPopup';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SplashScreen } from '@/components/SplashScreen';
import { HamburgerMenu } from '@/components/HamburgerMenu';
import HomePage from '@/components/HomePage';
import { ShopDetailsPage } from '@/components/ShopDetailsPage';

// Lazy load heavy components
import { StaffPortal } from '@/components/StaffPortal';
import { BarberPortal } from '@/components/BarberPortal';
const ProfilePage = lazy(() => import('@/components/ProfilePage').then(m => ({ default: m.ProfilePage })));
const ShortVideosPage = lazy(() => import('@/components/ShortVideosPage'));
const CreateShopPage = lazy(() => import('@/components/CreateShopPage').then(m => ({ default: m.CreateShopPage })));
const WorldChatPage = lazy(() => import('@/components/WorldChatPage'));
const OffersListPage = lazy(() => import('@/components/OffersListPage').then(m => ({ default: m.OffersListPage })));
const CartPage = lazy(() => import('@/components/CartPage'));
const BazarTab = lazy(() => import('@/components/BazarTab'));

import { BookingModalNew } from '@/components/BookingModalNew';
import { CategoryShopsPage } from '@/components/CategoryShopsPage';
import { ProfileCompletionPopup } from '@/components/ProfileCompletionPopup';
import { ProductDetailsPage } from '@/components/ProductDetailsPage';
import type { Shop, Service } from '@/lib/shops-storage';
import type { Category } from '@/types/index';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ReminderToast } from '@/components/ReminderToast';
import { useAuth } from '@/contexts/AuthContext';
import { initializeShops } from '@/lib/shops-storage';
import { setupReminderNotificationHandler, notifyShopOwnersCustomerConfirmed } from '@/lib/onesignal-messaging';
import { deleteBookingFromSupabase } from '@/lib/supabase-bookings';
import { deleteReminder } from '@/lib/local-reminders';
import type { LocalReminder } from '@/lib/local-reminders';
import { Capacitor } from '@capacitor/core';
import { cancelAlarm, getPendingAlarmData, initializeAlarmListener, requestNotificationPermissions, syncHomeState } from '@/lib/alarm-scheduler';
import { migrateShopCategories } from '@/lib/migrate-shop-categories';
import { startShopHeartbeat, stopShopHeartbeat, sendImmediateOnlineUpdate } from '@/lib/shop-heartbeat';
import { initializeAppLifecycle, onAppStateChange } from '@/lib/app-lifecycle';
import { useDeviceBackButton } from '@/lib/use-device-back-button';
import { setupCampaignRealtimeListener } from '@/lib/realtime-campaign-handler';
import { toast } from 'react-hot-toast';

import { App as CapacitorApp } from '@capacitor/app';
import { LogOut } from 'lucide-react';

function AppContentInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);

  const { user, userRole, roleLoading } = useAuth();
  const { profile } = useUserProfile();
  const { isInitializing } = useOneSignal();
  const { activeReminder, setActiveReminder } = useReminderAlarm();

  // Initialize device back button handler
  useDeviceBackButton({
    onBackPressed: () => {
      console.log('🔙 App-level back navigation');
      navigate(-1);
    },
    onExitAttempt: () => {
      setShowExitDialog(true);
    }
  });

  // Initialize app lifecycle
  useEffect(() => {
    initializeAppLifecycle();
  }, []);

  // Initialize campaign realtime listener
  useEffect(() => {
    const cleanup = setupCampaignRealtimeListener();
    return () => {
      cleanup.then(unsub => unsub?.());
    };
  }, []);

  useEffect(() => {
    const isAtHome = location.pathname === '/';
    syncHomeState(isAtHome);
  }, [location.pathname]);

  // Handle push notification clicks for deep linking
  useEffect(() => {
    const handleNotificationClick = (event: any) => {
      console.log('🔔 App-level notification click handler:', event.detail);
      const data = event.detail?.notification?.data;

      if (data && data.type === 'offer' && data.shopId) {
        console.log('🚀 Deep linking to shop offers:', data.shopId);
        navigate(`/shop/${data.shopId}`);
      }
    };

    window.addEventListener('capacitorPushNotificationClick', handleNotificationClick as EventListener);
    return () => {
      window.removeEventListener('capacitorPushNotificationClick', handleNotificationClick as EventListener);
    };
  }, [navigate]);


  // Auto-start heartbeat and foreground service fallback for shop owners when they open the app
  useEffect(() => {
    if (roleLoading || !user) {
      return;
    }

    if (userRole?.type === 'shop_owner' && userRole?.shopId) {
      console.log('🎯 Shop owner detected. Starting auto-heartbeat for shop:', userRole.shopId);
      startShopHeartbeat(userRole.shopId);

      // Listen to app lifecycle changes for immediate status updates
      const unsubscribe = onAppStateChange(async (appState) => {
        if (appState === 'resumed') {
          console.log('📱 App resumed - sending immediate online update');
          try {
            await sendImmediateOnlineUpdate(userRole.shopId);
          } catch (error) {
            console.warn('Failed to send immediate online update:', error);
          }
        }
      });

      return () => {
        unsubscribe?.();
        stopShopHeartbeat();
      };
    } else {
      // Stop heartbeat if user is not a shop owner
      stopShopHeartbeat();
    }
  }, [user, userRole, roleLoading]);

  // Initialize shops on app load
  useEffect(() => {
    (async () => {
      try {
        console.log('📱 Starting app initialization...');
        try {
          await initializeShops();
        } catch (error) {
          console.warn('⚠️ Error initializing shops');
        }
        try {
          await migrateShopCategories();
        } catch (error) {
          console.warn('⚠️ Error migrating shop categories');
        }
      } catch (error) {
        console.error('❌ Critical error during app initialization');
      }

      // Setup reminder notification handler with alarm callback
      try {
        setupReminderNotificationHandler((reminder: LocalReminder) => {
          setActiveReminder(reminder);
        });
      } catch (error) {
        console.error('Error setting up reminder notification handler:', error);
      }

      // Initialize Capacitor Local Notifications for device alarms
      try {
        if (Capacitor.isNativePlatform()) {
          await requestNotificationPermissions();
          await initializeAlarmListener();
        }
      } catch (error) {
        console.error('Error initializing local notifications:', error);
      }

      // Check for pending alarm data
      if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
        try {
          const alarmData = await getPendingAlarmData();
          if (alarmData) {
            const alarmReminder: LocalReminder = {
              id: `${alarmData.bookingId}-alarm-${Date.now()}`,
              userId: user?.uid || '',
              bookingId: alarmData.bookingId,
              reminderTime: alarmData.timeSlot || '',
              bookingDate: new Date().toISOString().split('T')[0],
              shopName: alarmData.shopName || 'Unknown Shop',
              tokenNumber: alarmData.tokenNumber || 0,
              userName: 'User',
              timeSlot: alarmData.timeSlot || 'Unknown Time',
              shopId: '',
              createdAt: Math.floor(Date.now() / 1000),
              scheduledForTimestamp: Math.floor(Date.now() / 1000),
              sent: false,
            };
            setActiveReminder(alarmReminder);
          }
        } catch (error) {
          console.warn('⚠️ Error getting pending alarm data:', error);
        }
      }
    })();
  }, [setActiveReminder, user]);

  // Auto-show login popup when user is not logged in
  useEffect(() => {
    // Only show auto-login on the landing page (Home) and only for guest users
    if (!user && location.pathname === '/') {
      const timer = setTimeout(() => {
        setShowLoginPopup(true);
      }, 1500); // 1.5s delay for smoother experience
      return () => clearTimeout(timer);
    } else {
      setShowLoginPopup(false);
    }
  }, [user, location.pathname]);

  // Handle reminder alarm yes response
  const handleReminderYes = async (reminder: LocalReminder) => {
    try {
      if (reminder.isShopOwnerAlarm) {
        try {
          const { notifyCustomerShopOwnerConfirmed } = await import('@/lib/shop-owner-alarms');
          await notifyCustomerShopOwnerConfirmed(reminder.bookingId, reminder.shopName, reminder.timeSlot, reminder.tokenNumber);
        } catch (error) {
          console.error('⚠️ Error sending customer confirmation notification:', error);
        }
        await cancelAlarm(reminder.bookingId);
      } else {
        await cancelAlarm(reminder.bookingId);
        await notifyShopOwnersCustomerConfirmed(reminder.shopId, reminder.tokenNumber, reminder.userName, reminder.timeSlot, reminder.shopName, '');
      }
      deleteReminder(reminder.id);
      setActiveReminder(null);
    } catch (error) {
      console.error('❌ Error handling reminder yes:', error);
      setActiveReminder(null);
    }
  };

  // Handle reminder alarm no response
  const handleReminderNo = async (reminder: LocalReminder) => {
    try {
      if (reminder.isShopOwnerAlarm) {
        try {
          const { notifyCustomerShopOwnerDenied } = await import('@/lib/shop-owner-alarms');
          await notifyCustomerShopOwnerDenied(reminder.bookingId, reminder.shopName);
        } catch (error) {
          console.error('⚠️ Error sending customer denial notification:', error);
        }
        await deleteBookingFromSupabase(reminder.bookingId);
        await cancelAlarm(reminder.bookingId);
      } else {
        await cancelAlarm(reminder.bookingId);
        await deleteBookingFromSupabase(reminder.bookingId);
      }
      deleteReminder(reminder.id);
      setActiveReminder(null);
    } catch (error) {
      console.error('❌ Error handling reminder no:', error);
      setActiveReminder(null);
    }
  };

  if (isInitializing) {
    return <SplashScreen />;
  }

  return (
    <div className="h-screen overflow-y-auto overflow-x-hidden">
      <LoginPopup open={showLoginPopup} onOpenChange={setShowLoginPopup} />
      <ProfileCompletionPopup onNavigateToProfile={() => navigate('/profile')} />
      <ReminderToast reminder={activeReminder} onYes={handleReminderYes} onNo={handleReminderNo} />


      <ConfirmExitDialog
        open={showExitDialog}
        onOpenChange={setShowExitDialog}
        onConfirm={async () => {
          await CapacitorApp.exitApp();
        }}
      />

      <Suspense fallback={
        <div className="flex items-center justify-center min-h-[60vh] bg-background">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground animate-pulse font-medium">Preparing Space...</p>
          </div>
        </div>
      }>
        <Routes>
          <Route path="/" element={
            <>
              <HamburgerMenu
                onStaffAccess={() => navigate('/staff')}
                onBarberPortal={(tab) => navigate(`/portal${tab ? `?tab=${tab}` : ''}`)}
                onShowLogin={() => setShowLoginPopup(true)}
                onShowProfile={(tab) => navigate(`/profile${tab ? `?tab=${tab}` : ''}`)}
                onCategorySelect={(cat) => navigate(`/category/${cat.id}`)}
                onShowInbox={() => navigate('/profile?tab=inbox')}
              />
              <HomePage
                onShopSelect={(id) => navigate(`/shop/${id}`)}
                onShowLogin={() => setShowLoginPopup(true)}
                onShowProfile={(tab) => navigate(`/profile${tab ? `?tab=${tab}` : ''}`)}
                onShowVideos={() => navigate('/videos')}
              />
            </>
          } />

          <Route path="/staff" element={<StaffPortal onClose={() => navigate('/')} />} />

          <Route path="/portal" element={
            <BarberPortal
              onClose={() => navigate('/')}
              initialTab={(new URLSearchParams(location.search).get('tab') as any) || 'dashboard'}
            />
          } />

          <Route path="/profile" element={
            <ProfilePage
              onClose={() => navigate('/')}
              onShopSelect={(shopId) => navigate(`/shop/${shopId}`)}
              initialTab={(new URLSearchParams(location.search).get('tab') as any) || 'today'}
              openInbox={location.search.includes('tab=inbox') ? 1 : 0}
            />
          } />

          <Route path="/profile/:userId" element={
            <ProfilePage
              onClose={() => navigate('/')}
              onShopSelect={(shopId) => navigate(`/shop/${shopId}`)}
              targetUserId={location.pathname.split('/').pop()}
            />
          } />

          <Route path="/videos" element={<ShortVideosPage onClose={() => navigate('/')} />} />
          <Route path="/chat" element={<WorldChatPage onClose={() => navigate('/')} onShowLogin={() => setShowLoginPopup(true)} />} />

          <Route path="/shop/:shopId" element={
            <ShopDetailsPage
              shopId={location.pathname.split('/').pop() || ''}
              onClose={() => navigate('/')}
              currentUserId={user?.uid}
              currentUserEmail={user?.email || ''}
              currentUserName={profile?.name || user?.displayName || ''}
              shopOwnerEmail={userRole?.type === 'shop_owner' ? user?.email || '' : ''}
              onShowLogin={() => setShowLoginPopup(true)}
            />
          } />

          <Route path="/create-shop" element={<CreateShopPage />} />

          <Route path="/category/:categoryId" element={
            <CategoryShopsPage
              onClose={() => navigate('/')}
              onShopSelect={(id) => navigate(`/shop/${id}`)}
            />
          } />

          <Route path="/product/:productId" element={<ProductDetailsPage />} />
          <Route path="/offers-list" element={<OffersListPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/bazar" element={<BazarTab onShowLogin={() => setShowLoginPopup(true)} />} />
        </Routes>
      </Suspense>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <OneSignalProvider>
          <AuthProvider>
            <UserProfileProvider>
              <ReminderAlarmProvider>
                <AppUpdateProvider>
                  <AppContentInner />
                </AppUpdateProvider>
              </ReminderAlarmProvider>
            </UserProfileProvider>
          </AuthProvider>
        </OneSignalProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

function ConfirmExitDialog({ open, onOpenChange, onConfirm }: { open: boolean, onOpenChange: (open: boolean) => void, onConfirm: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] rounded-3xl p-0 overflow-hidden border-0 shadow-2xl">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm animate-pulse">
              <LogOut className="h-10 w-10 text-white" />
            </div>
          </div>

          <div className="space-y-2">
            <DialogTitle className="text-2xl font-black text-white text-center">Really Exit?</DialogTitle>
            <DialogDescription className="text-slate-300 text-center text-base font-medium">
              Do you really want to close the app? Any unsaved progress might be lost.
            </DialogDescription>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1 h-12 rounded-2xl border-white/20 bg-transparent text-white hover:bg-white/10 font-bold transition-all"
              onClick={() => onOpenChange(false)}
            >
              No, Stay
            </Button>
            <Button
              className="flex-1 h-12 rounded-2xl bg-white text-slate-900 hover:bg-slate-100 font-bold shadow-xl transition-all active:scale-95"
              onClick={onConfirm}
            >
              Yes, Exit
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default App;
