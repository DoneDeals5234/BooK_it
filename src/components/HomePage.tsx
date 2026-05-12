import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Eye, Calendar, Search, Scissors, WifiOff, RefreshCw, Compass, Heart, User, Film, ChevronDown, MessageCircle, Store, ShoppingBag, Sparkles, Star as StarIcon, Heart as HeartIcon, Utensils, Zap, Shirt, Home as HomeIcon, Star, Footprints, ArrowRight, ShoppingBasket, Palette, ShoppingCart } from 'lucide-react';
import { WorldChatModal } from '@/components/WorldChatModal';
import { getShops, isShopCurrentlyOpen } from '@/lib/shops-storage';
import { isTimeSlotRunningNow } from '@/lib/bookings-storage';
import { getAllBookingsFromSupabase } from '@/lib/supabase-bookings';
import { getOrderedShops, clearShopOrderingCache } from '@/lib/shop-ordering';
import { getFavoriteShops, toggleFavoriteShop } from '@/lib/favorite-shops-storage';
import { getReviewsForShop } from '@/lib/supabase-reviews';
import { searchUserProfiles, type UserProfile } from '@/lib/supabase-user-profiles';
import { calculateDistance } from '@/lib/geolocation';
import { AnimatedCreature } from '@/components/AnimatedCreature';
import { StarRating } from '@/components/StarRating';
import { Tab3D } from '@/components/Tab3D';
import BazarTab from '@/components/BazarTab';
import { OffersTab } from '@/components/OffersTab';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import type { Shop } from '@/lib/shops-storage';
import type { Booking } from '@/lib/bookings-storage';
import type { Category } from '@/types/index';
import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { getPlayerIdFromNativeDevices } from '@/lib/supabase-native-devices';
import { getAllCategories } from '@/lib/supabase-categories';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { cacheShops, cacheCategories, getCachedShops, getCachedCategories, invalidateAllCaches } from '@/lib/shops-cache';
import { useDeviceBackButton } from '@/lib/use-device-back-button';

// Alias for consistency
const getCategories = getAllCategories;

export type TabType = 'explore' | 'find' | 'bazar' | 'videos' | 'offers';

interface HomePageProps {
  onShowLogin: () => void;
  initialTab?: TabType;
}

const CATEGORY_IMAGES: Record<string, string> = {
  'salon': 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=200\u0026h=200\u0026fit=crop',
  'parlour': 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=200\u0026h=200\u0026fit=crop',
  'restaurant': 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200\u0026h=200\u0026fit=crop',
  'shoes': 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200\u0026h=200\u0026fit=crop',
  'clothes': 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=200\u0026h=200\u0026fit=crop',
  'cosmetics': 'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=200\u0026h=200\u0026fit=crop',
  'groceries': 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=200\u0026h=200\u0026fit=crop',
  'chemist': 'https://images.unsplash.com/photo-1587854692152-cbe660dbbb88?w=200\u0026h=200\u0026fit=crop',
  'hardware': 'https://images.unsplash.com/photo-1530124566582-aa37dd159a76?w=200\u0026h=200\u0026fit=crop',
  'electrical': 'https://images.unsplash.com/photo-1558444479-285176291c0d?w=200\u0026h=200\u0026fit=crop',
  'food cart': 'https://images.unsplash.com/photo-1565123409695-7b5ef63a2efb?w=200\u0026h=200\u0026fit=crop',
  'bakery': 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=200\u0026h=200\u0026fit=crop',
  'barber': 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=200\u0026h=200\u0026fit=crop',
  'clinic': 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=200\u0026h=200\u0026fit=crop',
  'hospital': 'https://images.unsplash.com/photo-1586773860418-d3b9a8ec817e?w=200\u0026h=200\u0026fit=crop',
  'dentist': 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=200\u0026h=200\u0026fit=crop',
};

