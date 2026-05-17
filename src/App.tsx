import { useState, useEffect, useCallback, lazy, Suspense, lazy as preload } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { PublishedWebsite } from '@/components/PublishedWebsite';
import { AuthProvider } from '@/contexts/AuthContext';
import { UserProfileProvider, useUserProfile } from '@/contexts/UserProfileContext';
import { NotificationProvider, useNotification } from '@/contexts/NotificationContext';
import { ReminderAlarmProvider, useReminderAlarm } from '@/contexts/ReminderAlarmContext';
import { AppUpdateProvider } from '@/contexts/AppUpdateContext';
import { LoginPopup } from '@/components/LoginPopup';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SplashScreen } from '@/components/SplashScreen';
import { HamburgerMenu } from '@/components/HamburgerMenu';
import HomePage from '@/components/HomePage';
import { ShopDetailsPage } from '@/components/ShopDetailsPage';
import CheckoutPage from '@/components/CheckoutPage';

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
const UploadVideoPage = lazy(() => import('@/components/UploadVideoPage').then(m => ({ default: m.UploadVideoPage })));

import { BookingModalNew } from '@/components/BookingModalNew';
import { CategoryShopsPage } from '@/components/CategoryShopsPage';
import { ProfileCompletionPopup } from '@/components/ProfileCompletionPopup';
import { ProductDetailsPage } from '@/components/ProductDetailsPage';
import ContactUsPage from '@/components/ContactUsPage';
import TermsConditionsPage from '@/components/TermsConditionsPage';
import RefundPolicyPage from '@/components/RefundPolicyPage';
import { MobileMenuPage } from '@/components/MobileMenuPage';
import type { Shop, Service } from '@/lib/shops-storage';
import type { Category } from '@/types/index';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ReminderToast } from '@/components/ReminderToast';
import { useAuth } from '@/contexts/AuthContext';
import { initializeShops } from '@/lib/shops-storage';
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
  const { isInitializing } = useNotification();
  const { activeReminder, setActiveReminder } = useReminderAlarm();

  // Initialize device back button handler
  useDeviceBackButton({
    onBackPressed: () => {
      console.log('🔙 App-level back navigation to Home');
      navigate('/', { replace: true });
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
      
      // Support both Capacitor format (event.detail.notification.data) and direct data
      const notifData = event.detail?.notification?.data || event.detail?.data || event.detail || {};
      const type = notifData?.type;

      console.log('📱 Notification type:', type, 'data:', notifData);

      switch (type) {
        // Order-related
        case 'order_placed':
        case 'order_update':
        case 'order_action':
          navigate('/orders');
          break;

        // New order for shop owner → go to portal / dashboard
        case 'new_order':
          navigate('/portal');
          break;

        // Video like or comment → go to videos page
        case 'video_like':
        case 'video_comment':
          navigate('/videos');
          break;

        // Global chat message
        case 'broadcast':
          // If it came from global chat, go there
          if (notifData?.route === '/chat') {
            navigate('/chat');
          } else if (notifData?.route === '/bazaar') {
            navigate('/bazaar');
          } else if (notifData?.route && notifData.route !== '/') {
            navigate(notifData.route);
          } else {
            navigate('/');
          }
          break;

        // New shop offer
        case 'new_offer':
          if (notifData?.shop_id) {
            navigate(`/shop/${notifData.shop_id}`);
          } else if (notifData?.route) {
            navigate(notifData.route);
          } else {
            navigate('/bazaar');
          }
          break;

        // Campaign notification
        case 'campaign':
          if (notifData?.shop_id) {
            navigate(`/shop/${notifData.shop_id}`);
          } else {
            navigate('/');
          }
          break;

        // Chat Notifications
        case 'temporary_chat':
          if (notifData?.shopId || notifData?.shop_id) {
            navigate(`/shop/${notifData.shopId || notifData.shop_id}`);
          }
          break;

        case 'world_chat':
          navigate('/chat');
          break;

        case 'profile_chat':
          if (notifData?.profileUserId) {
            navigate(`/profile/${notifData.profileUserId}`);
          } else {
            navigate('/profile?tab=inbox');
          }
          break;

        // Legacy offer type
        case 'offer':
          if (notifData?.shopId) {
            navigate(`/shop/${notifData.shopId}`);
          } else {
            navigate('/bazaar');
          }
          break;

        default:
          // If notification has an explicit route, use it
          if (notifData?.route && notifData.route !== '/') {
            navigate(notifData.route);
          }
          break;
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

      // Alarms and reminders are now handled natively or via FCM
      try {
        console.log('🔔 Notification system initialized');
      } catch (error) {
        console.error('Error initializing notification system:', error);
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
        try {
          const { sendNativeNotification } = await import('@/lib/native-notifications');
          const { supabase } = await import('@/lib/supabase');
          const { data: owners } = await supabase.from('shop_owners').select('user_id').eq('shop_id', reminder.shopId);
          if (owners && owners.length > 0) {
            const ownerIds = owners.map((o: any) => o.user_id).filter(Boolean);
            await sendNativeNotification(ownerIds, {
              title: '✅ Customer Confirmed!',
              body: `Token #${reminder.tokenNumber} - ${reminder.userName} confirmed for ${reminder.timeSlot}.`,
              data: { type: 'booking_confirmed', shop_id: reminder.shopId, route: '/portal' }
            });
          }
        } catch (e) {
          console.warn('Could not notify shop owner of customer confirmation:', e);
        }
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
                onShowLogin={() => setShowLoginPopup(true)}
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
          <Route path="/bazar" element={<HomePage onShowLogin={() => setShowLoginPopup(true)} initialTab="bazar" />} />
          <Route path="/checkout/:productId" element={<CheckoutPage />} />
          <Route path="/upload-video" element={<UploadVideoPage />} />
          <Route path="/contact-us" element={<ContactUsPage />} />
          <Route path="/terms-conditions" element={<TermsConditionsPage />} />
          <Route path="/refund-policy" element={<RefundPolicyPage />} />
          <Route path="/menu" element={<MobileMenuPage />} />
        </Routes>
      </Suspense>
    </div>
  );
}

function isLocalOrPrivateIP(hostname: string): boolean {
  // Localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  // Private IPv4 ranges: 10.x.x.x, 172.16-31.x.x, 192.168.x.x
  if (hostname.startsWith('10.')) return true;
  if (hostname.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;
  return false;
}

function getSubdomain(): string | null {
  const hostname = window.location.hostname;

  // Local development / LAN access (e.g. from phone on WiFi) → no subdomain
  if (isLocalOrPrivateIP(hostname)) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('subdomain');
  }

  // Production check
  const baseDomain = 'donedeals.shop';
  if (hostname.endsWith(baseDomain)) {
    const subdomain = hostname.replace(`.${baseDomain}`, '');
    if (subdomain !== baseDomain && subdomain !== 'www' && subdomain !== 'bookit' && subdomain !== 'database' && subdomain !== 'supabase') {
      // Remove trailing dot if present
      const cleanSub = subdomain.endsWith('.') ? subdomain.slice(0, -1) : subdomain;
      if (cleanSub) return cleanSub;
    }
  }

  // Custom Domain fallback (only for real external hostnames)
  if (hostname !== 'donedeals.shop' && !hostname.endsWith('.donedeals.shop') && !hostname.endsWith('localhost') && !isLocalOrPrivateIP(hostname)) {
    return `custom:${hostname}`;
  }

  return null;
}

function App() {
  const subdomain = getSubdomain();

  if (subdomain) {
    return (
      <ErrorBoundary>
        <PublishedWebsite subdomainProp={subdomain} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <NotificationProvider>
          <AuthProvider>
            <UserProfileProvider>
              <ReminderAlarmProvider>
                <AppUpdateProvider>
                  <AppContentInner />
                </AppUpdateProvider>
              </ReminderAlarmProvider>
            </UserProfileProvider>
          </AuthProvider>
        </NotificationProvider>
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