export default function HomePage({ onShowLogin, initialTab = 'explore' }: HomePageProps) {
  const navigate = useNavigate();
  const [shops, setShops] = useState<Shop[]>(() => {
    const cachedShops = getCachedShops();
    return cachedShops && cachedShops.length > 0 ? getOrderedShops(cachedShops) : [];
  });
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [categories, setCategories] = useState<Category[]>(() => {
    return getCachedCategories() || [];
  });
  const [loading, setLoading] = useState(() => {
    const cachedShops = getCachedShops();
    return !(cachedShops && cachedShops.length > 0);
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTab, setCurrentTab] = useState<TabType>(initialTab);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [favoriteRefresh, setFavoriteRefresh] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [bazarProducts, setBazarProducts] = useState<any[]>([]);
  const [allOffers, setAllOffers] = useState<any[]>([]);
  const [isBazarLoading, setIsBazarLoading] = useState(false);
  const [isOffersLoading, setIsOffersLoading] = useState(false);
  const [isCatSearching, setIsCatSearching] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [swipeX, setSwipeX] = useState(0);
  const [shopReviews, setShopReviews] = useState<{ [shopId: string]: any[] }>({});
  const [filteredProfiles, setFilteredProfiles] = useState<UserProfile[]>([]);
  const [isSearchingProfiles, setIsSearchingProfiles] = useState(false);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [isWorldChatOpen, setIsWorldChatOpen] = useState(false);
  const locationPromptShownRef = useRef(false);
  const touchStartRef = useRef(0);
  const touchStartXRef = useRef(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const { user: currentUser, userRole } = useAuth();
  const { profile } = useUserProfile();
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    if (currentUser) {
      supabase.from('cart_items').select('id', { count: 'exact' }).eq('user_id', currentUser.uid)
        .then(({ count }) => {
          if (count !== null) setCartCount(count);
        });
    }
  }, [currentUser]);

  // Handle back button for tab navigation
  useDeviceBackButton({
    onBackPressed: () => {
      if (currentTab !== 'explore') {
        setCurrentTab('explore');
        return true; // Consumed
      }
      return false; // Let it bubble to App.tsx for exit dialog
    },
    priority: 10 // Higher than app-level
  });

  // Tab navigation order for swipe
  const tabOrder: TabType[] = ['explore', 'find', 'bazar', 'videos', 'offers'];
  const currentTabIndex = tabOrder.indexOf(currentTab);


  // Handle internet connection status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load initial data and set up subscriptions
  useEffect(() => {
    const loadInitialData = async () => {
      // --- STEP 1: Show cached data INSTANTLY (0ms) ---
      const cachedShops = getCachedShops();
      const cachedCategories = getCachedCategories();
      if (cachedShops && cachedShops.length > 0) {
        setShops(getOrderedShops(cachedShops));
        setCategories(cachedCategories || []);
        setLoading(false); // Hide spinner immediately
      }

      // --- STEP 2: Fetch shops + categories from Supabase (fast, only 2 queries) ---
      try {
        const [shopsData, categoriesData] = await Promise.all([
          getShops(),
          getCategories(),
        ]);
        const orderedShops = getOrderedShops(shopsData);
        setShops(orderedShops);
        setCategories(categoriesData);
        setSelectedCategoryId(null);
        setLoading(false);
        // Save fresh data to cache for next visit
        cacheShops(shopsData);
        cacheCategories(categoriesData);
      } catch (error) {
        console.error('Error loading shops/categories:', error);
        setLoading(false);
      }

      // --- STEP 3: Fetch bookings in BACKGROUND (doesn't block UI) ---
      getAllBookingsFromSupabase().then(supabaseBookings => {
        setBookings(supabaseBookings);
      }).catch(err => console.warn('Error loading bookings:', err));

      // Reviews will be fetched on-demand in the shop details page
      setShopReviews({});
    };

    loadInitialData();

    // Background fetch for Bazar and Offers if not already loaded
    if (currentTab === 'bazar' && bazarProducts.length === 0) {
      // Lazy fetch when user enters Bazar
      // But we could also pre-fetch
    }

    const subscription = supabase
      .channel('bookings-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
        },
        () => {
          getAllBookingsFromSupabase().then((updated) => {
            setBookings(updated);
          });
        }
      )
      .subscribe();

    const shopsSubscription = supabase
      .channel('shops-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shops',
        },
        () => {
          // Clear cache when shops are updated so we recalculate ordering based on new pin status
          clearShopOrderingCache();
          getShops().then((updated) => {
            setShops(getOrderedShops(updated));
          });
        }
      )
      .subscribe();

    const refreshInterval = setInterval(async () => {
      const [shopsData, categoriesData] = await Promise.all([
        getShops(),
        getCategories(),
      ]);
      // Clear cache to recalculate ordering based on current pin status
      clearShopOrderingCache();
      setShops(getOrderedShops(shopsData));
      setCategories(categoriesData);
    }, 60000);

    return () => {
      supabase.removeChannel(subscription);
      supabase.removeChannel(shopsSubscription);
      clearInterval(refreshInterval);
    };
  }, []);

  // Handle pull-to-refresh and horizontal swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0].clientY;
    touchStartXRef.current = e.touches[0].clientX;
    setPullDistance(0);
    setSwipeX(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const currentY = e.touches[0].clientY;
    const currentX = e.touches[0].clientX;
    const distanceY = currentY - touchStartRef.current;
    const distanceX = currentX - touchStartXRef.current;

    // Pull to refresh (vertical)
    if (contentRef.current && contentRef.current.scrollTop === 0 && distanceY > 0 && Math.abs(distanceY) > Math.abs(distanceX)) {
      setPullDistance(Math.min(distanceY, 120));
    }

    // Horizontal swipe preview
    if (Math.abs(distanceX) > Math.abs(distanceY) && Math.abs(distanceX) > 10) {
      setSwipeX(distanceX);
    }
  };

  const handleTouchEnd = async () => {
    // Handle pull to refresh
    if (pullDistance > 60 && !isRefreshing && isOnline) {
      setIsRefreshing(true);
      try {
        // Invalidate cache so we always get fresh data on manual refresh
        invalidateAllCaches();
        clearShopOrderingCache();
        const [updated, shopsData, categoriesData] = await Promise.all([
          getAllBookingsFromSupabase(),
          getShops(),
          getCategories(),
        ]);
        setBookings(updated);
        const orderedShops = getOrderedShops(shopsData);
        setShops(orderedShops);
        setCategories(categoriesData);
        // Save fresh data to cache
        cacheShops(shopsData);
        cacheCategories(categoriesData);
      } catch (error) {
        console.error('Error refreshing data:', error);
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }

    // Handle horizontal swipe to change tabs
    const SWIPE_THRESHOLD = 50;
    if (Math.abs(swipeX) > SWIPE_THRESHOLD) {
      if (swipeX > 0) {
        // Swipe right -> Previous tab
        const newIndex = (currentTabIndex - 1 + tabOrder.length) % tabOrder.length;
        setCurrentTab(tabOrder[newIndex]);
      } else {
        // Swipe left -> Next tab
        const newIndex = (currentTabIndex + 1) % tabOrder.length;
        setCurrentTab(tabOrder[newIndex]);
      }
    }
    setSwipeX(0);
  };

  // Handle tab changes and location prompt
  useEffect(() => {
    if (currentTab === 'videos') {
      navigate('/videos', { replace: true });
    } else if (currentTab === 'find') {
      navigate('/chat', { replace: true });
    } else if (currentTab === 'bazar') {
      navigate('/bazar', { replace: true });
    } else if (currentTab === 'explore') {
      navigate('/', { replace: true });
    }
  }, [currentTab, navigate]);

  // Handle category change loading effect
  useEffect(() => {
    if (selectedCategoryId) {
      setIsCatSearching(true);
      const timer = setTimeout(() => {
        setIsCatSearching(false);
      }, 600); // Smooth loading feel
      return () => clearTimeout(timer);
    }
  }, [selectedCategoryId]);

  // Search for both shops and profiles
  useEffect(() => {
    const handleSearch = async () => {
      if (!searchQuery.trim()) {
        setFilteredProfiles([]);
        setIsSearchingProfiles(false);
        return;
      }

      // Always search for profiles too when there's a search query
      const profiles = await searchUserProfiles(searchQuery);
      setFilteredProfiles(profiles);
      setIsSearchingProfiles(profiles.length > 0);
    };

    handleSearch();
  }, [searchQuery]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden">
        {/* Custom Boy Running Animation Container */}
        <div className="relative flex flex-col items-center justify-center w-64 h-64">
          
          {/* Animated Boy Image with Squash & Stretch to simulate running */}
          <div className="relative z-10 w-48 h-48 drop-shadow-2xl" style={{ animation: 'run-squash 0.35s ease-in-out infinite alternate' }}>
            <img 
              src="/running-boy.png" 
              alt="Loading..." 
              className="w-full h-full object-contain dark:mix-blend-normal origin-bottom"
            />
          </div>

          {/* Treadmill Track / Motion Trails */}
          <div className="absolute bottom-8 w-40 h-2 overflow-hidden flex items-center justify-center opacity-40">
             <div className="flex gap-2 w-[200%] h-1" style={{ animation: 'slide-dots 0.4s linear infinite' }}>
                {Array.from({ length: 15 }).map((_, i) => (
                  <div key={i} className="h-1 w-3 bg-slate-300 dark:bg-slate-700 rounded-full flex-shrink-0"></div>
                ))}
             </div>
          </div>
        </div>

        {/* Loading Text */}
        <h2 className="mt-4 text-xl font-bold text-slate-800 dark:text-slate-200 tracking-wide">
          Loading<span className="loading-dots-text"></span>
        </h2>
      </div>
    );
  }

  // Get filtered shops based on current tab
  const getFilteredShops = () => {
    let filtered = shops;

    // Apply search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      filtered = filtered.filter((shop) => {
        const searchableFields = [
          shop.name || '',
          shop.location || '',
          shop.address || '',
          shop.village || '',
          shop.district || '',
          shop.state || '',
          shop.country || '',
        ];

        return searchableFields.some(field =>
          field.toLowerCase().includes(searchLower)
        );
      });
    }

    // Apply category filter if not searching and not on bazar/offers
    if (selectedCategoryId && !searchQuery && currentTab === 'explore') {
      const selectedCategory = categories.find(c => c.id === selectedCategoryId);
      if (selectedCategory) {
        const categoryName = selectedCategory.name.toLowerCase();
        const categorySlug = (selectedCategory.slug || '').toLowerCase();

        filtered = filtered.filter(shop => {
          const shopCat = (shop.category || '').toLowerCase();
          return shopCat === categoryName ||
            shopCat === categorySlug ||
            shopCat.includes(categoryName) ||
            shopCat.includes(categorySlug);
        });
      }
    }

    // Location-based sorting for explore tab
    if (currentTab === 'explore' && profile?.latitude && profile?.longitude) {
      // Sort shops by distance from user's profile location
      filtered = filtered.sort((a, b) => {
        const distA = calculateDistance(
          profile.latitude!,
          profile.longitude!,
          a.latitude || 0,
          a.longitude || 0
        );
        const distB = calculateDistance(
          profile.latitude!,
          profile.longitude!,
          b.latitude || 0,
          b.longitude || 0
        );
        return distA - distB;
      });
    }

    // Sort by Favorites first
    const favoriteShopIds = getFavoriteShops();
    filtered = [...filtered].sort((a, b) => {
      const isAFav = favoriteShopIds.includes(a.id);
      const isBFav = favoriteShopIds.includes(b.id);
      if (isAFav && !isBFav) return -1;
      if (!isAFav && isBFav) return 1;
      return 0;
    });

    return filtered;
  };

  const filteredShops = getFilteredShops();

  // If videos tab is selected, don't render the shop list here
  if (currentTab === 'videos') {
    return null;
  }

  // Navigation is now handled inline in the main return for state persistence

  return (
    <div className="relative h-screen bg-white dark:bg-slate-950 flex flex-col overflow-hidden">
      {/* Dark Red & White Mashup Background - Base Layer */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden bg-white dark:bg-slate-950">
        {/* Subtle decorative elements for bottom depth */}
        <div className="absolute top-[30%] right-[-10%] w-[60%] h-[40%] bg-red-100/50 dark:bg-red-900/10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-red-50 dark:bg-slate-900/40 rounded-full blur-[80px]"></div>

        {/* Subtle texture */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.02] dark:opacity-[0.01]"></div>
      </div>

      {/* Internet Connection Status Bar */}
      {!isOnline && (
        <div className="fixed top-16 left-0 right-0 z-40 bg-red-500 text-white px-4 py-3 flex items-center gap-2 shadow-lg">
          <WifiOff className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm font-medium">No Internet Connection - Check your connection and refresh</span>
        </div>
      )}

      {/* Pull-to-Refresh Indicator */}
      {pullDistance > 0 && (
        <div className="fixed top-16 left-0 right-0 z-30 bg-gradient-to-b from-primary/20 to-transparent transition-all" style={{ height: `${pullDistance}px` }}>
          {pullDistance > 60 && (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className={`h-5 w-5 text-primary transition-transform ${isRefreshing ? 'animate-spin' : ''}`} />
            </div>
          )}
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={currentTab}
          initial={{ opacity: 0, x: swipeX > 0 ? -20 : 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: swipeX > 0 ? 20 : -20 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          ref={contentRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="relative z-10 container mx-auto px-3 sm:px-4 py-4 sm:py-8 pt-16 sm:pt-20 max-w-2xl flex-1 overflow-y-auto overflow-x-hidden pb-32 no-scrollbar"
          style={{ marginTop: isOnline ? 0 : 40 }}
        >
          {currentTab === 'explore' && (
            <>
              {/* Premium Banner Section */}
              <div className="relative -mx-3 sm:-mx-4 -mt-6 sm:-mt-10 mb-8 rounded-b-[40px] overflow-hidden shadow-2xl h-[220px] sm:h-[300px]">
                <img
                  src="/banner-bg.png"
                  className="absolute inset-0 w-full h-full object-cover"
                  alt="Banner Background"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>

                <div className="relative h-full flex flex-col px-4 sm:px-6 py-6 sm:py-8 justify-end">
                  {/* Search Input - Overlaid on Banner */}
                  <div className="relative group max-w-xl w-full mx-auto mb-2">
                    <div className="absolute inset-0 bg-red-500/10 rounded-full blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity"></div>
                    <div className="relative">
                      <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 h-5 w-5 text-red-500" />
                      <input
                        type="text"
                        placeholder="Search products, brands..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-14 pr-6 py-4 sm:py-5 text-sm sm:text-base rounded-full border-none bg-white shadow-2xl shadow-black/10 focus:ring-4 focus:ring-red-500/10 transition-all font-bold placeholder:text-slate-400 text-slate-900"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Shop Categories Section */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-6 px-1">
                  <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Shop Categories</h2>
                  <button className="flex items-center gap-1 text-[10px] font-black text-red-500 uppercase tracking-widest hover:translate-x-1 transition-transform">
                    See All <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
                <div className="flex gap-4 sm:gap-6 overflow-x-auto no-scrollbar pb-2 snap-x snap-mandatory">
                  {/* "ALL" Category Button */}
                  <button
                    onClick={() => setSelectedCategoryId(null)}
                    className="flex flex-col items-center gap-2 group snap-start shrink-0"
                  >
                    <div className={`h-12 w-12 sm:h-14 sm:w-14 rounded-2xl overflow-hidden flex items-center justify-center transition-all duration-300 relative ${!selectedCategoryId
                      ? 'ring-2 ring-red-500 ring-offset-2 scale-105 shadow-lg'
                      : 'border border-slate-100 dark:border-slate-700 shadow-md shadow-black/5 hover:shadow-lg hover:-translate-y-0.5'
                      }`}>
                      <img 
                        src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=200&h=200&fit=crop" 
                        alt="All" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-widest ${!selectedCategoryId ? 'text-red-500' : 'text-slate-500'}`}>ALL</span>
                  </button>
                  {categories.map((category) => {
                    const categoryLower = category.name.toLowerCase();
                    const imageUrl = CATEGORY_IMAGES[categoryLower] || category.icon || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=200&h=200&fit=crop';
                    
                    return (
                      <button key={category.id} onClick={() => setSelectedCategoryId(category.id)} className="flex flex-col items-center gap-2 group snap-start shrink-0">
                        <div className={`h-12 w-12 sm:h-14 sm:w-14 rounded-2xl overflow-hidden flex items-center justify-center transition-all duration-300 relative ${selectedCategoryId === category.id ? 'ring-2 ring-red-500 ring-offset-2 scale-105 shadow-lg' : 'border border-slate-100 dark:border-slate-700 shadow-md shadow-black/5 hover:shadow-lg hover:-translate-y-0.5'}`}>
                          <img 
                            src={imageUrl} 
                            alt={category.name} 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=200&h=200&fit=crop';
                            }}
                          />
                        </div>
                        <span className={`text-[9px] font-black uppercase tracking-widest ${selectedCategoryId === category.id ? 'text-red-500' : 'text-slate-500'}`}>{category.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Promotional Banner */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 p-6 bg-gradient-to-r from-red-800 to-red-600 rounded-3xl shadow-xl relative overflow-hidden group cursor-pointer">
                <div className="relative z-10">
                  <p className="text-red-100 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">Exclusive Offers</p>
                  <h3 className="text-white text-xl font-black mb-1">Up to 40% OFF</h3>
                  <p className="text-white/80 text-xs mb-4">Selected Premium Items</p>
                  <button className="bg-white text-red-600 px-4 py-1.5 rounded-full text-xs font-black">Shop Now</button>
                </div>
                <Star className="absolute right-6 top-1/2 -translate-y-1/2 h-20 w-20 text-white/10 rotate-12" />
              </motion.div>

              {/* Results List moved to global handler below to avoid duplication */}
            </>
          )}

          {currentTab === 'bazar' && (
            <BazarTab 
              onShowLogin={onShowLogin}
              initialProducts={bazarProducts}
              onProductsLoaded={setBazarProducts}
            />
          )}

          {currentTab === 'offers' && (
            <OffersTab 
              onShopClick={(shopId) => navigate(`/shop/${shopId}`)}
              initialOffers={allOffers}
              onOffersLoaded={setAllOffers}
            />
          )}

          {currentTab === 'videos' && (
             <div className="flex items-center justify-center h-40">Videos coming soon...</div>
          )}


          {!isOnline ? (
            <div className="text-center py-8 sm:py-16">
              <WifiOff className="h-12 sm:h-16 w-12 sm:w-16 mx-auto text-red-400/70 mb-4" />
              <h2 className="text-lg sm:text-2xl font-semibold mb-2 text-red-600 dark:text-red-400">No Internet Connection</h2>
              <p className="text-sm sm:text-base text-muted-foreground mb-6">
                Please check your internet connection and try again.
              </p>
              <Button
                onClick={async () => {
                  setIsRefreshing(true);
                  try {
                    // Clear the ordering cache to randomize on refresh
                    clearShopOrderingCache();
                    const [updated, shopsData, categoriesData] = await Promise.all([
                      getAllBookingsFromSupabase(),
                      getShops(),
                      getCategories(),
                    ]);
                    setBookings(updated);
                    setShops(getOrderedShops(shopsData));
                    setCategories(categoriesData);
                  } catch (error) {
                    console.error('Error refreshing:', error);
                  }
                  setIsRefreshing(false);
                }}
                disabled={!isOnline || isRefreshing}
                className="bg-primary hover:bg-primary/90"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          ) : isCatSearching ? (
            <div className="flex flex-col items-center justify-center py-20 animate-pulse">
              <div className="h-12 w-12 rounded-full border-4 border-red-100 border-t-red-500 animate-spin mb-4" />
              <p className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Finding Best Shops...</p>
            </div>
          ) : (filteredShops.length > 0 || filteredProfiles.length > 0) && searchQuery.trim() ? (
            // Display mixed results - shops first, then profiles
            <div className="space-y-6">
              {/* Display Shops */}
              {filteredShops.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3 px-2">
                    Shops ({filteredShops.length})
                  </h2>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    {filteredShops.map((shop) => {
                      const reviews = shopReviews[shop.id] || [];
                      const averageRating = reviews.length > 0
                        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
                        : 0;
                      const isOpen = shop.isOpen;

                      return (
                        <Card
                          key={shop.id}
                          onClick={() => navigate(`/shop/${shop.id}`)}
                          className="overflow-hidden hover:shadow-xl transition-all duration-300 group flex flex-col bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-md hover:bg-white dark:hover:bg-slate-800 relative cursor-pointer"
                        >
                          {/* Image Section */}
                          <div className="relative w-full h-32 sm:h-40 bg-gradient-to-br from-red-100/50 to-white flex items-center justify-center overflow-hidden flex-shrink-0">
                            {shop.shopImageUrl ? (
                              <img
                                src={shop.shopImageUrl}
                                alt={shop.name}
                                className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                                loading="lazy"
                                decoding="async"
                              />
                            ) : (
                              <Scissors className="h-12 sm:h-16 w-12 sm:w-16 text-red-300 group-hover:scale-110 transition-transform duration-300" />
                            )}

                            {/* Heart Button - Favorite */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavoriteShop(shop.id);
                                setFavoriteRefresh((prev) => prev + 1);
                              }}
                              className="absolute top-2 left-2 p-1.5 bg-white/90 hover:bg-white dark:bg-slate-900/90 dark:hover:bg-slate-900 rounded-full transition-colors shadow-md"
                              title="Add to favorites"
                            >
                              <Heart
                                className={`h-4 w-4 sm:h-5 sm:w-5 transition-colors ${getFavoriteShops().includes(shop.id)
                                  ? 'fill-red-500 text-red-500'
                                  : 'text-gray-600 dark:text-gray-400'
                                  }`}
                              />
                            </button>

                            {/* Status Badge */}
                            <div className="absolute top-2 right-2 px-2 py-1 bg-white/90 dark:bg-slate-900/90 rounded-full text-xs font-medium flex items-center gap-1 shadow-md">
                              <div
                                className={`h-2 w-2 rounded-full ${isOpen ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                                  }`}
                              />
                              <span className={isOpen ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                                {isOpen ? 'Open' : 'Closed'}
                              </span>
                            </div>
                          </div>

                          {/* Content Section */}
                          <CardContent className="p-3 sm:p-4 flex-1 flex flex-col gap-2">
                            <h3 className="font-bold text-sm sm:text-base text-gray-900 dark:text-white line-clamp-2 leading-tight">
                              {shop.name}
                            </h3>

                            <div className="flex items-center gap-1 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                              <MapPin className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                              <span className="line-clamp-1">{shop.location}</span>
                            </div>

                            {averageRating > 0 && (
                              <div className="flex items-center gap-1">
                                <StarRating rating={averageRating} size="sm" />
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  ({reviews.length})
                                </span>
                              </div>
                            )}

                            <div className="mt-auto pt-2 flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 text-xs sm:text-sm h-8 sm:h-9 gap-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/shop/${shop.id}`);
                                }}
                              >
                                <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                                <span>Open</span>
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Display Profiles */}
              {filteredProfiles.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3 px-2">
                    People ({filteredProfiles.length})
                  </h2>
                  <div className="space-y-3">
                    {filteredProfiles.map((profile) => (
                      <Card
                        key={profile.id}
                        onClick={() => navigate(`/profile/${profile.id}`)}
                        className="overflow-hidden hover:shadow-xl transition-all duration-300 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-md hover:bg-white dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <CardContent className="p-4 flex items-center gap-4">
                          {/* Profile Avatar */}
                          <div className="flex-shrink-0">
                            {profile.imageUrl ? (
                              <img
                                src={profile.imageUrl}
                                alt={profile.name}
                                className="h-16 w-16 rounded-full object-cover"
                              />
                            ) : (
                              <div
                                style={{
                                  width: '64px',
                                  height: '64px',
                                  borderRadius: '50%',
                                  backgroundColor: `hsl(${profile.name.charCodeAt(0) * 10}, 70%, 50%)`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'white',
                                  fontSize: '24px',
                                  fontWeight: 'bold',
                                }}
                              >
                                {profile.name[0]?.toUpperCase() || '?'}
                              </div>
                            )}
                          </div>

                          {/* Profile Info */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-base text-gray-900 dark:text-white truncate">
                              {profile.name}
                            </h3>
                            {profile.email && (
                              <p className="text-[10px] text-red-500 font-bold truncate">
                                {profile.email}
                              </p>
                            )}
                            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                              {profile.phone}
                            </p>
                            {profile.address && (
                              <p className="text-xs text-gray-500 dark:text-gray-500 truncate mt-1">
                                {profile.address}
                              </p>
                            )}
                            {profile.state && (
                              <p className="text-xs text-gray-500 dark:text-gray-500">
                                {profile.state}
                              </p>
                            )}
                          </div>

                          {/* View Button */}
                          <Button
                            size="sm"
                            className="bg-red-600 hover:bg-red-700 text-white flex-shrink-0 shadow-md"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/profile/${profile.id}`);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : searchQuery.trim() && filteredShops.length === 0 && filteredProfiles.length === 0 ? (
            // No results found
            <div className="text-center py-8 sm:py-16">
              <div className="mb-4 flex justify-center opacity-60">
                <AnimatedCreature size="lg" color="text-red-400" />
              </div>
              <h2 className="text-lg sm:text-2xl font-semibold mb-2">No Results Found</h2>
              <p className="text-sm sm:text-base text-muted-foreground">
                No shops or users found matching your search. Try different keywords.
              </p>
            </div>
          ) : filteredShops.length === 0 && shops.length > 0 ? (
            <div className="text-center py-8 sm:py-16">
              <div className="mb-4 flex justify-center opacity-60">
                <AnimatedCreature size="lg" color="text-red-400" />
              </div>
              <h2 className="text-lg sm:text-2xl font-semibold mb-2">No Results Found</h2>
              <p className="text-sm sm:text-base text-muted-foreground">
                No shops found. Try searching with shop name or location (city, state, district, address, etc.).
              </p>
            </div>
          ) : shops.length === 0 ? (
            <div className="text-center py-8 sm:py-16">
              <div className="mb-4 flex justify-center opacity-60">
                <AnimatedCreature size="lg" color="text-red-400" />
              </div>
              <h2 className="text-lg sm:text-2xl font-semibold mb-2">No Shops Available</h2>
              <p className="text-sm sm:text-base text-muted-foreground">
                Check back soon! Shops will be added soon.
              </p>
            </div>
          ) : isCatSearching ? (
            <div className="flex flex-col items-center justify-center py-20 animate-pulse">
              <div className="h-12 w-12 rounded-full border-4 border-red-100 border-t-red-500 animate-spin mb-4" />
              <p className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Finding Best Shops...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {filteredShops.map((shop) => {
                const reviews = shopReviews[shop.id] || [];
                const averageRating = reviews.length > 0
                  ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
                  : 0;
                const isOpen = shop.isOpen;

                return (
                  <Card
                    key={shop.id}
                    onClick={() => navigate(`/shop/${shop.id}`)}
                    className="overflow-hidden hover:shadow-xl transition-all duration-300 group flex flex-col bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-md hover:bg-white dark:hover:bg-slate-800 relative cursor-pointer"
                  >
                    {/* Image Section */}
                    <div className="relative w-full h-32 sm:h-40 bg-gradient-to-br from-red-100/50 to-white flex items-center justify-center overflow-hidden flex-shrink-0">
                      {shop.shopImageUrl ? (
                        <img
                          src={shop.shopImageUrl}
                          alt={shop.name}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <Scissors className="h-12 sm:h-16 w-12 sm:w-16 text-red-300 group-hover:scale-110 transition-transform duration-300" />
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavoriteShop(shop.id);
                          setFavoriteRefresh(prev => prev + 1);
                        }}
                        className="absolute top-2 left-2 p-2 rounded-full bg-white/90 dark:bg-slate-800/90 hover:bg-white dark:hover:bg-slate-700 transition-colors shadow-lg z-20"
                        title={getFavoriteShops().includes(shop.id) ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        <Heart
                          className={`h-5 w-5 sm:h-6 sm:w-6 transition-colors ${getFavoriteShops().includes(shop.id)
                            ? 'fill-red-500 text-red-500'
                            : 'text-red-400 hover:text-red-500'
                            }`}
                        />
                      </button>

                      <div className="absolute right-2 top-2 z-20">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${isOpen
                            ? 'bg-green-500 text-white shadow-lg shadow-green-500/50'
                            : 'bg-red-500 text-white shadow-lg shadow-red-500/50'
                            }`}
                        >
                          {isOpen ? 'Open' : 'Closed'}
                        </span>
                      </div>
                    </div>

                    {/* Details Section */}
                    <CardContent className="p-3 sm:p-4 flex-1 flex flex-col justify-between">
                      <div className="space-y-2 sm:space-y-3">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm sm:text-base truncate">{shop.name}</h3>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <span
                              className={`inline-block h-2 w-2 rounded-full ${shop.displayStatus === 'online'
                                ? 'bg-green-500'
                                : shop.displayStatus === 'recently_online'
                                  ? 'bg-yellow-500'
                                  : 'bg-red-500'
                                }`}
                            />
                            <span className="text-xs font-medium text-muted-foreground">
                              {shop.displayStatus === 'online'
                                ? 'online'
                                : shop.displayStatus === 'recently_online'
                                  ? 'away'
                                  : 'offline'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 sm:gap-2 text-muted-foreground">
                          <MapPin className="h-3 sm:h-4 w-3 sm:w-4 flex-shrink-0" />
                          <p className="text-xs sm:text-sm truncate">{shop.location}</p>
                        </div>

                        {averageRating > 0 && (
                          <div className="flex items-center gap-2">
                            <StarRating
                              rating={averageRating}
                              reviewCount={reviews.length}
                              size="sm"
                              showText={true}
                            />
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 mt-3 sm:mt-4">
                        <Button
                          size="sm"
                          className="bg-red-500 hover:bg-red-600 text-white text-xs h-9 flex-1 shadow-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/shop/${shop.id}`);
                          }}
                        >
                          <Calendar className="h-3 w-3 mr-1" />
                          View
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

        </motion.div>
      </AnimatePresence>

      {/* Location Prompt Modal */}
      <AnimatePresence>
        {showLocationPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowLocationPrompt(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                  <MapPin className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  Update Your Location
                </h2>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Please update your location in your profile to see shops near you prioritized by distance.
                </p>
                <div className="flex gap-3 w-full">
                  <Button
                    variant="outline"
                    onClick={() => setShowLocationPrompt(false)}
                    className="flex-1"
                  >
                    Dismiss
                  </Button>
                  <Button
                    onClick={() => {
                      setShowLocationPrompt(false);
                      onShowLogin?.();
                    }}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  >
                    Update Profile
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* World Chat Modal */}
      <WorldChatModal
        isOpen={isWorldChatOpen}
        onClose={() => setIsWorldChatOpen(false)}
        onLoginRequired={() => {
          setIsWorldChatOpen(false);
          onShowLogin?.();
        }}
      />

      {/* 3D Bottom Tab Navigation */}
      <Tab3D
        tabs={[
          {
            id: 'explore',
            label: 'Explore',
            icon: <Compass className="h-7 w-7 sm:h-8 sm:w-8" />,
            iconGradient: 'bg-gradient-to-br from-red-400 to-red-600',
            iconShadowColor: '#ef4444',
          },
          {
            id: 'find',
            label: 'Find',
            icon: <Search className="h-7 w-7 sm:h-8 sm:w-8" />,
            iconGradient: 'bg-gradient-to-br from-red-300 to-red-500',
            iconShadowColor: '#f87171',
          },
          {
            id: 'bazar',
            label: 'Bazar',
            icon: <svg className="h-7 w-7 sm:h-8 sm:w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>,
            iconGradient: 'bg-gradient-to-br from-red-200 to-red-400',
            iconShadowColor: '#fca5a5',
          },
          {
            id: 'videos',
            label: 'Videos',
            icon: <Film className="h-7 w-7 sm:h-8 sm:w-8" />,
            iconGradient: 'bg-gradient-to-br from-red-500 to-red-700',
            iconShadowColor: '#b91c1c',
          },
        ]}
        activeTab={currentTab}
        onChange={setCurrentTab}
      />
    </div>
  );
}
