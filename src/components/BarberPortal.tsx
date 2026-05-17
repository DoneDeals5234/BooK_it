import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Eye,
  Settings,
  EyeOff,
  Bell,
  CheckCircle,
  XCircle,
  Pause,
  Play,
  Phone,
  MessageSquare,
  MapPin,
  Loader2,
  LogOut,
  Globe,
  HelpCircle,
  LayoutDashboard,
  Clock,
  ShoppingBag,
  Tag,
  BookOpen,
  Upload,
  Camera,
  Trash2,
  Plus,
  Palette,
  Megaphone,
  Lock,
  Zap,
  ShoppingCart,
  Video,
  GlobeIcon,
  Book,
  User,
  CreditCard,
  ArrowLeft,
  Edit,
  X,
  Mail,
  Store,
  Package,
  Eraser,
  Sparkles,
  Image as ImageIcon,
  Calendar
} from 'lucide-react';
// import removeBackground from '@imgly/background-removal'; (Using dynamic import instead)
import { getShops, updateShop, getShopById } from '@/lib/shops-storage';
import { getFeaturedProductsByShopId } from '@/lib/supabase-featured-products';
import { formatIST } from '@/lib/utils';
import { SendThoughtModal } from './SendThoughtModal';
import { getLatestPlanForEmail, type ShopOwnerPlan } from '@/lib/supabase-shop-owner-plans';
import { PrintingSettingsPanel } from './PrintingSettingsPanel';
import { fetchUserLocation } from '@/lib/geolocation';
import { shouldShopBeOpen } from '@/lib/shop-hours-helper';
import { getShopBookingsFromSupabase } from '@/lib/supabase-bookings';
import { getPendingOrdersForShop } from '@/lib/supabase-orders';
import { startShopHeartbeat, stopShopHeartbeat, sendImmediateOnlineUpdate } from '@/lib/shop-heartbeat';
import { initializeAppLifecycle, onAppStateChange } from '@/lib/app-lifecycle';
import { useAuth } from '@/contexts/AuthContext';
import { CampaignBuilder } from './campaigns/CampaignBuilder';
import { CampaignHistory } from './campaigns/CampaignHistory';
import { ReceivedCampaignsList } from './campaigns/ReceivedCampaignsList';
import { TimeSlotSettingsPanel } from './TimeSlotSettingsPanel';
import { IncomingBookingRequests } from './IncomingBookingRequests';
import { SimpleBookingManager } from './portal/SimpleBookingManager';
import { ShopCustomizer } from './ShopCustomizer';
import { ShopDetailsPage } from './ShopDetailsPage';
import { VideoRecorder } from './VideoRecorder';
import { WebsiteBuilder } from './WebsiteBuilder';
import { KhataBook } from './KhataBook';
import { OrderRequestsPanel } from './OrderRequestsPanel';
import toast from 'react-hot-toast';
import { notifySuccess } from '@/lib/notification-helper';
import { ProductsTab } from './portal/ProductsTab';
import { useAIImage } from '@/hooks/useAIImage';
import { getAllOffersByShopId, addOffer, updateOffer, deleteOffer } from '@/lib/supabase-offers';
import type { Shop } from '@/lib/shops-storage';
import type { Booking } from '@/lib/bookings-storage';
import type { FeaturedProduct, ShopOffer } from '@/types';
import { useNavigate, useLocation } from 'react-router-dom';

interface BarberPortalProps {
  onClose: () => void;
  initialTab?: 'dashboard' | 'bookings' | 'settings' | 'campaigns' | 'customization' | 'uploads' | 'preview' | 'website' | 'khata-book' | 'orders' | 'campaign-analytics' | 'products' | 'offers';
}

export const BarberPortal = ({ onClose, initialTab = 'dashboard' }: BarberPortalProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Use URL param if available, otherwise fallback to initialTab prop
  const searchParams = new URLSearchParams(location.search);
  const urlTab = searchParams.get('tab') as any;
  const [currentTab, setCurrentTab] = useState<BarberPortalProps['initialTab']>(urlTab || initialTab);

  // Sync tab with URL
  const handleTabChange = (tab: any) => {
    setCurrentTab(tab);
    navigate(`/portal?tab=${tab}`, { replace: true });
  };

  const [step, setStep] = useState<'select-shop' | 'password' | 'portal' | 'error'>('select-shop');
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [password, setPassword] = useState('');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [campaignView, setCampaignView] = useState<'list' | 'create'>('list');
  const [campaignSubTab, setCampaignSubTab] = useState<'sent' | 'received'>('sent');
  const [showWebsiteBuilder, setShowWebsiteBuilder] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [showSendThought, setShowSendThought] = useState(false);

  const getStoreTypeLabel = (plural = false) => {
    const category = selectedShop?.category?.toLowerCase() || '';
    const isServiceBased = ['salon', 'parlour', 'barber', 'hospital', 'dentist', 'clinic'].includes(category);
    if (isServiceBased) return plural ? 'Team Members' : 'Team Member';
    return plural ? 'Staff Members' : 'Staff Member';
  };

  // Settings form states
  const [formData, setFormData] = useState<Partial<Shop>>({});
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<ShopOwnerPlan | null>(null);
  const [newService, setNewService] = useState({ name: '', price: '' });
  const [newBarber, setNewBarber] = useState({ name: '', experience: '', imageUrl: '' });
  const [editingService, setEditingService] = useState<string | null>(null);
  const [editingBarber, setEditingBarber] = useState<string | null>(null);

  const [shopOffers, setShopOffers] = useState<ShopOffer[]>([]);
  const [newOffer, setNewOffer] = useState({ title: '', description: '', discount: '', discountType: 'percentage' as 'percentage' | 'amount', imageUrl: '', validUntil: '' });
  const [editingOffer, setEditingOffer] = useState<string | null>(null);
  const [loadingOffers, setLoadingOffers] = useState(false);

  const [isVideoRecorderOpen, setIsVideoRecorderOpen] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  // Order Requests state
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const {
    isRemovingBackground,
    isGeneratingAIImage,
    aiProgress,
    processRemoveBackground,
    generateAIImage
  } = useAIImage();


  // File upload refs
  const shopImageInputRef = useRef<HTMLInputElement>(null);
  const shopCameraInputRef = useRef<HTMLInputElement>(null);
  const shopVideoInputRef = useRef<HTMLInputElement>(null);
  const shopVideoCameraInputRef = useRef<HTMLInputElement>(null);
  const barberImageInputRef = useRef<HTMLInputElement>(null);
  const barberCameraInputRef = useRef<HTMLInputElement>(null);
  const productImageInputRef = useRef<HTMLInputElement>(null);
  const productCameraInputRef = useRef<HTMLInputElement>(null);
  const offerImageInputRef = useRef<HTMLInputElement>(null);
  const offerCameraInputRef = useRef<HTMLInputElement>(null);
  const interiorImageInputRef = useRef<HTMLInputElement>(null);
  const interiorCameraInputRef = useRef<HTMLInputElement>(null);

  const [uploadMenu, setUploadMenu] = useState<{
    isOpen: boolean;
    type: 'shop' | 'barber' | 'product' | 'offer' | 'video' | 'interior';
  }>({ isOpen: false, type: 'shop' });

  // Touch tracking for swipe gestures
  const [swipeX, setSwipeX] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const { user, userRole, roleLoading, aggregatedData } = useAuth();

  // Touch handlers for swipe detection
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current !== null) {
      const currentX = e.touches[0].clientX;
      setSwipeX(currentX - touchStartX.current);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    touchStartX.current = null;
    setSwipeX(0);
  }, []);

  // Auto-load shop owner's portal if they're logged in as shop owner
  useEffect(() => {
    const initializePortal = async () => {
      setLoading(true);

      // Wait for role to load
      if (roleLoading) {
        return;
      }

      // Check if user is not logged in
      if (!user) {
        setStep('error');
        setLoading(false);
        return;
      }

      // Check if user is a shop owner (from either userRole or aggregatedData)
      const isShopOwner = userRole?.type === 'shop_owner' || aggregatedData?.isShopOwner;
      if (!isShopOwner) {
        setStep('error');
        setLoading(false);
        return;
      }

      // User is a shop owner, load their shop
      try {
        // Try to get shop ID from aggregated data first (more efficient), then from userRole
        const shopId = aggregatedData?.shopOwnerData?.shopId || userRole?.shopId;
        if (!shopId) {
          console.warn('No shop ID found in aggregated data or user role');
          setStep('error');
          setLoading(false);
          return;
        }

        console.log('🏪 Loading shop for owner:', { shopId, userId: user.uid });

        // Try to use shop data from aggregatedData first
        let shopData = aggregatedData?.shopOwnerData?.shop;

        // If not in aggregated data, fetch from database
        if (!shopData) {
          console.log('📂 Fetching shop data from database...');
          shopData = await getShopById(shopId);
        }

        if (!shopData) {
          toast.error('Shop not found');
          setStep('error');
          setLoading(false);
          return;
        }

        console.log('✅ Shop data loaded:', shopData.name);

        // Load bookings for this shop
        const bookingsData = await getShopBookingsFromSupabase(shopId);

        // Load shop offers for the shop
        const offersData = await getAllOffersByShopId(shopId);
        setShopOffers(offersData);

        // Use plan from aggregated data
        if (aggregatedData?.activePlan) {
          console.log('📊 Using plan from aggregated data:', aggregatedData.activePlan.plan_name);
          setCurrentPlan(aggregatedData.activePlan);
        } else {
          const plan = await getLatestPlanForEmail(user.email || '');
          if (plan) {
            console.log('📊 Loaded plan from database:', plan.plan_name);
            setCurrentPlan(plan);
          }
        }

        setSelectedShop(shopData);
        setFormData(shopData);
        setBookings(bookingsData);
        setStep('portal');
      } catch (error) {
        console.error('Error initializing shop owner portal:', error);
        toast.error('Failed to load shop portal');
        setStep('error');
      } finally {
        setLoading(false);
      }
    };

    initializePortal();
  }, [user, userRole, roleLoading, aggregatedData]);

  // Keep the existing shop selection flow for manual access
  const loadShops = async () => {
    const shopsData = await getShops();
    setShops(shopsData);
  };

  useEffect(() => {
    // Only load shops list if not a shop owner (for staff/admin access)
    if (!roleLoading && userRole?.type !== 'shop_owner') {
      loadShops();
    }
  }, [roleLoading, userRole?.type]);

  // Initialize app lifecycle and set up listeners
  useEffect(() => {
    initializeAppLifecycle();
  }, []);

  // Start/stop heartbeat when portal is opened/closed, and listen to app state changes
  useEffect(() => {
    if (step === 'portal' && selectedShop) {
      console.log('🎯 Starting layered heartbeat for shop:', selectedShop.id);
      startShopHeartbeat(selectedShop.id);

      // Start/stop Native Foreground Service for Shop Owners based on status
      if (typeof window !== 'undefined' && (window as any).AlarmBridge) {
        if (selectedShop.isOpen) {
          console.log('🟢 Triggering Native ShopOnlineService (Shop is OPEN)');
          (window as any).AlarmBridge.startShopOnlineService();
        } else {
          console.log('🔴 Stopping Native ShopOnlineService (Shop is CLOSED)');
          (window as any).AlarmBridge.stopShopOnlineService();
        }
      }

      // Layer 3: Listen to app lifecycle changes for immediate status updates
      const unsubscribe = onAppStateChange(async (appState) => {
        if (appState === 'resumed') {
          console.log('📱 App resumed - sending immediate online update');
          try {
            await sendImmediateOnlineUpdate(selectedShop.id);
          } catch (error) {
            console.warn('Failed to send immediate online update:', error);
          }
        } else if (appState === 'paused') {
          console.log('📱 App paused - owner may be offline soon');
          // Note: We don't immediately mark as offline because app might still be running
        }
      });

      return () => {
        unsubscribe?.();
      };
    } else {
      console.log('Stopping heartbeat');
      stopShopHeartbeat();
    }

    return () => {
      // Stop heartbeat when component unmounts
      stopShopHeartbeat();
    };
  }, [step, selectedShop?.id]);

  // Load pending orders count
  useEffect(() => {
    if (selectedShop?.id && step === 'portal') {
      const loadPendingOrders = async () => {
        try {
          setLoadingOrders(true);
          const pendingOrders = await getPendingOrdersForShop(selectedShop.id);
          setPendingOrdersCount(pendingOrders.length);
        } catch (error) {
          console.error('Error loading pending orders:', error);
        } finally {
          setLoadingOrders(false);
        }
      };

      loadPendingOrders();
      // Reload orders every 10 seconds (as fallback)
      const interval = setInterval(loadPendingOrders, 10000);
      return () => clearInterval(interval);
    }
  }, [selectedShop?.id, step]);

  // Realtime Order Listener for instant "Ringing" (Option 2)
  useEffect(() => {
    if (step === 'portal' && selectedShop?.id) {
      console.log('📡 Subscribing to real-time orders for shop:', selectedShop.id);
      
      const channel = supabase
        .channel(`public:orders:shop_id=${selectedShop.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'orders',
            filter: `shop_id=eq.${selectedShop.id}`
          },
          (payload) => {
            console.log('🔔 REAL-TIME ORDER DETECTED!', payload);
            
            // 🚨 TRICK: Trigger Native Alarm Bridge for instant ringing
            if (typeof window !== 'undefined' && (window as any).AlarmBridge) {
              console.log('🚨 Triggering native alarm bridge via Realtime...');
              try {
                // Check if shop is open before ringing (as per user request)
                if (selectedShop.isOpen) {
                  const orderId = payload.new.id;
                  
                  // Method 1: Standard alarm
                  if ((window as any).AlarmBridge.testAlarm) {
                    (window as any).AlarmBridge.testAlarm(orderId, 1);
                  }
                  
                  // Method 2: High-priority notification with sound (more reliable)
                  if ((window as any).AlarmBridge.sendImportantNotification) {
                    (window as any).AlarmBridge.sendImportantNotification({
                      title: 'New Order! 🛍️',
                      body: `Order #${payload.new.order_code || orderId.slice(0,6)} received!`,
                      bookingId: orderId,
                      orderId: orderId
                    });
                  }
                } else {
                  console.log('🔇 Shop is closed, skipping alarm');
                }
              } catch (e) {
                console.error('Failed to trigger native alarm via Realtime:', e);
              }
            }
            
            // Refresh order count
            setPendingOrdersCount(prev => prev + 1);
            toast.success('New Order Received! 🛍️', { duration: 6000 });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [step, selectedShop?.id, selectedShop?.isOpen]);

  const handleShopSelect = (shop: Shop) => {
    setSelectedShop(shop);
    setPassword('');
    setStep('password');
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedShop) return;

    if (password === selectedShop.password) {
      setLoading(true);
      try {
        const bookingsData = await getShopBookingsFromSupabase(selectedShop.id);
        setBookings(bookingsData);
        // Auto-fill location from localStorage if shop doesn't have one saved
        const shopDataWithLocation = { ...selectedShop };
        if (!shopDataWithLocation.location && !shopDataWithLocation.address) {
          try {
            const savedLocation = localStorage.getItem('last_shop_location');
            if (savedLocation) {
              const loc = JSON.parse(savedLocation);
              Object.assign(shopDataWithLocation, loc);
            }
          } catch { }
        }
        setFormData(shopDataWithLocation);

        setStep('portal');
        setPassword('');
      } catch (error) {
        console.error('Error loading bookings:', error);
        toast.error('Failed to load bookings');
      } finally {
        setLoading(false);
      }
    } else {
      toast.error('Incorrect password');
      setPassword('');
    }
  };

  const handleAddService = () => {
    if (!newService.name || !newService.price) {
      toast.error('Please fill in all service details');
      return;
    }

    const services = [...(formData.services || []), { id: Date.now().toString(), ...newService }];
    setFormData({ ...formData, services });
    setNewService({ name: '', price: '' });
    toast.success('Service added');
  };

  const handleRemoveService = (serviceId: string) => {
    const services = (formData.services || []).filter((s) => s.id !== serviceId);
    setFormData({ ...formData, services });
    toast.success('Service removed');
  };

  const handleAddBarber = () => {
    if (!newBarber.name || !newBarber.experience) {
      toast.error(`Please fill in all ${getCategoryName().toLowerCase()} details`);
      return;
    }

    const barberMembers = [...(formData.barberMembers || []), { id: Date.now().toString(), ...newBarber }];
    setFormData({ ...formData, barberMembers });
    setNewBarber({ name: '', experience: '', imageUrl: '' });
    toast.success(`${getCategoryName()} added`);
  };

  const handleRemoveBarber = async (barberId: string) => {
    const barberMembers = (formData.barberMembers || []).filter((b) => b.id !== barberId);
    setFormData({ ...formData, barberMembers });
    await handleSaveSettings({ ...formData, barberMembers });
    toast.success(`${getCategoryName()} removed`);
  };

  const showLocalNotification = (message: string) => {
    toast.custom((t) => (
      <div
        className={`${t.visible ? 'animate-enter' : 'animate-leave'
          } max-w-md w-full bg-white dark:bg-slate-900 shadow-xl rounded-2xl pointer-events-auto flex ring-1 ring-black ring-opacity-5 overflow-hidden border-2 border-red-500`}
      >
        <div className="flex-1 w-0 p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0 pt-0.5">
              <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center overflow-hidden rotate-[-5deg]">
                <span className="text-white font-black text-[10px] leading-tight text-center rotate-[25deg]">
                  BOOK<br />IT
                </span>
              </div>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                Update Saved
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                {message}
              </p>
            </div>
          </div>
        </div>
        <div className="flex border-l border-slate-200 dark:border-slate-800">
          <button
            onClick={() => toast.dismiss(t.id)}
            className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-bold text-red-600 hover:text-red-500 focus:outline-none"
          >
            Close
          </button>
        </div>
      </div>
    ), { duration: 3000, position: 'bottom-center' });
  };

  const handleSaveSettings = async (dataToSave = formData) => {
    if (!selectedShop) return;

    setIsAutoSaving(true);
    try {
      const updated = await updateShop(selectedShop.id, dataToSave);
      if (updated) {
        setSelectedShop(updated);
        setFormData(updated);
        showLocalNotification('Your changes have been saved automatically');
      }
    } catch (error) {
      console.error('Error auto-saving settings:', error);
    } finally {
      setIsAutoSaving(false);
    }
  };

  const handleFieldBlur = () => {
    handleSaveSettings();
  };

  const handleEditProduct = (product: FeaturedProduct) => {
    setEditingProduct(product.id);
    setNewFeaturedProduct({
      title: product.title,
      price: product.price.toString(),
      originalPrice: product.originalPrice?.toString() || '',
      discountPercentage: product.discountPercentage?.toString() || '',
      category: product.category || '',
      imageUrl: product.imageUrl,
      inventory: product.inventory?.toString() || ''
    });
    // Scroll to form
    const formElement = document.getElementById('product-form');
    if (formElement) formElement.scrollIntoView({ behavior: 'smooth' });
  };

  const handleAddFeaturedProduct = async () => {
    if (!selectedShop || !newFeaturedProduct.title || !newFeaturedProduct.price) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setLoadingProducts(true);
      const { supabase } = await import('@/lib/supabase');

      const { data, error } = await supabase
        .from('featured_products')
        .insert({
          shop_id: selectedShop.id,
          title: newFeaturedProduct.title,
          price: parseFloat(newFeaturedProduct.price),
          image_url: newFeaturedProduct.imageUrl || 'https://images.unsplash.com/photo-1506484381205-f7945653044d?w=400',
          original_price: newFeaturedProduct.originalPrice ? parseFloat(newFeaturedProduct.originalPrice) : null,
          discount_percentage: newFeaturedProduct.discountPercentage ? parseInt(newFeaturedProduct.discountPercentage) : null,
          category: newFeaturedProduct.category || 'other',
          inventory: newFeaturedProduct.inventory ? parseInt(newFeaturedProduct.inventory) : null
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const product: FeaturedProduct = {
          id: data.id,
          shopId: data.shop_id,
          title: data.title,
          price: data.price,
          imageUrl: data.image_url,
          originalPrice: data.original_price,
          discountPercentage: data.discount_percentage,
          category: data.category,
          inventory: data.inventory,
          isActive: data.is_active ?? true,
          displayOrder: data.display_order ?? 0,
          createdAt: data.created_at ? new Date(data.created_at) : new Date(),
          updatedAt: data.updated_at ? new Date(data.updated_at) : new Date(),
        };
        setFeaturedProducts([...featuredProducts, product]);
        setNewFeaturedProduct({ title: '', price: '', originalPrice: '', discountPercentage: '', category: '', imageUrl: '', inventory: '' });
        toast.success('Product added successfully!');
      }
    } catch (error) {
      console.error('Error adding product:', error);
      toast.error('Failed to add product');
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleUpdateFeaturedProduct = async () => {
    if (!selectedShop || !editingProduct || !newFeaturedProduct.title || !newFeaturedProduct.price) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setLoadingProducts(true);
      const { supabase } = await import('@/lib/supabase');

      const { data, error } = await supabase
        .from('featured_products')
        .update({
          title: newFeaturedProduct.title,
          price: parseFloat(newFeaturedProduct.price),
          image_url: newFeaturedProduct.imageUrl,
          original_price: newFeaturedProduct.originalPrice ? parseFloat(newFeaturedProduct.originalPrice) : null,
          discount_percentage: newFeaturedProduct.discountPercentage ? parseInt(newFeaturedProduct.discountPercentage) : null,
          category: newFeaturedProduct.category,
          inventory: newFeaturedProduct.inventory ? parseInt(newFeaturedProduct.inventory) : null
        })
        .eq('id', editingProduct)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const updatedProduct: FeaturedProduct = {
          id: data.id,
          shopId: data.shop_id,
          title: data.title,
          price: data.price,
          imageUrl: data.image_url,
          originalPrice: data.original_price,
          discountPercentage: data.discount_percentage,
          category: data.category,
          inventory: data.inventory,
          isActive: data.is_active ?? true,
          displayOrder: data.display_order ?? 0,
          createdAt: data.created_at ? new Date(data.created_at) : new Date(),
          updatedAt: data.updated_at ? new Date(data.updated_at) : new Date(),
        };
        setFeaturedProducts(featuredProducts.map(p => p.id === editingProduct ? updatedProduct : p));
        setEditingProduct(null);
        setNewFeaturedProduct({ title: '', price: '', originalPrice: '', discountPercentage: '', category: '', imageUrl: '', inventory: '' });
        toast.success('Product updated successfully!');
      }
    } catch (error) {
      console.error('Error updating product:', error);
      toast.error('Failed to update product');
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleDeleteFeaturedProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      const { supabase } = await import('@/lib/supabase');
      const { error } = await supabase
        .from('featured_products')
        .delete()
        .eq('id', productId);

      if (error) throw error;

      setFeaturedProducts(featuredProducts.filter((p) => p.id !== productId));
      toast.success('Featured product deleted successfully!');
    } catch (error) {
      console.error('Error deleting featured product:', error);
      toast.error('Failed to delete featured product');
    }
  };

  // Shop Offers Handlers
  const handleAddOffer = async () => {
    if (!selectedShop || !newOffer.title || !newOffer.discount || !newOffer.validUntil) {
      toast.error('Please fill in all required offer fields (title, discount, valid until)');
      return;
    }

    try {
      const discountValue = parseFloat(newOffer.discount);
      const discountPercentage = newOffer.discountType === 'percentage' ? discountValue : undefined;
      const discountAmount = newOffer.discountType === 'amount' ? discountValue : undefined;

      const result = await addOffer(
        selectedShop.id,
        newOffer.title,
        new Date(newOffer.validUntil),
        newOffer.imageUrl || undefined,
        newOffer.description || undefined,
        discountPercentage,
        discountAmount
      );

      if (result) {
        setShopOffers([...shopOffers, result]);
        setNewOffer({ title: '', description: '', discount: '', discountType: 'percentage', imageUrl: '', validUntil: '' });
        toast.success('Offer added successfully!');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add offer';
      console.error('Error adding offer:', error);
      toast.error(errorMessage);
    }
  };

  const handleDeleteOffer = async (offerId: string) => {
    if (!confirm('Are you sure you want to delete this offer?')) return;

    try {
      await deleteOffer(offerId);
      setShopOffers(shopOffers.filter((o) => o.id !== offerId));
      toast.success('Offer deleted successfully!');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete offer';
      console.error('Error deleting offer:', error);
      toast.error(errorMessage);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, imageType: 'shop' | 'barber' | 'product' | 'offer' | 'interior') => {
    const file = e.target.files?.[0];
    if (file) {
      const toastId = toast.loading('Processing image...');
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        let updatedData = { ...formData };

        if (imageType === 'shop') {
          updatedData.shopImageUrl = base64String;
          setFormData(updatedData);
          await handleSaveSettings(updatedData);
        } else if (imageType === 'barber') {
          setNewBarber({ ...newBarber, imageUrl: base64String });
        } else if (imageType === 'product') {
          setNewFeaturedProduct({ ...newFeaturedProduct, imageUrl: base64String });
        } else if (imageType === 'offer') {
          setNewOffer({ ...newOffer, imageUrl: base64String });
        } else if (imageType === 'interior') {
          const interiorImages = [...(formData.interiorImages || []), base64String];
          updatedData.interiorImages = interiorImages;
          setFormData(updatedData);
          await handleSaveSettings(updatedData);
        }

        toast.dismiss(toastId);
        showLocalNotification(`${imageType.charAt(0).toUpperCase() + imageType.slice(1)} image updated`);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveInteriorImage = async (index: number) => {
    const interiorImages = (formData.interiorImages || []).filter((_, i) => i !== index);
    const updatedData = { ...formData, interiorImages };
    setFormData(updatedData);
    await handleSaveSettings(updatedData);
    toast.success('Interior image removed');
  };

  const handleVideoUpload = async (file: File | Blob) => {
    if (!selectedShop) return;

    setUploadingVideo(true);
    const toastId = toast.loading('Uploading video...');

    try {
      const { supabase } = await import('@/lib/supabase');
      const fileName = `shop_interior_${selectedShop.id}_${Date.now()}.webm`;
      const filePath = `shop_videos/${fileName}`;

      const { data, error: uploadError } = await supabase.storage
        .from('videos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(filePath);

      setFormData({ ...formData, shopInteriorVideoUrl: publicUrl });
      notifySuccess('Video uploaded successfully!', 'Shop Gallery');
    } catch (error) {
      console.error('Error uploading video:', error);
      toast.error('Failed to upload video', { id: toastId });
    } finally {
      setUploadingVideo(false);
    }
  };

  const getCategoryName = () => {
    const category = formData.category || selectedShop?.category || 'shop';
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  const handleToggleShopOpen = async () => {
    if (!selectedShop || !user?.uid) return;

    try {
      // Update shop status in database
      const updated = await updateShop(selectedShop.id, { isOpen: !selectedShop.isOpen });
      if (updated) {
        setSelectedShop(updated);

        // Show detailed feedback to owner
        if (updated.isOpen) {
          notifySuccess('Shop is now OPEN', 'Shop Status');

          // Start native service if shop is now open
          if ((window as any).AlarmBridge) {
            (window as any).AlarmBridge.startShopOnlineService();
          }
        } else {
          notifySuccess('Shop is now CLOSED', 'Shop Status');

          // Stop native service if shop is now closed
          if ((window as any).AlarmBridge) {
            (window as any).AlarmBridge.stopShopOnlineService();
          }
        }
      }
    } catch (error) {
      console.error('Error toggling shop status:', error);
      toast.error('Failed to update shop status');
    }
  };

  const handleToggleTokenBooking = async () => {
    if (!selectedShop) return;

    const updated = await updateShop(selectedShop.id, { tokenBookingPaused: !selectedShop.tokenBookingPaused });
    if (updated) {
      setSelectedShop(updated);
      notifySuccess(updated.tokenBookingPaused ? 'Token booking paused' : 'Token booking resumed', 'Booking Status');
    }
  };

  const handleToggleTokenBookingFacility = async () => {
    if (!selectedShop) return;

    const updated = await updateShop(selectedShop.id, { isTokenBookingEnabled: !selectedShop.isTokenBookingEnabled });
    if (updated) {
      setSelectedShop(updated);
      notifySuccess(updated.isTokenBookingEnabled ? 'Booking token facility enabled' : 'Booking token facility disabled', 'Facility Update');
    }
  };

  const handleCall = (phoneNumber: string) => {
    window.location.href = `tel:${phoneNumber}`;
  };

  const isTabRestricted = (tab: string) => {
    const freeTabs = ['dashboard', 'settings']; // Bookings tab is visible but locked
    const basicTabs = ['dashboard', 'bookings', 'settings', 'website', 'khata-book'];
    const planName = currentPlan?.plan_name || 'free';

    // Check if website builder is disabled by admin
    if (tab === 'website' && selectedShop?.isWebsiteBuilderEnabled === false) {
      return true;
    }

    // FREE plan has limited access
    if (planName === 'free') {
      return !freeTabs.includes(tab);
    }

    // BASIC plan has standard access
    return planName === 'basic' && !basicTabs.includes(tab);
  };

  const getFilteredProducts = (searchQuery: string, activeCategory: string) => {
    let filtered = featuredProducts;
    if (searchQuery) {
      filtered = filtered.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    if (activeCategory) {
      filtered = filtered.filter(p => (p.category || 'other') === activeCategory);
    }
    return filtered;
  };

  const generateGoogleMapsLink = (latitude?: number, longitude?: number): string | null => {
    const lat = latitude ?? formData.latitude;
    const lon = longitude ?? formData.longitude;
    if (lat && lon) {
      return `https://www.google.com/maps?q=${lat},${lon}`;
    }
    return null;
  };

  const handleCoordinatesChange = (latitude?: number, longitude?: number) => {
    setFormData({
      ...formData,
      latitude: latitude ?? formData.latitude,
      longitude: longitude ?? formData.longitude,
    });
  };

  const handleGetLocation = async () => {
    setGettingLocation(true);
    try {
      const location = await fetchUserLocation();
      const updatedData = {
        ...formData,
        location: location.formattedAddress,
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.formattedAddress,
        village: location.village || null,
        district: location.district || null,
        state: location.state || null,
        country: location.country || null,
      };
      setFormData(updatedData);

      // Persist to local storage
      localStorage.setItem('last_shop_location', JSON.stringify({
        location: location.formattedAddress,
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.formattedAddress,
        village: location.village || null,
        district: location.district || null,
        state: location.state || null,
        country: location.country || null,
      }));

      toast.success('Location captured successfully!');
    } catch (error) {
      console.error('Error getting location:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to get your location');
    } finally {
      setGettingLocation(false);
    }
  };

  const fetchProfileLocationToShop = async () => {
    if (!user?.uid) return;
    setGettingLocation(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.uid)
        .single();

      if (profile) {
        let found = false;
        const updates: any = {};

        if (profile.address) {
          updates.address = profile.address;
          updates.location = profile.address;
          found = true;
        }
        if (profile.latitude && profile.longitude) {
          updates.latitude = profile.latitude;
          updates.longitude = profile.longitude;
          updates.locationMapLink = `https://www.google.com/maps?q=${profile.latitude},${profile.longitude}`;
          found = true;
        } else if (profile.google_map_link) {
          updates.locationMapLink = profile.google_map_link;
          found = true;
        }

        if (found) {
          setFormData({ ...formData, ...updates });
          toast.success('Location fetched from your profile! 👤');
        } else {
          toast.error('No address or coordinates found in your profile.');
        }
      }
    } catch (err) {
      console.error('Error fetching profile location:', err);
      toast.error('Failed to fetch profile location');
    } finally {
      setGettingLocation(false);
    }
  };

  const handleLogout = () => {
    setStep('select-shop');
    setSelectedShop(null);
    setPassword('');
    setBookings([]);
  };

  // Error screen - shown when user is not a shop owner
  if (step === 'error') {
    return (
      <div className="h-screen bg-gradient-to-b from-background to-muted/20 p-3 sm:p-6 flex flex-col overflow-hidden">
        <div className="w-full max-w-md mx-auto flex-1 overflow-y-auto flex flex-col justify-center">
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Access Denied</CardTitle>
              <CardDescription>You don't have access to the Owner Portal</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                The Owner Portal is only available for shop owners. If you are a shop owner, please log in with your shop owner account.
              </p>
              <Button variant="outline" onClick={onClose} className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go Back
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (step === 'select-shop') {
    return (
      <div className="h-screen bg-gradient-to-b from-background to-muted/20 p-3 sm:p-6 flex flex-col overflow-hidden">
        <div className="w-full space-y-6 flex-1 overflow-y-auto">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="ghost" size="icon" onClick={onClose}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-3xl font-bold">{getCategoryName()} Portal</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">Select your shop</p>
            </div>
          </div>

          {loading ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-muted-foreground">Loading shops...</p>
              </CardContent>
            </Card>
          ) : shops.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-muted-foreground">No shops found. Please add a shop first.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {shops.map((shop) => (
                <Card
                  key={shop.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handleShopSelect(shop)}
                >
                  <CardHeader>
                    <CardTitle className="text-lg truncate">{shop.name}</CardTitle>
                    <CardDescription className="truncate">{shop.location}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full">
                      <Lock className="mr-2 h-4 w-4" />
                      Access Portal
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (step === 'password') {
    return (
      <div className="h-screen bg-gradient-to-b from-background to-muted/20 p-3 sm:p-6 flex flex-col overflow-hidden">
        <div className="w-full max-w-md mx-auto flex-1 overflow-y-auto flex flex-col justify-center">
          <div className="flex items-center gap-2 sm:gap-4 mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setStep('select-shop');
                setSelectedShop(null);
                setPassword('');
              }}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold">Enter Password</h1>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">{selectedShop?.name}</p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Portal Access</CardTitle>
              <CardDescription>Enter your owner portal password to access</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="portal-password">Password</Label>
                  <Input
                    id="portal-password"
                    type="password"
                    placeholder="Enter portal password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1" disabled={loading}>
                    {loading ? 'Loading...' : 'Access'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setStep('select-shop');
                      setSelectedShop(null);
                      setPassword('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative h-screen bg-white dark:bg-slate-950 flex flex-col overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Premium White Header */}
      <div className="bg-white dark:bg-slate-950 px-4 pt-6 pb-4 border-b border-slate-100 dark:border-slate-900 sticky top-0 z-30">
        <div className="flex flex-col gap-6">
          {/* Top Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/')}
                className="hover:bg-slate-100 rounded-xl text-slate-600"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase leading-none">Portal</h1>
                <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mt-1">{selectedShop?.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleLogout}
                className="h-9 px-4 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 gap-2"
                size="sm"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
              <Button
                variant="outline"
                className="h-9 px-4 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 gap-2"
                size="sm"
                onClick={() => navigate('/help')}
              >
                <HelpCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Help</span>
              </Button>
            </div>
          </div>

          {/* Tab Navigation - Scaled Desktop Style for Mobile */}
          <div className="flex flex-nowrap items-center gap-1 sm:gap-2 pb-2 no-scrollbar overflow-x-auto">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: <Eye className="h-3 w-3 sm:h-4 sm:w-4" /> },
              { id: 'bookings', label: 'Bookings', icon: <Bell className="h-3 w-3 sm:h-4 sm:w-4" />, hidden: selectedShop?.isTokenBookingEnabled === false },
              { id: 'orders', label: 'Orders', icon: <ShoppingCart className="h-3 w-3 sm:h-4 sm:w-4" /> },
              { id: 'products', label: 'Products', icon: <Package className="h-3 w-3 sm:h-4 sm:w-4" /> },
              { id: 'offers', label: 'Offers', icon: <Zap className="h-3 w-3 sm:h-4 sm:w-4" /> },
              { id: 'settings', label: 'Settings', icon: <Settings className="h-3 w-3 sm:h-4 sm:w-4" /> },
              { id: 'campaigns', label: 'Campaigns', icon: <Megaphone className="h-3 w-3 sm:h-4 sm:w-4" />, restricted: isTabRestricted('campaigns') },
              { id: 'customization', label: 'Design', icon: <Palette className="h-3 w-3 sm:h-4 sm:w-4" />, restricted: isTabRestricted('customization') },
              { id: 'uploads', label: 'Uploads', icon: <Upload className="h-3 w-3 sm:h-4 sm:w-4" />, restricted: isTabRestricted('uploads') },
              { id: 'preview', label: 'Preview', icon: <Eye className="h-3 w-3 sm:h-4 sm:w-4" />, restricted: isTabRestricted('preview') },
              { id: 'website', label: 'Website', icon: <GlobeIcon className="h-3 w-3 sm:h-4 sm:w-4" />, restricted: isTabRestricted('website') },
              { id: 'khata-book', label: 'Khata', icon: <Book className="h-3 w-3 sm:h-4 sm:w-4" />, restricted: isTabRestricted('khata-book') },
            ].filter(tab => !tab.hidden).map((tab) => {
              const isActive = currentTab === tab.id;
              return (
                <Button
                  key={tab.id}
                  variant={isActive ? 'default' : 'ghost'}
                  onClick={() => {
                    if (tab.restricted) {
                      toast.error('This feature is restricted to the PRO plan.', { icon: '🔒' });
                      return;
                    }
                    handleTabChange(tab.id as any);
                    if (tab.id === 'campaigns') setCampaignView('list');
                  }}
                  className={`flex items-center gap-1 sm:gap-2 h-7 sm:h-10 px-2 sm:px-4 rounded-lg shrink-0 transition-all ${isActive
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                    } ${tab.restricted ? 'opacity-50' : ''}`}
                >
                  <div className="relative">
                    {tab.icon}
                    {tab.restricted && <Lock className="absolute -top-1 -right-1 h-2 w-2 text-red-500" />}
                  </div>
                  <span className="text-[8px] sm:text-xs font-bold whitespace-nowrap">{tab.label}</span>
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="w-full flex-1 overflow-y-auto px-4 py-6 bg-slate-50/50">
        <div className="max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentTab}
              initial={{ opacity: 0, x: swipeX > 0 ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: swipeX > 0 ? 20 : -20 }}
              transition={{ duration: 0.2 }}
            >
              {currentTab === 'dashboard' && (
                <>
                  <div className="mb-4 rounded-lg overflow-hidden bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-900">
                    <div className="p-3 sm:p-8">
                      <div className="flex flex-row items-start gap-3 sm:gap-6">
                        {/* Shop Image */}
                        {selectedShop?.shopImageUrl && (
                          <div className="flex-shrink-0">
                            <img
                              src={selectedShop.shopImageUrl}
                              alt={selectedShop.name}
                              className="w-16 h-16 sm:w-40 sm:h-40 object-cover rounded-lg shadow-md"
                            />
                          </div>
                        )}

                        {/* Shop Info */}
                        <div className="flex-1 text-left min-w-0">
                          {/* Shop Name */}
                          <h1 className="text-sm sm:text-5xl font-black text-gray-900 dark:text-white truncate">
                            {selectedShop?.name}
                          </h1>

                          {/* Category Badge */}
                          {selectedShop?.category && (
                            <div className="flex justify-start gap-1 mt-1 mb-2">
                              <span className="inline-block px-2 py-0.5 bg-blue-600 text-white rounded-full text-[8px] sm:text-sm font-bold capitalize shadow-sm">
                                {selectedShop.category}
                              </span>
                            </div>
                          )}

                          {/* Additional Info */}
                          {selectedShop?.about && (
                            <p className="text-gray-600 dark:text-gray-300 text-[8px] sm:text-base leading-tight line-clamp-2 max-w-2xl">
                              {selectedShop.about}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Side-by-Side Scaled Cards (PC Format on Mobile) */}
                  <div className="grid grid-cols-2 gap-2 sm:gap-4">
                    <Card className={`shadow-none border-0 overflow-hidden ${selectedShop?.isOpen ? 'bg-green-50/50' : 'bg-red-50/50'}`}>
                      <CardHeader className="p-2 pb-1">
                        <CardTitle className="text-[10px] font-black uppercase tracking-tighter flex items-center gap-1">
                          {selectedShop?.isOpen ? '🟢 Open' : '🔴 Closed'}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-2 pt-0 space-y-1.5">
                        <div className="flex flex-col gap-0.5">
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Status</p>
                          <div className="flex items-center justify-between gap-1">
                            <p className={`font-black text-xs ${selectedShop?.isOpen ? 'text-green-600' : 'text-red-600'}`}>
                              {selectedShop?.isOpen ? 'OPEN' : 'CLOSED'}
                            </p>
                            <Button
                              variant={selectedShop?.isOpen ? 'destructive' : 'default'}
                              className="h-6 px-1.5 text-[8px] font-bold rounded-md"
                              onClick={handleToggleShopOpen}
                            >
                              {selectedShop?.isOpen ? 'Close' : 'Open'}
                            </Button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-1.5 bg-white/50 rounded-lg">
                          <span className="font-bold text-[8px] uppercase">Token Facility</span>
                          <Switch
                            className="scale-75"
                            checked={selectedShop?.isTokenBookingEnabled !== false}
                            onCheckedChange={handleToggleTokenBookingFacility}
                          />
                        </div>

                        <div className="flex items-center justify-between p-1.5 bg-white/50 rounded-lg">
                          <div className="flex flex-col">
                            <span className="font-bold text-[8px] uppercase">Booking</span>
                            <span className={`text-[8px] font-bold ${selectedShop?.tokenBookingPaused ? 'text-orange-600' : 'text-green-600'}`}>
                              {selectedShop?.tokenBookingPaused ? 'Paused' : 'Active'}
                            </span>
                          </div>
                          <button
                            onClick={handleToggleTokenBooking}
                            className={`p-1 rounded-md ${selectedShop?.tokenBookingPaused ? 'bg-orange-600 text-white' : 'bg-slate-200 text-slate-600'}`}
                          >
                            {selectedShop?.tokenBookingPaused ? <Play className="h-2.5 w-2.5" /> : <Pause className="h-2.5 w-2.5" />}
                          </button>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="shadow-none border-0 bg-slate-50/50">
                      <CardHeader className="p-2 pb-1">
                        <CardTitle className="text-[10px] font-black uppercase tracking-tighter text-slate-400">Quick Stats</CardTitle>
                      </CardHeader>
                      <CardContent className="p-2 pt-0 space-y-1.5">
                        <div className="flex items-center justify-between p-1.5 bg-white rounded-lg">
                          <span className="font-bold text-[9px] text-slate-500">Total</span>
                          <span className="text-xs font-black text-indigo-600">{bookings.length}</span>
                        </div>
                        <div className="flex items-center justify-between p-1.5 bg-white rounded-lg">
                          <span className="font-bold text-[9px] text-slate-500">Pending</span>
                          <span className="text-xs font-black text-orange-600">{bookings.filter((b) => b.status === 'pending').length}</span>
                        </div>
                        <div className="flex items-center justify-between p-1.5 bg-white rounded-lg">
                          <span className="font-bold text-[9px] text-slate-500">Active</span>
                          <span className="text-xs font-black text-blue-600">{bookings.filter((b) => b.status === 'in-progress').length}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Order Requests Card */}
                  <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20">
                    <CardHeader className="pb-3 sm:pb-4">
                      <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                        📋 Order Requests
                      </CardTitle>
                      <CardDescription>Manage customer orders</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Pending Orders</p>
                          <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">{pendingOrdersCount}</p>
                        </div>
                        {loadingOrders ? (
                          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                        ) : (
                          <ShoppingCart className="h-12 w-12 text-orange-400 opacity-30" />
                        )}
                      </div>
                      <Button
                        onClick={() => setCurrentTab('orders')}
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                      >
                        View All Orders
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Premium Quick Access Tools Dashboard */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                      <div>
                        <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                          <div className="bg-indigo-600 p-1.5 rounded-lg shadow-lg shadow-indigo-200">
                            <LayoutDashboard className="h-4 w-4 text-white" />
                          </div>
                          Quick Access Tools
                        </h3>
                        <p className="text-[10px] sm:text-xs text-slate-400 font-medium">Manage your shop operations from a central hub</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 p-1">
                      {[
                        { id: 'bookings', label: 'Requests', sub: 'Manage bookings', icon: <Clock className="h-5 w-5" />, color: 'from-blue-500 to-indigo-600', glow: 'shadow-blue-200', bg: 'bg-blue-50/50' },
                        { id: 'orders', label: 'Orders', sub: 'Track sales', icon: <ShoppingBag className="h-5 w-5" />, color: 'from-orange-400 to-red-500', glow: 'shadow-orange-200', bg: 'bg-orange-50/50' },
                        { id: 'products', label: 'Products', sub: 'Manage inventory', icon: <Package className="h-5 w-5" />, color: 'from-emerald-400 to-teal-600', glow: 'shadow-emerald-200', bg: 'bg-emerald-50/50' },
                        { id: 'offers', label: 'Offers', sub: 'Discount deals', icon: <Tag className="h-5 w-5" />, color: 'from-rose-400 to-pink-600', glow: 'shadow-rose-200', bg: 'bg-rose-50/50' },
                        { id: 'campaigns', label: 'Campaigns', sub: 'Send alerts', icon: <Megaphone className="h-5 w-5" />, color: 'from-purple-500 to-fuchsia-600', glow: 'shadow-purple-200', bg: 'bg-purple-50/50' },
                        { id: 'khata-book', label: 'Khata', sub: 'Ledger book', icon: <BookOpen className="h-5 w-5" />, color: 'from-indigo-500 to-blue-700', glow: 'shadow-indigo-200', bg: 'bg-indigo-50/50' },
                        { id: 'website', label: 'Website', sub: 'Online store', icon: <Globe className="h-5 w-5" />, color: 'from-cyan-400 to-blue-500', glow: 'shadow-cyan-200', bg: 'bg-cyan-50/50' },
                        { id: 'customization', label: 'Design', sub: 'Visual look', icon: <Palette className="h-5 w-5" />, color: 'from-pink-400 to-rose-500', glow: 'shadow-pink-200', bg: 'bg-pink-50/50' },
                        { id: 'uploads', label: 'Uploads', sub: 'Gallery media', icon: <Upload className="h-5 w-5" />, color: 'from-slate-500 to-slate-700', glow: 'shadow-slate-200', bg: 'bg-slate-50/50' },
                        { id: 'preview', label: 'Preview', sub: 'Customer view', icon: <Eye className="h-5 w-5" />, color: 'from-teal-400 to-emerald-500', glow: 'shadow-teal-200', bg: 'bg-teal-50/50' },
                        { id: 'settings', label: 'Settings', sub: 'Portal config', icon: <Settings className="h-5 w-5" />, color: 'from-gray-500 to-slate-600', glow: 'shadow-gray-200', bg: 'bg-gray-50/50' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setCurrentTab(item.id as any)}
                          className={`group relative flex flex-col items-center justify-center p-4 rounded-[24px] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 transition-all duration-300 hover:z-10 hover:-translate-y-1 hover:shadow-2xl ${item.glow} active:scale-95 overflow-hidden h-32 sm:h-36`}
                        >
                          {/* Inner Shine Effect */}
                          <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                          {/* Circular Icon Bubble */}
                          <div className={`mb-3 relative w-12 h-12 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center text-white shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300`}>
                            <div className="absolute inset-0 rounded-2xl bg-white/20 blur-[2px]" />
                            <div className="relative z-10">{item.icon}</div>
                          </div>

                          {/* Label & Subtitle */}
                          <div className="text-center">
                            <span className="block text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 tracking-tight leading-none group-hover:text-indigo-600 transition-colors">
                              {item.label}
                            </span>
                            <span className="block text-[9px] sm:text-[10px] font-medium text-slate-400 mt-1 line-clamp-1 leading-tight">
                              {item.sub}
                            </span>
                          </div>

                          {/* Border Glow on Hover */}
                          <div className={`absolute inset-0 border-2 border-transparent group-hover:border-indigo-500/10 rounded-[24px] transition-colors pointer-events-none`} />
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {currentTab === 'bookings' && selectedShop && (
                <div className="space-y-4 sm:space-y-6 pb-6">
                  {currentPlan?.plan_name === 'free' ? (
                    <Card className="border-amber-200 bg-amber-50">
                      <CardContent className="pt-6">
                        <div className="text-center space-y-4">
                          <div className="flex justify-center">
                            <Lock className="h-12 w-12 text-amber-600" />
                          </div>
                          <h3 className="text-lg font-bold text-amber-900">Booking Requests Locked</h3>
                          <p className="text-sm text-amber-800">
                            This feature is only available in the BASIC plan and above. Upgrade to access booking requests and manage your customer bookings.
                          </p>
                          <Button
                            onClick={() => toast.error('Please upgrade to BASIC plan to access bookings')}
                            className="bg-amber-600 hover:bg-amber-700"
                          >
                            <Zap className="mr-2 h-4 w-4" />
                            Upgrade to BASIC
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <SimpleBookingManager
                      shopId={selectedShop.id}
                    />
                  )}
                </div>
              )}

              {currentTab === 'orders' && selectedShop && (
                <div className="space-y-4 sm:space-y-6 pb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Order Requests</h2>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Manage customer orders and requests</p>
                    </div>
                  </div>
                  <OrderRequestsPanel shopId={selectedShop.id} />
                </div>
              )}

              {currentTab === 'settings' && (
                <div className="space-y-4 sm:space-y-6 pb-6">
                  {/* Basic Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg sm:text-2xl">Basic Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 sm:space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-4">
                        <div>
                          <Label htmlFor="shop-name" className="text-xs sm:text-sm">Shop Name</Label>
                          <Input
                            id="shop-name"
                            value={formData.name || ''}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            onBlur={handleFieldBlur}
                            placeholder="Enter shop name"
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1 sm:mb-2">
                            <Label htmlFor="shop-location" className="text-xs sm:text-sm">Location</Label>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[10px] px-2 text-primary"
                              onClick={handleGetLocation}
                              disabled={gettingLocation}
                            >
                              {gettingLocation ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <MapPin className="h-3 w-3 mr-1" />}
                              Detect
                            </Button>
                          </div>
                          <Input
                            id="shop-location"
                            value={formData.location || ''}
                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                            onBlur={handleFieldBlur}
                            placeholder="Enter shop location"
                            className="text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="shop-about">About Shop</Label>
                        <textarea
                          id="shop-about"
                          value={formData.about || ''}
                          onChange={(e) => setFormData({ ...formData, about: e.target.value })}
                          onBlur={handleFieldBlur}
                          placeholder="Describe your shop"
                          className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                          rows={4}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Contact Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg sm:text-2xl">Contact Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 sm:space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-4">
                        <div>
                          <Label htmlFor="owner-name" className="text-xs sm:text-sm">Owner Name</Label>
                          <Input
                            id="owner-name"
                            value={formData.ownerName || ''}
                            onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                            onBlur={handleFieldBlur}
                            placeholder="Enter owner name"
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <Label htmlFor="owner-email" className="text-xs sm:text-sm">Email</Label>
                          <Input
                            id="owner-email"
                            type="email"
                            value={formData.ownerEmail || ''}
                            onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                            onBlur={handleFieldBlur}
                            placeholder="Enter email"
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <Label htmlFor="owner-phone" className="text-xs sm:text-sm">Primary Phone Number</Label>
                          <Input
                            id="owner-phone"
                            value={formData.ownerPhone || ''}
                            onChange={(e) => setFormData({ ...formData, ownerPhone: e.target.value })}
                            onBlur={handleFieldBlur}
                            placeholder="Enter primary phone number"
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <Label htmlFor="alt-phone" className="text-xs sm:text-sm">Alternative Phone Number (Optional)</Label>
                          <Input
                            id="alt-phone"
                            value={(formData as any).alternativePhone || ''}
                            onChange={(e) => setFormData({ ...formData, alternativePhone: e.target.value } as any)}
                            onBlur={handleFieldBlur}
                            placeholder="Enter alternative phone number"
                            className="text-sm"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Printing Service Settings */}
                  <PrintingSettingsPanel shopId={selectedShop.id} />

                  {/* Advance Payment Settings */}
                  <Card>
                    <CardContent className="pt-6">
                      <div className="pt-0 space-y-4">
                        <h4 className="font-bold text-slate-800 flex items-center gap-2">
                          <CreditCard className="h-4 w-4" />
                          Advance Payment Settings
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="upi-id" className="text-xs sm:text-sm">UPI ID (for receiving payments)</Label>
                            <Input
                              id="upi-id"
                              value={formData.upiId || ''}
                              onChange={(e) => setFormData({ ...formData, upiId: e.target.value })}
                              onBlur={handleFieldBlur}
                              placeholder="e.g. shopname@okicici"
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <Label htmlFor="advance-payment-mode" className="text-xs sm:text-sm">Advance Payment Mode</Label>
                            <select
                              id="advance-payment-mode"
                              value={formData.advancePaymentMode || 'none'}
                              onChange={(e) => {
                                const updated = { ...formData, advancePaymentMode: e.target.value as any };
                                setFormData(updated);
                                handleSaveSettings(updated);
                              }}
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <option value="none">No Advance Payment (OFF)</option>
                              <option value="optional">Optional Advance Payment</option>
                              <option value="compulsory">Compulsory Advance Payment</option>
                            </select>
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground italic">
                          If enabled, customers will be asked to pay advance via UPI for Shop Pickup orders.
                        </p>
                      </div>
                    </CardContent>
                  </Card>


                  {/* Images */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg sm:text-2xl">Images</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 sm:space-y-6">
                      {/* Shop Image */}
                      <div className="space-y-3">
                        <Label className="text-xs sm:text-sm">Shop Image</Label>
                        <div className="flex gap-4 items-start">
                          <div className="flex-1">
                            {formData.shopImageUrl ? (
                              <div className="relative inline-block group">
                                <img
                                  src={formData.shopImageUrl}
                                  alt="Shop"
                                  className={`h-24 w-24 sm:h-40 sm:w-40 object-cover rounded border-2 border-primary transition-all duration-300 ${(isRemovingBackground || isGeneratingAIImage) ? 'blur-[2px] grayscale-[0.5]' : ''}`}
                                />

                                {/* Targeted Loading Overlay */}
                                {(isRemovingBackground || isGeneratingAIImage) && (
                                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 rounded border-2 border-transparent backdrop-blur-[1px] z-10">
                                    <div className="relative h-10 w-10 sm:h-14 sm:h-14">
                                      <svg className="h-full w-full rotate-[-90deg]">
                                        <circle
                                          cx="50%"
                                          cy="50%"
                                          r="40%"
                                          stroke="currentColor"
                                          strokeWidth="4"
                                          fill="transparent"
                                          className="text-white/20"
                                        />
                                        <circle
                                          cx="50%"
                                          cy="50%"
                                          r="40%"
                                          stroke="currentColor"
                                          strokeWidth="4"
                                          fill="transparent"
                                          strokeDasharray="100%"
                                          strokeDashoffset={`${100 - aiProgress}%`}
                                          className="text-primary transition-all duration-300"
                                        />
                                      </svg>
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-[8px] sm:text-[10px] font-black text-white">{aiProgress}%</span>
                                      </div>
                                    </div>
                                    <span className="text-[6px] sm:text-[8px] font-black uppercase tracking-tighter text-white mt-1 text-center px-1">
                                      {isRemovingBackground ? 'Removing BG...' : 'AI Generating...'}
                                    </span>
                                  </div>
                                )}

                                {!isRemovingBackground && !isGeneratingAIImage && (
                                  <button
                                    type="button"
                                    onClick={() => setUploadMenu({ isOpen: true, type: 'shop' })}
                                    className="absolute bottom-2 right-2 bg-primary text-primary-foreground p-1 sm:p-2 rounded-full hover:bg-primary/90 transition-colors shadow-lg"
                                  >
                                    <Camera className="h-3 w-3 sm:h-4 sm:w-4" />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setUploadMenu({ isOpen: true, type: 'shop' })}
                                className="flex flex-col items-center justify-center w-24 h-24 sm:w-40 sm:h-40 border-2 border-dashed border-muted-foreground rounded hover:border-primary transition-colors relative"
                                disabled={isGeneratingAIImage}
                              >
                                {isGeneratingAIImage ? (
                                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-purple-50/50 rounded">
                                    <Loader2 className="h-6 w-6 text-purple-600 animate-spin" />
                                    <span className="text-[10px] font-bold text-purple-700 mt-1">{aiProgress}%</span>
                                  </div>
                                ) : (
                                  <>
                                    <Camera className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground mb-1 sm:mb-2" />
                                    <span className="text-xs sm:text-sm text-muted-foreground">Upload</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>

                          {/* AI Buttons for Shop Image */}
                          <div className="flex flex-col gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 sm:h-9 text-[10px] font-black uppercase border-purple-200 text-purple-600 hover:bg-purple-50"
                              onClick={async () => {
                                const generated = await generateAIImage(formData.name || 'Shop', 'Store front');
                                if (generated) {
                                  const updated = { ...formData, shopImageUrl: generated };
                                  setFormData(updated);
                                  handleSaveSettings(updated);
                                }
                              }}
                              disabled={isGeneratingAIImage || !formData.name}
                            >
                              <Sparkles className="mr-1 h-3 w-3" />
                              AI Gen
                            </Button>
                            {formData.shopImageUrl && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 sm:h-9 text-[10px] font-black uppercase border-red-200 text-red-600 hover:bg-red-50"
                                onClick={async () => {
                                  const processed = await processRemoveBackground(formData.shopImageUrl!);
                                  if (processed) {
                                    const updated = { ...formData, shopImageUrl: processed };
                                    setFormData(updated);
                                    handleSaveSettings(updated);
                                  }
                                }}
                                disabled={isRemovingBackground}
                              >
                                <Eraser className="mr-1 h-3 w-3" />
                                No BG
                              </Button>
                            )}
                          </div>
                        </div>
                        <input
                          ref={shopImageInputRef}
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageUpload(e, 'shop')}
                          className="hidden"
                        />
                        <input
                          ref={shopCameraInputRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => handleImageUpload(e, 'shop')}
                          className="hidden"
                        />
                      </div>

                      {/* Shop Interior Video */}
                      <div className="space-y-3 pt-4 border-t">
                        <Label className="text-xs sm:text-sm font-semibold flex items-center gap-2">
                          <Video className="h-4 w-4 text-primary" />
                          Shop Interior Video
                        </Label>
                        <p className="text-xs text-muted-foreground">Show customers what your shop looks like from inside</p>

                        <div className="space-y-4">
                          {formData.shopInteriorVideoUrl ? (
                            <div className="relative rounded-lg overflow-hidden border bg-black aspect-video max-w-md">
                              <video
                                src={formData.shopInteriorVideoUrl}
                                className="w-full h-full object-contain"
                                controls
                              />
                              <div className="absolute top-2 right-2 flex gap-2">
                                <Button
                                  size="icon"
                                  variant="secondary"
                                  className="h-8 w-8 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/40 border-none"
                                  onClick={() => setIsVideoRecorderOpen(true)}
                                >
                                  <Camera className="h-4 w-4 text-white" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="destructive"
                                  className="h-8 w-8 rounded-full"
                                  onClick={() => setFormData({ ...formData, shopInteriorVideoUrl: null })}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <Button
                                variant="outline"
                                className="h-24 sm:h-32 flex flex-col gap-2 border-dashed"
                                onClick={() => setUploadMenu({ isOpen: true, type: 'video' })}
                                disabled={uploadingVideo}
                              >
                                <Video className="h-6 w-6 text-muted-foreground" />
                                <span className="text-xs sm:text-sm">Manage Video</span>
                              </Button>
                            </div>
                          )}

                          <input
                            ref={shopVideoInputRef}
                            type="file"
                            accept="video/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleVideoUpload(file);
                            }}
                            className="hidden"
                          />
                          <input
                            ref={shopVideoCameraInputRef}
                            type="file"
                            accept="video/*"
                            capture="environment"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleVideoUpload(file);
                            }}
                            className="hidden"
                          />
                        </div>
                      </div>

                      {/* Auto-detect Location */}
                      <div className="space-y-3">
                        <Label className="mb-2 block text-xs sm:text-sm">Auto-detect Location</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            onClick={handleGetLocation}
                            disabled={gettingLocation}
                            className="flex-1"
                            variant="outline"
                          >
                            {gettingLocation ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <MapPin className="mr-2 h-4 w-4" />
                                Auto GPS
                              </>
                            )}
                          </Button>
                          <Button
                            onClick={fetchProfileLocationToShop}
                            disabled={gettingLocation}
                            className="flex-1"
                            variant="outline"
                          >
                            <User className="mr-2 h-4 w-4" />
                            Use Profile
                          </Button>
                        </div>

                        {/* Manual Address Input */}
                        <div className="border-t pt-3 sm:pt-4 mt-3">
                          <Label className="mb-2 block text-xs sm:text-sm font-medium">Or Enter Address Manually</Label>
                          <div className="space-y-3">
                            <Input
                              placeholder="Full Address (e.g., Shop No. 5, Main Street)"
                              value={formData.address || ''}
                              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                              onBlur={handleFieldBlur}
                              className="text-xs sm:text-sm"
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <Input
                                placeholder="Village/City"
                                value={formData.village || ''}
                                onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                                onBlur={handleFieldBlur}
                                className="text-xs sm:text-sm"
                              />
                              <Input
                                placeholder="District"
                                value={formData.district || ''}
                                onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                                onBlur={handleFieldBlur}
                                className="text-xs sm:text-sm"
                              />
                              <Input
                                placeholder="State"
                                value={formData.state || ''}
                                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                                onBlur={handleFieldBlur}
                                className="text-xs sm:text-sm"
                              />
                              <Input
                                placeholder="Country"
                                value={formData.country || ''}
                                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                                onBlur={handleFieldBlur}
                                className="text-xs sm:text-sm"
                              />
                            </div>

                            {/* Coordinates Input */}
                            <div className="border-t pt-3 mt-3">
                              <Label className="mb-2 block text-xs sm:text-sm font-medium">Coordinates (Optional)</Label>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <Input
                                  placeholder="Latitude (e.g., 28.6139)"
                                  type="number"
                                  step="0.0001"
                                  value={formData.latitude || ''}
                                  onChange={(e) => handleCoordinatesChange(e.target.value ? parseFloat(e.target.value) : undefined, formData.longitude)}
                                  onBlur={handleFieldBlur}
                                  className="text-xs sm:text-sm"
                                />
                                <Input
                                  placeholder="Longitude (e.g., 77.2090)"
                                  type="number"
                                  step="0.0001"
                                  value={formData.longitude || ''}
                                  onChange={(e) => handleCoordinatesChange(formData.latitude, e.target.value ? parseFloat(e.target.value) : undefined)}
                                  onBlur={handleFieldBlur}
                                  className="text-xs sm:text-sm"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {formData.address && (
                          <div className="mt-3 p-3 bg-muted rounded space-y-2">
                            <p className="text-sm font-medium">Address Details:</p>
                            {formData.village && <p className="text-xs text-muted-foreground"><strong>Village:</strong> {formData.village}</p>}
                            {formData.district && <p className="text-xs text-muted-foreground"><strong>District:</strong> {formData.district}</p>}
                            {formData.state && <p className="text-xs text-muted-foreground"><strong>State:</strong> {formData.state}</p>}
                            {formData.country && <p className="text-xs text-muted-foreground"><strong>Country:</strong> {formData.country}</p>}
                            <p className="text-xs text-muted-foreground"><strong>Full Address:</strong> {formData.address}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Services Management */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg sm:text-2xl">Services</CardTitle>
                      <CardDescription>Manage your {getCategoryName().toLowerCase()} services</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {formData.services && formData.services.length > 0 && (
                        <div className="space-y-2 mb-4">
                          {formData.services.map((service) => (
                            <div key={service.id} className="flex items-center justify-between p-3 bg-muted rounded">
                              <div>
                                <p className="font-medium">{service.name}</p>
                                <p className="text-sm text-muted-foreground">₹{service.price}</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveService(service.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="border-t pt-4 space-y-3">
                        <h4 className="font-medium">Add New Service</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <Input
                            placeholder="Service name (e.g., Haircut)"
                            value={newService.name}
                            onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                          />
                          <Input
                            placeholder="Price (e.g., 300)"
                            value={newService.price}
                            onChange={(e) => setNewService({ ...newService, price: e.target.value })}
                          />
                        </div>
                        <Button onClick={handleAddService} className="w-full md:w-auto">
                          <Plus className="mr-2 h-4 w-4" />
                          Add Service
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Staff/Team Management */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg sm:text-2xl">{getStoreTypeLabel(true)}</CardTitle>
                      <CardDescription>Manage your {getCategoryName().toLowerCase()} {getStoreTypeLabel(true).toLowerCase()}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {formData.barberMembers && formData.barberMembers.length > 0 && (
                        <div className="space-y-2 mb-4">
                          {formData.barberMembers.map((barber) => (
                            <div key={barber.id} className="flex items-center justify-between p-3 bg-muted rounded">
                              <div className="flex items-center gap-3">
                                {barber.imageUrl && (
                                  <img src={barber.imageUrl} alt={barber.name} className="h-10 w-10 rounded-full object-cover" />
                                )}
                                <div>
                                  <p className="font-medium">{barber.name}</p>
                                  <p className="text-sm text-muted-foreground">{barber.experience}</p>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveBarber(barber.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="border-t pt-4 space-y-3">
                        <h4 className="font-medium">Add New {getStoreTypeLabel()}</h4>
                        <Input
                          placeholder={`${getStoreTypeLabel()} name`}
                          value={newBarber.name}
                          onChange={(e) => setNewBarber({ ...newBarber, name: e.target.value })}
                        />
                        <Input
                          placeholder="Experience (e.g., 5 years)"
                          value={newBarber.experience}
                          onChange={(e) => setNewBarber({ ...newBarber, experience: e.target.value })}
                        />
                        <div className="space-y-2">
                          <Label>Profile Image (Optional)</Label>
                          <div className="flex gap-4 items-end">
                            {newBarber.imageUrl ? (
                              <div className="relative inline-block group">
                                <img
                                  src={newBarber.imageUrl}
                                  alt={getCategoryName()}
                                  className={`h-24 w-24 rounded-full object-cover border-2 border-primary transition-all duration-300 ${(isRemovingBackground || isGeneratingAIImage) ? 'blur-[2px] grayscale-[0.5]' : ''}`}
                                />

                                {/* Targeted Loading Overlay */}
                                {(isRemovingBackground || isGeneratingAIImage) && (
                                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 rounded-full backdrop-blur-[1px] z-10">
                                    <div className="relative h-10 w-10">
                                      <svg className="h-full w-full rotate-[-90deg]">
                                        <circle cx="50%" cy="50%" r="40%" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-white/20" />
                                        <circle cx="50%" cy="50%" r="40%" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray="100%" strokeDashoffset={`${100 - aiProgress}%`} className="text-primary transition-all duration-300" />
                                      </svg>
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-[8px] font-black text-white">{aiProgress}%</span>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {!isRemovingBackground && !isGeneratingAIImage && (
                                  <button
                                    type="button"
                                    onClick={() => setUploadMenu({ isOpen: true, type: 'barber' })}
                                    className="absolute bottom-0 right-0 bg-primary text-primary-foreground p-1.5 rounded-full hover:bg-primary/90 transition-colors shadow-lg"
                                  >
                                    <Camera className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setUploadMenu({ isOpen: true, type: 'barber' })}
                                className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-muted-foreground rounded-full hover:border-primary transition-colors relative"
                                disabled={isGeneratingAIImage}
                              >
                                {isGeneratingAIImage ? (
                                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-purple-50/50 rounded-full">
                                    <Loader2 className="h-5 w-5 text-purple-600 animate-spin" />
                                  </div>
                                ) : (
                                  <Camera className="h-5 w-5 text-muted-foreground" />
                                )}
                              </button>
                            )}

                            {/* AI Buttons for Staff */}
                            <div className="flex gap-2 mb-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 text-[10px] font-black uppercase border-purple-200 text-purple-600 hover:bg-purple-50"
                                onClick={async () => {
                                  const generated = await generateAIImage(newBarber.name || 'Professional', 'Person portrait profile picture');
                                  if (generated) setNewBarber({ ...newBarber, imageUrl: generated });
                                }}
                                disabled={isGeneratingAIImage || !newBarber.name}
                              >
                                <Sparkles className="h-3 w-3 mr-1" />
                                AI
                              </Button>
                              {newBarber.imageUrl && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-[10px] font-black uppercase border-red-200 text-red-600 hover:bg-red-50"
                                  onClick={async () => {
                                    const processed = await processRemoveBackground(newBarber.imageUrl!);
                                    if (processed) setNewBarber({ ...newBarber, imageUrl: processed });
                                  }}
                                  disabled={isRemovingBackground}
                                >
                                  <Eraser className="h-3 w-3 mr-1" />
                                  Clean
                                </Button>
                              )}
                            </div>
                          </div>
                          <input
                            ref={barberImageInputRef}
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, 'barber')}
                            className="hidden"
                          />
                          <input
                            ref={barberCameraInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={(e) => handleImageUpload(e, 'barber')}
                            className="hidden"
                          />
                        </div>
                        <Button onClick={handleAddBarber} className="w-full">
                          <Plus className="mr-2 h-4 w-4" />
                          Add {getStoreTypeLabel()}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>


                  {/* Featured Products and Offers are now in their own dedicated tabs */}
                  {false && selectedShop && (
                    <Card className={currentPlan?.plan_name === 'free' ? 'border-amber-200 bg-amber-50' : ''}>
                      <CardHeader>
                        <CardTitle className="text-lg sm:text-2xl flex items-center gap-2">
                          <Package className="h-5 w-5" />
                          Featured Products
                          {currentPlan?.plan_name === 'free' && <Lock className="h-4 w-4 text-amber-600 ml-2" />}
                        </CardTitle>
                        <CardDescription>{currentPlan?.plan_name === 'free' ? 'Upgrade to BASIC to add featured products' : 'Add and manage featured products for your shop'}</CardDescription>
                      </CardHeader>
                      {currentPlan?.plan_name === 'free' ? (
                        <CardContent>
                          <div className="text-center space-y-4 py-6">
                            <p className="text-sm text-amber-800">
                              This feature is only available in the BASIC plan and above. Upgrade now to showcase your products.
                            </p>
                            <Button
                              onClick={() => toast.error('Please upgrade to BASIC plan to add featured products')}
                              className="bg-amber-600 hover:bg-amber-700"
                            >
                              <Zap className="mr-2 h-4 w-4" />
                              Upgrade to BASIC Plan (₹99)
                            </Button>
                          </div>
                        </CardContent>
                      ) : (
                        <CardContent className="space-y-4 sm:space-y-6">
                          {/* Add New Featured Product */}
                          <div className="border border-dashed border-muted-foreground rounded-lg p-4 space-y-4">
                            <h4 className="font-semibold text-sm sm:text-base">Add New Featured Product</h4>
                            <Input
                              placeholder="Product Title"
                              value={newFeaturedProduct.title}
                              onChange={(e) => setNewFeaturedProduct({ ...newFeaturedProduct, title: e.target.value })}
                              className="text-sm"
                            />
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Selling Price</Label>
                                <Input
                                  placeholder="e.g. 200"
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={newFeaturedProduct.price}
                                  onChange={(e) => setNewFeaturedProduct({ ...newFeaturedProduct, price: e.target.value })}
                                  className="text-sm"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Original Price (Strikethrough)</Label>
                                <Input
                                  placeholder="e.g. 240"
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={newFeaturedProduct.originalPrice}
                                  onChange={(e) => setNewFeaturedProduct({ ...newFeaturedProduct, originalPrice: e.target.value })}
                                  className="text-sm"
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Discount Percentage (Optional)</Label>
                              <Input
                                placeholder="e.g. 15"
                                type="number"
                                min="0"
                                max="100"
                                value={newFeaturedProduct.discountPercentage}
                                onChange={(e) => setNewFeaturedProduct({ ...newFeaturedProduct, discountPercentage: e.target.value })}
                                className="text-sm"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Category</Label>
                                <select
                                  value={newFeaturedProduct.category}
                                  onChange={(e) => setNewFeaturedProduct({ ...newFeaturedProduct, category: e.target.value })}
                                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                >
                                  <option value="">Auto-categorize</option>
                                  <option value="dairy">Dairy & Bakery</option>
                                  <option value="snacks">Snacks & Munchies</option>
                                  <option value="beverages">Cold Drinks & Juices</option>
                                  <option value="instant">Instant Food</option>
                                  <option value="grocery">Atta, Rice & Dal</option>
                                  <option value="household">Cleaning & Household</option>
                                  <option value="personal">Personal Care</option>
                                  <option value="other">Other</option>
                                </select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Stock Available</Label>
                                <Input
                                  placeholder="e.g. 50"
                                  type="number"
                                  min="0"
                                  value={newFeaturedProduct.inventory}
                                  onChange={(e) => setNewFeaturedProduct({ ...newFeaturedProduct, inventory: e.target.value })}
                                  className="text-sm"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs sm:text-sm">Product Image</Label>
                              {newFeaturedProduct.imageUrl ? (
                                <div className="relative inline-block group">
                                  <img
                                    src={newFeaturedProduct.imageUrl}
                                    alt="Product"
                                    className={`h-32 w-32 rounded-lg object-cover border-2 border-primary transition-all duration-300 ${(isRemovingBackground || isGeneratingAIImage) ? 'blur-[2px] grayscale-[0.5]' : ''}`}
                                  />

                                  {/* Targeted Loading Overlay */}
                                  {(isRemovingBackground || isGeneratingAIImage) && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 rounded-lg backdrop-blur-[1px] z-10">
                                      <div className="relative h-12 w-12">
                                        <svg className="h-full w-full rotate-[-90deg]">
                                          <circle
                                            cx="24"
                                            cy="24"
                                            r="20"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                            fill="transparent"
                                            className="text-white/20"
                                          />
                                          <circle
                                            cx="24"
                                            cy="24"
                                            r="20"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                            fill="transparent"
                                            strokeDasharray={125.6}
                                            strokeDashoffset={125.6 - (125.6 * aiProgress) / 100}
                                            className="text-primary transition-all duration-300"
                                          />
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                          <span className="text-[10px] font-black text-white">{aiProgress}%</span>
                                        </div>
                                      </div>
                                      <span className="text-[8px] font-black uppercase tracking-tighter text-white mt-1 text-center px-1">
                                        {isRemovingBackground ? 'Removing BG...' : 'AI Generating...'}
                                      </span>
                                    </div>
                                  )}

                                  {!isRemovingBackground && !isGeneratingAIImage && (
                                    <button
                                      type="button"
                                      onClick={() => setUploadMenu({ isOpen: true, type: 'product' })}
                                      className="absolute bottom-0 right-0 bg-primary text-primary-foreground p-1.5 rounded-full hover:bg-primary/90 transition-colors shadow-lg"
                                    >
                                      <Camera className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setUploadMenu({ isOpen: true, type: 'product' })}
                                  className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-muted-foreground rounded-lg hover:border-primary transition-colors relative"
                                  disabled={isGeneratingAIImage}
                                >
                                  {isGeneratingAIImage ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-purple-50/50 rounded-lg">
                                      <Loader2 className="h-6 w-6 text-purple-600 animate-spin" />
                                      <span className="text-[10px] font-bold text-purple-700 mt-1">{aiProgress}%</span>
                                    </div>
                                  ) : (
                                    <>
                                      <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                                      <span className="text-xs text-muted-foreground">Upload Image</span>
                                    </>
                                  )}
                                </button>
                              )}
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-[10px] font-black uppercase tracking-widest border-purple-200 text-purple-600 hover:bg-purple-50"
                                  onClick={async () => {
                                    const generated = await generateAIImage(newFeaturedProduct.title, '');
                                    if (generated) setNewFeaturedProduct({ ...newFeaturedProduct, imageUrl: generated });
                                  }}
                                  disabled={isGeneratingAIImage || !newFeaturedProduct.title}
                                >
                                  {isGeneratingAIImage ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
                                  AI Generate
                                </Button>
                                {newFeaturedProduct.imageUrl && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-[10px] font-black uppercase tracking-widest border-red-200 text-red-600 hover:bg-red-50"
                                    onClick={async () => {
                                      const processed = await processRemoveBackground(newFeaturedProduct.imageUrl);
                                      if (processed) setNewFeaturedProduct({ ...newFeaturedProduct, imageUrl: processed });
                                    }}
                                    disabled={isRemovingBackground}
                                  >
                                    {isRemovingBackground ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Eraser className="mr-1 h-3 w-3" />}
                                    Remove BG
                                  </Button>
                                )}
                              </div>
                              <input
                                ref={productImageInputRef}
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e, 'product')}
                                className="hidden"
                              />
                              <input
                                ref={productCameraInputRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={(e) => handleImageUpload(e, 'product')}
                                className="hidden"
                              />
                            </div>
                            <div id="product-form" className="flex gap-2">
                              {editingProduct ? (
                                <>
                                  <Button onClick={handleUpdateFeaturedProduct} className="flex-1">
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Update Product
                                  </Button>
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      setEditingProduct(null);
                                      setNewFeaturedProduct({ title: '', price: '', originalPrice: '', discountPercentage: '', category: '', imageUrl: '', inventory: '' });
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </>
                              ) : (
                                <Button onClick={handleAddFeaturedProduct} className="w-full">
                                  <Plus className="mr-2 h-4 w-4" />
                                  Add Featured Product
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Featured Products List */}
                          {featuredProducts.length > 0 && (
                            <div className="space-y-3">
                              <h4 className="font-semibold text-sm sm:text-base text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                <Package className="h-4 w-4" />
                                Product Inventory
                              </h4>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                                {featuredProducts.map((product) => (
                                  <Card key={product.id} className="overflow-hidden border-0 shadow-sm bg-slate-50 dark:bg-slate-900 group hover:shadow-md transition-all">
                                    <div className="relative aspect-square overflow-hidden bg-white">
                                      <img
                                        src={product.imageUrl}
                                        alt={product.title}
                                        className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                                      />
                                      {product.discountPercentage && (
                                        <div className="absolute top-1 left-1 bg-red-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-sm">
                                          -{product.discountPercentage}%
                                        </div>
                                      )}
                                      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                        <button
                                          onClick={() => handleEditProduct(product)}
                                          className="bg-white/80 hover:bg-primary hover:text-white text-primary p-1.5 rounded-full shadow-sm"
                                        >
                                          <Edit className="h-3 w-3" />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteFeaturedProduct(product.id)}
                                          className="bg-white/80 hover:bg-red-500 hover:text-white text-red-500 p-1.5 rounded-full shadow-sm"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      </div>
                                    </div>
                                    <CardContent className="p-2 space-y-1">
                                      <div className="flex items-center justify-between">
                                        <h5 className="font-bold text-[11px] line-clamp-1 text-slate-700 dark:text-slate-200">{product.title}</h5>
                                        {product.category && (
                                          <Badge variant="outline" className="text-[8px] h-3.5 px-1 bg-slate-100 border-none uppercase font-black text-slate-500">
                                            {product.category}
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex items-baseline gap-1.5">
                                        <span className="text-[13px] font-black text-red-600">₹{product.price}</span>
                                        {product.originalPrice && (
                                          <span className="text-[10px] text-slate-400 line-through">₹{product.originalPrice}</span>
                                        )}
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      )}
                    </Card>
                  )}

                  {/* Shop Offers — now in its own dedicated Offers tab */}
                  {false && selectedShop && (
                    <Card className={currentPlan?.plan_name === 'free' ? 'border-amber-200 bg-amber-50' : ''}>
                      <CardHeader>
                        <CardTitle className="text-lg sm:text-2xl flex items-center gap-2">
                          <Megaphone className="h-5 w-5" />
                          Shop Offers
                          {currentPlan?.plan_name === 'free' && <Lock className="h-4 w-4 text-amber-600 ml-2" />}
                        </CardTitle>
                        <CardDescription>{currentPlan?.plan_name === 'free' ? 'Upgrade to BASIC to add offers' : 'Add and manage current offers and promotions'}</CardDescription>
                      </CardHeader>
                      {currentPlan?.plan_name === 'free' ? (
                        <CardContent>
                          <div className="text-center space-y-4 py-6">
                            <p className="text-sm text-amber-800">
                              This feature is only available in the BASIC plan and above. Upgrade now to create special offers for your customers.
                            </p>
                            <Button
                              onClick={() => toast.error('Please upgrade to BASIC plan to add offers')}
                              className="bg-amber-600 hover:bg-amber-700"
                            >
                              <Zap className="mr-2 h-4 w-4" />
                              Upgrade to BASIC Plan (₹99)
                            </Button>
                          </div>
                        </CardContent>
                      ) : (
                        <CardContent className="space-y-4 sm:space-y-6">
                          {/* Add New Offer */}
                          <div className="border border-dashed border-muted-foreground rounded-lg p-4 space-y-4">
                            <h4 className="font-semibold text-sm sm:text-base">Add New Offer</h4>
                            <Input
                              placeholder="Offer Title (e.g., 50% Off Haircut)"
                              value={newOffer.title}
                              onChange={(e) => setNewOffer({ ...newOffer, title: e.target.value })}
                              className="text-sm"
                            />
                            <textarea
                              placeholder="Offer Description (optional)"
                              value={newOffer.description}
                              onChange={(e) => setNewOffer({ ...newOffer, description: e.target.value })}
                              className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                              rows={2}
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label className="text-xs sm:text-sm">Discount Type</Label>
                                <select
                                  value={newOffer.discountType}
                                  onChange={(e) => setNewOffer({ ...newOffer, discountType: e.target.value as 'percentage' | 'amount' })}
                                  className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                                >
                                  <option value="percentage">Percentage (%)</option>
                                  <option value="amount">Fixed Amount (₹)</option>
                                </select>
                              </div>
                              <div>
                                <Label className="text-xs sm:text-sm">Discount Value</Label>
                                <Input
                                  placeholder={newOffer.discountType === 'percentage' ? 'e.g., 50' : 'e.g., 500'}
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={newOffer.discount}
                                  onChange={(e) => setNewOffer({ ...newOffer, discount: e.target.value })}
                                  className="text-sm"
                                />
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs sm:text-sm">Valid Until</Label>
                              <Input
                                type="datetime-local"
                                value={newOffer.validUntil}
                                onChange={(e) => setNewOffer({ ...newOffer, validUntil: e.target.value })}
                                className="text-sm"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs sm:text-sm">Offer Image (Optional)</Label>
                              {newOffer.imageUrl ? (
                                <div className="relative inline-block group">
                                  <img
                                    src={newOffer.imageUrl}
                                    alt="Offer"
                                    className={`h-32 w-32 rounded-lg object-cover border-2 border-primary transition-all duration-300 ${(isRemovingBackground || isGeneratingAIImage) ? 'blur-[2px] grayscale-[0.5]' : ''}`}
                                  />

                                  {/* Targeted Loading Overlay */}
                                  {(isRemovingBackground || isGeneratingAIImage) && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 rounded-lg backdrop-blur-[1px] z-10">
                                      <div className="relative h-10 w-10">
                                        <svg className="h-full w-full rotate-[-90deg]">
                                          <circle cx="50%" cy="50%" r="40%" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-white/20" />
                                          <circle cx="50%" cy="50%" r="40%" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray="100%" strokeDashoffset={`${100 - aiProgress}%`} className="text-primary transition-all duration-300" />
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                          <span className="text-[8px] font-black text-white">{aiProgress}%</span>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {!isRemovingBackground && !isGeneratingAIImage && (
                                    <button
                                      type="button"
                                      onClick={() => setUploadMenu({ isOpen: true, type: 'offer' })}
                                      className="absolute bottom-0 right-0 bg-primary text-primary-foreground p-1.5 rounded-full hover:bg-primary/90 transition-colors shadow-lg"
                                    >
                                      <Camera className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setUploadMenu({ isOpen: true, type: 'offer' })}
                                  className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-muted-foreground rounded-lg hover:border-primary transition-colors relative"
                                  disabled={isGeneratingAIImage}
                                >
                                  {isGeneratingAIImage ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-purple-50/50 rounded-lg">
                                      <Loader2 className="h-6 w-6 text-purple-600 animate-spin" />
                                    </div>
                                  ) : (
                                    <>
                                      <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                                      <span className="text-xs text-muted-foreground">Upload Image</span>
                                    </>
                                  )}
                                </button>
                              )}
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-[10px] font-black uppercase tracking-widest border-purple-200 text-purple-600 hover:bg-purple-50"
                                  onClick={async () => {
                                    const generated = await generateAIImage(newOffer.title, newOffer.description || '');
                                    if (generated) setNewOffer({ ...newOffer, imageUrl: generated });
                                  }}
                                  disabled={isGeneratingAIImage || !newOffer.title}
                                >
                                  {isGeneratingAIImage ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
                                  AI Generate
                                </Button>
                                {newOffer.imageUrl && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-[10px] font-black uppercase tracking-widest border-red-200 text-red-600 hover:bg-red-50"
                                    onClick={async () => {
                                      const processed = await processRemoveBackground(newOffer.imageUrl);
                                      if (processed) setNewOffer({ ...newOffer, imageUrl: processed });
                                    }}
                                    disabled={isRemovingBackground}
                                  >
                                    {isRemovingBackground ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Eraser className="mr-1 h-3 w-3" />}
                                    Remove BG
                                  </Button>
                                )}
                              </div>
                              <input
                                ref={offerImageInputRef}
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e, 'offer')}
                                className="hidden"
                              />
                              <input
                                ref={offerCameraInputRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={(e) => handleImageUpload(e, 'offer')}
                                className="hidden"
                              />
                            </div>
                            <Button onClick={handleAddOffer} className="w-full">
                              <Plus className="mr-2 h-4 w-4" />
                              Add Offer
                            </Button>
                          </div>

                          {/* Active Offers */}
                          {shopOffers.filter(o => new Date(o.validUntil) > new Date() && o.isActive).length > 0 && (
                            <div className="space-y-3">
                              <h4 className="font-semibold text-sm sm:text-base">Active Offers</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {shopOffers
                                  .filter(o => new Date(o.validUntil) > new Date() && o.isActive)
                                  .map((offer) => (
                                    <Card key={offer.id} className="overflow-hidden">
                                      {offer.imageUrl && (
                                        <div className="relative aspect-video bg-muted overflow-hidden">
                                          <img
                                            src={offer.imageUrl}
                                            alt={offer.title}
                                            className="h-full w-full object-cover"
                                          />
                                        </div>
                                      )}
                                      <CardContent className="p-3 space-y-2">
                                        <div>
                                          <h5 className="font-semibold text-sm line-clamp-1">{offer.title}</h5>
                                          {offer.description && <p className="text-xs text-muted-foreground line-clamp-2">{offer.description}</p>}
                                        </div>
                                        <div className="flex items-center justify-between">
                                          <span className="text-sm font-bold text-primary">
                                            {offer.discountPercentage ? `${offer.discountPercentage}% off` : `₹${offer.discountAmount?.toFixed(2)} off`}
                                          </span>
                                          <button
                                            onClick={() => handleDeleteOffer(offer.id)}
                                            className="text-red-500 hover:text-red-600 p-1"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </button>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                          Expires: {formatIST(offer.validUntil, false)}
                                        </p>
                                      </CardContent>
                                    </Card>
                                  ))}
                              </div>
                            </div>
                          )}

                          {/* Expired Offers */}
                          {shopOffers.filter(o => new Date(o.validUntil) <= new Date() || !o.isActive).length > 0 && (
                            <div className="space-y-3 border-t pt-4">
                              <h4 className="font-semibold text-sm sm:text-base text-muted-foreground">Expired Offers</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {shopOffers
                                  .filter(o => new Date(o.validUntil) <= new Date() || !o.isActive)
                                  .map((offer) => (
                                    <Card key={offer.id} className="overflow-hidden opacity-50">
                                      {offer.imageUrl && (
                                        <div className="relative aspect-video bg-muted overflow-hidden">
                                          <img
                                            src={offer.imageUrl}
                                            alt={offer.title}
                                            className="h-full w-full object-cover"
                                          />
                                        </div>
                                      )}
                                      <CardContent className="p-3 space-y-2">
                                        <div>
                                          <h5 className="font-semibold text-sm line-clamp-1">{offer.title}</h5>
                                          {offer.description && <p className="text-xs text-muted-foreground line-clamp-2">{offer.description}</p>}
                                        </div>
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs text-muted-foreground">
                                            {offer.discountPercentage ? `${offer.discountPercentage}% off` : `₹${offer.discountAmount?.toFixed(2)} off`}
                                          </span>
                                          <button
                                            onClick={() => handleDeleteOffer(offer.id)}
                                            className="text-red-500 hover:text-red-600 p-1"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </button>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                          Expired: {formatIST(offer.validUntil, false)}
                                        </p>
                                      </CardContent>
                                    </Card>
                                  ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      )}
                    </Card>
                  )}

                  {/* Time Slot Settings */}
                  <TimeSlotSettingsPanel
                    timeSlotSettings={formData.timeSlotSettings || []}
                    openingTime={formData.openingTime || '09:00'}
                    closingTime={formData.closingTime || '18:00'}
                    isTokenBookingEnabled={!formData.tokenBookingPaused}
                    onChange={(updates) => {
                      const newFormData = { ...formData };
                      if (updates.timeSlotSettings !== undefined) newFormData.timeSlotSettings = updates.timeSlotSettings;
                      if (updates.openingTime !== undefined) newFormData.openingTime = updates.openingTime;
                      if (updates.closingTime !== undefined) newFormData.closingTime = updates.closingTime;
                      if (updates.isTokenBookingEnabled !== undefined) newFormData.tokenBookingPaused = !updates.isTokenBookingEnabled;
                      setFormData(newFormData);
                    }}
                  />

                  {/* Save Button */}
                  {/* Auto-save Status Indicator */}
                  {isAutoSaving && (
                    <div className="flex items-center gap-2 text-xs text-blue-500 font-bold animate-pulse px-4 py-2 bg-blue-50 rounded-full w-fit mb-4">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      AUTO-SAVING CHANGES...
                    </div>
                  )}

                  <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sticky bottom-0 bg-background/95 backdrop-blur-sm p-3 sm:p-4 -mx-3 sm:-mx-4 -mb-3 sm:-mb-4 border-t">
                    <p className="text-[10px] text-muted-foreground italic flex-1 flex items-center">
                      <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                      Your changes are saved automatically.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => setCurrentTab('dashboard')}
                      className="text-sm sm:text-base"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => handleSaveSettings()}
                      disabled={savingSettings}
                      className="text-sm sm:text-base"
                    >
                      {savingSettings ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                </div>
              )}

              {currentTab === 'products' && selectedShop && (
                <ProductsTab selectedShop={selectedShop} currentPlan={currentPlan} />
              )}
              {currentTab === 'offers' && selectedShop && (
                <div className="space-y-4 sm:space-y-6 pb-6">
                  <Card className={currentPlan?.plan_name === 'free' ? 'border-amber-200 bg-amber-50' : ''}>
                    <CardHeader>
                      <CardTitle className="text-lg sm:text-2xl flex items-center gap-2">
                        <Megaphone className="h-5 w-5" />
                        Shop Offers
                        {currentPlan?.plan_name === 'free' && <Lock className="h-4 w-4 text-amber-600 ml-2" />}
                      </CardTitle>
                      <CardDescription>{currentPlan?.plan_name === 'free' ? 'Upgrade to BASIC to add offers' : 'Add and manage current offers and promotions'}</CardDescription>
                    </CardHeader>
                    {currentPlan?.plan_name === 'free' ? (
                      <CardContent>
                        <div className="text-center space-y-4 py-6">
                          <p className="text-sm text-amber-800">This feature is only available in the BASIC plan and above.</p>
                          <Button onClick={() => toast.error('Please upgrade to BASIC plan to add offers')} className="bg-amber-600 hover:bg-amber-700">
                            <Zap className="mr-2 h-4 w-4" />Upgrade to BASIC Plan (₹99)
                          </Button>
                        </div>
                      </CardContent>
                    ) : (
                      <CardContent className="space-y-4 sm:space-y-6">
                        <div className="border border-dashed border-muted-foreground rounded-lg p-4 space-y-4">
                          <h4 className="font-semibold text-sm sm:text-base">Add New Offer</h4>
                          <Input placeholder="Offer Title (e.g., 50% Off Haircut)" value={newOffer.title} onChange={(e) => setNewOffer({ ...newOffer, title: e.target.value })} className="text-sm" />
                          <textarea placeholder="Offer Description (optional)" value={newOffer.description} onChange={(e) => setNewOffer({ ...newOffer, description: e.target.value })} className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" rows={2} />
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label className="text-xs sm:text-sm">Discount Type</Label>
                              <select value={newOffer.discountType} onChange={(e) => setNewOffer({ ...newOffer, discountType: e.target.value as 'percentage' | 'amount' })} className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm">
                                <option value="percentage">Percentage (%)</option>
                                <option value="amount">Fixed Amount (₹)</option>
                              </select>
                            </div>
                            <div>
                              <Label className="text-xs sm:text-sm">Discount Value</Label>
                              <Input placeholder={newOffer.discountType === 'percentage' ? 'e.g., 50' : 'e.g., 500'} type="number" step="0.01" min="0" value={newOffer.discount} onChange={(e) => setNewOffer({ ...newOffer, discount: e.target.value })} className="text-sm" />
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs sm:text-sm">Valid Until</Label>
                            <Input type="datetime-local" value={newOffer.validUntil} onChange={(e) => setNewOffer({ ...newOffer, validUntil: e.target.value })} className="text-sm" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs sm:text-sm">Offer Image (Optional)</Label>
                            <div className="flex gap-3 items-start flex-wrap">
                              {newOffer.imageUrl ? (
                                <div className="relative inline-block group">
                                  <img src={newOffer.imageUrl} alt="Offer" className={`h-28 w-28 rounded-lg object-cover border-2 border-primary ${(isRemovingBackground || isGeneratingAIImage) ? 'blur-[2px]' : ''}`} />
                                  {!isRemovingBackground && !isGeneratingAIImage && (
                                    <button type="button" onClick={() => setUploadMenu({ isOpen: true, type: 'offer' })} className="absolute bottom-0 right-0 bg-primary text-primary-foreground p-1.5 rounded-full shadow-lg">
                                      <Camera className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <button type="button" onClick={() => setUploadMenu({ isOpen: true, type: 'offer' })} className="flex flex-col items-center justify-center w-28 h-28 border-2 border-dashed border-muted-foreground rounded-lg hover:border-primary transition-colors" disabled={isGeneratingAIImage}>
                                  <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                                  <span className="text-xs text-muted-foreground">Upload</span>
                                </button>
                              )}
                              <div className="flex flex-col gap-2">
                                <Button type="button" size="sm" variant="outline" className="h-8 text-[10px] font-black uppercase border-purple-200 text-purple-600 hover:bg-purple-50" onClick={async () => { const g = await generateAIImage(newOffer.title, ''); if (g) setNewOffer({ ...newOffer, imageUrl: g }); }} disabled={isGeneratingAIImage || !newOffer.title}>
                                  <Sparkles className="h-3 w-3 mr-1" /> AI
                                </Button>
                                {newOffer.imageUrl && (
                                  <Button type="button" size="sm" variant="outline" className="h-8 text-[10px] font-black uppercase border-red-200 text-red-600 hover:bg-red-50" onClick={async () => { const p = await processRemoveBackground(newOffer.imageUrl); if (p) setNewOffer({ ...newOffer, imageUrl: p }); }} disabled={isRemovingBackground}>
                                    <Eraser className="h-3 w-3 mr-1" /> No BG
                                  </Button>
                                )}
                              </div>
                            </div>
                            <input ref={offerImageInputRef} type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'offer')} className="hidden" />
                            <input ref={offerCameraInputRef} type="file" accept="image/*" capture="environment" onChange={(e) => handleImageUpload(e, 'offer')} className="hidden" />
                          </div>
                          <Button onClick={handleAddOffer} className="w-full"><Plus className="mr-2 h-4 w-4" />Add Offer</Button>
                        </div>

                        {shopOffers.filter(o => new Date(o.validUntil) > new Date() && o.isActive).length > 0 && (
                          <div className="space-y-3">
                            <h4 className="font-semibold text-sm text-slate-500 uppercase tracking-widest flex items-center gap-2">
                              <Megaphone className="h-4 w-4" /> Active Offers
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {shopOffers.filter(o => new Date(o.validUntil) > new Date() && o.isActive).map((offer) => (
                                <Card key={offer.id} className="overflow-hidden">
                                  {offer.imageUrl && <div className="relative aspect-video bg-muted overflow-hidden"><img src={offer.imageUrl} alt={offer.title} className="h-full w-full object-cover" /></div>}
                                  <CardContent className="p-3 space-y-2">
                                    <h5 className="font-semibold text-sm">{offer.title}</h5>
                                    {offer.description && <p className="text-xs text-muted-foreground line-clamp-2">{offer.description}</p>}
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm font-bold text-primary">{offer.discountPercentage ? `${offer.discountPercentage}% off` : `₹${offer.discountAmount?.toFixed(2)} off`}</span>
                                      <button onClick={() => handleDeleteOffer(offer.id)} className="text-red-500 hover:text-red-600 p-1"><Trash2 className="h-4 w-4" /></button>
                                    </div>
                                    <p className="text-xs text-muted-foreground">Expires: {formatIST(offer.validUntil, false)}</p>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                </div>
              )}

              {currentTab === 'campaigns' && (
                <div className="space-y-4 sm:space-y-6 pb-6">
                  {currentPlan?.plan_name === 'free' ? (
                    <Card className="border-amber-200 bg-amber-50">
                      <CardContent className="pt-6">
                        <div className="text-center space-y-4">
                          <div className="flex justify-center">
                            <Lock className="h-12 w-12 text-amber-600" />
                          </div>
                          <h3 className="text-lg font-bold text-amber-900">Campaigns Feature Locked</h3>
                          <p className="text-sm text-amber-800">
                            Send campaigns to reach more customers. This feature is only available in the BASIC plan and above.
                          </p>
                          <Button
                            onClick={() => toast.error('Please upgrade to BASIC plan to access campaigns')}
                            className="bg-amber-600 hover:bg-amber-700"
                          >
                            <Zap className="mr-2 h-4 w-4" />
                            Upgrade to BASIC Plan (₹99)
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : campaignView === 'create' && selectedShop ? (
                    <CampaignBuilder
                      shopId={selectedShop.id}
                      onClose={() => setCampaignView('list')}
                      onCampaignCreated={() => setCampaignView('list')}
                    />
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-2xl font-bold">Campaigns</h2>
                          <p className="text-sm text-muted-foreground">Create and manage your targeted campaigns</p>
                        </div>
                        {selectedShop && (
                          <Button
                            onClick={() => setCampaignView('create')}
                            className="gap-2"
                          >
                            <Plus className="h-4 w-4" />
                            <span className="hidden sm:inline">New Campaign</span>
                            <span className="sm:hidden">New</span>
                          </Button>
                        )}
                      </div>

                      {/* Sub-tabs for Sent vs Received */}
                      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                        <Button
                          variant={campaignSubTab === 'sent' ? 'default' : 'ghost'}
                          onClick={() => setCampaignSubTab('sent')}
                          size="sm"
                          className="text-xs"
                        >
                          Sent Campaigns
                        </Button>
                        <Button
                          variant={campaignSubTab === 'received' ? 'default' : 'ghost'}
                          onClick={() => setCampaignSubTab('received')}
                          size="sm"
                          className="text-xs"
                        >
                          Received Campaigns
                        </Button>
                      </div>

                      {selectedShop && (
                        campaignSubTab === 'sent' ? (
                          <CampaignHistory shopId={selectedShop.id} />
                        ) : (
                          <ReceivedCampaignsList />
                        )
                      )}
                    </>
                  )}
                </div>
              )}

              {currentTab === 'customization' && selectedShop && (
                <div className="space-y-4 sm:space-y-6 pb-6">
                  {/* Booking Settings moved from General Settings */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg sm:text-2xl flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Booking Settings
                      </CardTitle>
                      <CardDescription>Configure how your booking system works</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border">
                        <div className="space-y-0.5">
                          <Label className="text-base">Booking Token Facility</Label>
                          <p className="text-sm text-muted-foreground">
                            Enable or disable the entire booking system for your shop
                          </p>
                        </div>
                        <Switch
                          checked={formData.isTokenBookingEnabled !== false}
                          onCheckedChange={(checked) => {
                            const updated = { ...formData, isTokenBookingEnabled: checked };
                            setFormData(updated);
                            handleSaveSettings(updated);
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border">
                        <div className="space-y-0.5">
                          <Label className="text-base">Pause Bookings</Label>
                          <p className="text-sm text-muted-foreground">
                            Temporarily stop taking new bookings (e.g., when you are busy)
                          </p>
                        </div>
                        <Switch
                          checked={formData.tokenBookingPaused || false}
                          onCheckedChange={(checked) => {
                            const updated = { ...formData, tokenBookingPaused: checked };
                            setFormData(updated);
                            handleSaveSettings(updated);
                          }}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg sm:text-2xl flex items-center gap-2">
                        <Palette className="h-5 w-5" />
                        Shop View Page Customization
                      </CardTitle>
                      <CardDescription>Customize how your shop appears to customers</CardDescription>
                    </CardHeader>
                  </Card>
                  <ShopCustomizer shopId={selectedShop.id} shopOwnerEmail={selectedShop.ownerEmail} />
                </div>
              )}

              {currentTab === 'uploads' && selectedShop && (
                <div className="space-y-4 sm:space-y-6 pb-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg sm:text-2xl flex items-center gap-2">
                        <Upload className="h-5 w-5" />
                        File Uploads
                      </CardTitle>
                      <CardDescription>Manage all your shop images and media files</CardDescription>
                    </CardHeader>
                  </Card>

                  {/* Shop Image */}
                  <Card className="overflow-hidden border-none shadow-lg bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                        <div className="h-8 w-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center text-blue-600">
                          <Camera className="h-4 w-4" />
                        </div>
                        Main Shop Image
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {formData.shopImageUrl ? (
                        <div className="relative group rounded-2xl overflow-hidden aspect-video shadow-md border-4 border-white dark:border-slate-800">
                          <img
                            src={formData.shopImageUrl}
                            alt="Shop"
                            className={`w-full h-full object-cover group-hover:scale-105 transition-all duration-500 ${(isRemovingBackground || isGeneratingAIImage) ? 'blur-[4px] grayscale-[0.5]' : ''}`}
                          />

                          {/* Targeted Loading Overlay for Customization Tab */}
                          {(isRemovingBackground || isGeneratingAIImage) && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm z-10">
                              <div className="relative h-16 w-16">
                                <svg className="h-full w-full rotate-[-90deg]">
                                  <circle cx="50%" cy="50%" r="40%" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-white/20" />
                                  <circle cx="50%" cy="50%" r="40%" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray="100%" strokeDashoffset={`${100 - aiProgress}%`} className="text-primary transition-all duration-300" />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className="text-xs font-black text-white">{aiProgress}%</span>
                                </div>
                              </div>
                              <span className="text-[10px] font-black uppercase tracking-widest text-white mt-2 animate-pulse">
                                AI Processing...
                              </span>
                            </div>
                          )}

                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                            {!isRemovingBackground && !isGeneratingAIImage && (
                              <>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="rounded-full font-bold uppercase tracking-widest text-[10px]"
                                  onClick={() => setUploadMenu({ isOpen: true, type: 'shop' })}
                                >
                                  <Edit className="mr-1 h-3 w-3" />
                                  Change
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="rounded-full font-bold uppercase tracking-widest text-[10px] bg-red-500 text-white hover:bg-red-600 border-none"
                                  onClick={async () => {
                                    const processed = await processRemoveBackground(formData.shopImageUrl!);
                                    if (processed) {
                                      const updated = { ...formData, shopImageUrl: processed };
                                      setFormData(updated);
                                      handleSaveSettings(updated);
                                    }
                                  }}
                                  disabled={isRemovingBackground}
                                >
                                  <Eraser className="mr-1 h-3 w-3" />
                                  Remove BG
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setUploadMenu({ isOpen: true, type: 'shop' })}
                          className="w-full aspect-video rounded-2xl border-4 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-3 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all group"
                        >
                          <div className="h-14 w-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Upload className="h-6 w-6 text-slate-400 group-hover:text-blue-500" />
                          </div>
                          <div className="text-center">
                            <span className="block text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">Upload Shop Image</span>
                            <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-widest">Gallery or Camera</span>
                          </div>
                        </button>
                      )}
                    </CardContent>
                  </Card>

                  {/* Shop Interiors Gallery */}
                  <Card className="overflow-hidden border-none shadow-lg bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                        <div className="h-8 w-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center text-purple-600">
                          <ImageIcon className="h-4 w-4" />
                        </div>
                        Shop Interiors Gallery
                      </CardTitle>
                      <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Showcase your shop's interior atmosphere</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {(formData.interiorImages || []).map((img, index) => (
                          <div key={index} className="relative group aspect-square rounded-xl overflow-hidden shadow-sm border-2 border-white dark:border-slate-800">
                            <img src={img} alt={`Interior ${index + 1}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <button
                                onClick={() => handleRemoveInteriorImage(index)}
                                className="h-8 w-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                        <button
                          onClick={() => setUploadMenu({ isOpen: true, type: 'interior' })}
                          className="aspect-square rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-2 hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-all group"
                        >
                          <div className="h-10 w-10 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Plus className="h-5 w-5 text-slate-400 group-hover:text-purple-500" />
                          </div>
                          <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Add Photo</span>
                        </button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Team/Staff Images */}
                  {selectedShop.barberMembers && selectedShop.barberMembers.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">{getStoreTypeLabel(true)} Images</CardTitle>
                        <CardDescription>Images for your {getCategoryName().toLowerCase()} team members</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                          {selectedShop.barberMembers.map((barber) => (
                            <div key={barber.id} className="space-y-2">
                              <div className="relative">
                                {barber.imageUrl ? (
                                  <img src={barber.imageUrl} alt={barber.name} className="w-full h-40 object-cover rounded-lg border-2 border-primary" />
                                ) : (
                                  <div className="w-full h-40 bg-muted rounded-lg flex items-center justify-center">
                                    <Camera className="h-8 w-8 text-muted-foreground" />
                                  </div>
                                )}
                              </div>
                              <p className="font-medium text-sm">{barber.name}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {currentTab === 'preview' && selectedShop && user && (
                <ShopDetailsPage
                  shopId={selectedShop.id}
                  onClose={() => setCurrentTab('dashboard')}
                  currentUserId={user.uid}
                  currentUserEmail={user.email || ''}
                  currentUserName={selectedShop.ownerName || user.displayName || user.email?.split('@')[0] || 'User'}
                  shopOwnerEmail={selectedShop.ownerEmail}
                  isBarberPortal={true}
                />
              )}

              {currentTab === 'khata-book' && selectedShop && (
                <div className="space-y-4 sm:space-y-6 pb-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-xl flex items-center gap-2">
                        <Book className="h-5 w-5 text-amber-500" />
                        Khata Book
                      </CardTitle>
                      <CardDescription>
                        Manage your customer accounts and track outstanding payments easily.
                      </CardDescription>
                    </CardHeader>
                  </Card>
                  <KhataBook shopId={selectedShop.id} />
                </div>
              )}

              {currentTab === 'website' && selectedShop && (
                <div className="space-y-4 sm:space-y-6 pb-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-xl flex items-center gap-2">
                        <GlobeIcon className="h-5 w-5 text-red-500" />
                        Shop Website Builder
                      </CardTitle>
                      <CardDescription>
                        Create and manage your shop's public profile website.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-xl border border-red-100 dark:border-red-900/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-center sm:text-left">
                          <h4 className="font-bold text-red-700 dark:text-red-400">Your Online Presence</h4>
                          <p className="text-sm text-red-600 dark:text-red-500/80">Build a beautiful website for your shop in minutes using our drag-and-drop builder.</p>
                        </div>
                        <Button
                          onClick={() => setShowWebsiteBuilder(true)}
                          className="bg-red-500 hover:bg-red-600 text-white font-bold px-6 shadow-lg shadow-red-500/30"
                        >
                          Launch Builder
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-border shadow-sm">
                          <h5 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            Mobile Responsive
                          </h5>
                          <p className="text-xs text-muted-foreground">Your website will look great on phones, tablets, and computers automatically.</p>
                        </div>
                        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-border shadow-sm">
                          <h5 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            Instant URL
                          </h5>
                          <p className="text-xs text-muted-foreground">Get a live link instantly after publishing to share with your customers.</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <VideoRecorder
        isOpen={isVideoRecorderOpen}
        onClose={() => setIsVideoRecorderOpen(false)}
        onSave={handleVideoUpload}
      />

      {selectedShop && (
        <WebsiteBuilder
          isOpen={showWebsiteBuilder}
          onClose={() => setShowWebsiteBuilder(false)}
          shopId={selectedShop.id}
          shopName={selectedShop.name}
        />
      )}

      {/* Help & Support Dialog */}
      <Dialog open={showHelpDialog} onOpenChange={setShowHelpDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-teal-600" />
              Help & Support
            </DialogTitle>
            <DialogDescription>
              Get in touch with our support team
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* WhatsApp Button */}
            <a
              href="https://wa.me/917508990616?text=Hi%2C%20I%20need%20help%20with%20the%20app"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 p-4 rounded-xl bg-gradient-to-r from-green-400 to-green-500 hover:from-green-500 hover:to-green-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5 border-0 w-full"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.67-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421-7.403h-.006c-1.405 0-2.734-.474-3.803-1.37-.968-.81-1.566-1.966-1.566-3.164C6.676 3.075 8.751 1 11.277 1c1.38 0 2.677.474 3.754 1.367 1.077.893 1.741 2.12 1.741 3.45 0 2.526-2.075 4.565-4.495 4.565z" />
              </svg>
              Message on WhatsApp
            </a>

            {/* Email Button */}
            <a
              href="mailto:pv173597@gmail.com"
              className="flex items-center justify-center gap-3 p-4 rounded-xl bg-gradient-to-r from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5 border-0 w-full"
            >
              <Mail className="h-5 w-5" />
              Email Support
            </a>

            {/* Contact Info */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-semibold text-foreground">Contact Details</p>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">WhatsApp:</span> +91 7508990616
                </p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Email:</span> pv173597@gmail.com
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => setShowHelpDialog(false)}
              className="w-full"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Thought Modal */}
      <SendThoughtModal
        isOpen={showSendThought}
        onClose={() => setShowSendThought(false)}
      />
      {/* Hidden inputs for interior images */}
      <input
        ref={interiorImageInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => handleImageUpload(e, 'interior')}
        className="hidden"
      />
      <input
        ref={interiorCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => handleImageUpload(e, 'interior')}
        className="hidden"
      />

      {/* Upload Bottom Sheet Menu */}
      <Dialog open={uploadMenu.isOpen} onOpenChange={(open) => setUploadMenu({ ...uploadMenu, isOpen: open })}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden border-none bg-transparent shadow-none focus:outline-none">
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="bg-white dark:bg-slate-900 rounded-t-3xl p-6 pb-12 w-full shadow-2xl border-t border-slate-100 dark:border-slate-800"
          >
            <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-8" />

            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 text-center uppercase tracking-tight">
              {uploadMenu.type === 'video' ? 'Select Video Source' : 'Update Image'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center mb-8 font-bold uppercase tracking-widest">
              Choose how you want to upload
            </p>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => {
                  setUploadMenu({ ...uploadMenu, isOpen: false });
                  if (uploadMenu.type === 'shop') shopImageInputRef.current?.click();
                  else if (uploadMenu.type === 'barber') barberImageInputRef.current?.click();
                  else if (uploadMenu.type === 'product') productImageInputRef.current?.click();
                  else if (uploadMenu.type === 'offer') offerImageInputRef.current?.click();
                  else if (uploadMenu.type === 'video') shopVideoInputRef.current?.click();
                  else if (uploadMenu.type === 'interior') interiorImageInputRef.current?.click();
                }}
                className="flex flex-col items-center justify-center gap-3 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all group"
              >
                <div className="h-14 w-14 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Plus className="h-6 w-6 text-blue-600" />
                </div>
                <span className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight">Gallery</span>
              </button>

              <button
                onClick={() => {
                  setUploadMenu({ ...uploadMenu, isOpen: false });
                  if (uploadMenu.type === 'shop') shopCameraInputRef.current?.click();
                  else if (uploadMenu.type === 'barber') barberCameraInputRef.current?.click();
                  else if (uploadMenu.type === 'product') productCameraInputRef.current?.click();
                  else if (uploadMenu.type === 'offer') offerCameraInputRef.current?.click();
                  else if (uploadMenu.type === 'video') shopVideoCameraInputRef.current?.click();
                  else if (uploadMenu.type === 'interior') interiorCameraInputRef.current?.click();
                }}
                className="flex flex-col items-center justify-center gap-3 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all group"
              >
                <div className="h-14 w-14 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Camera className="h-6 w-6 text-red-600" />
                </div>
                <span className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight">Capture</span>
              </button>
            </div>

            <Button
              variant="ghost"
              className="w-full mt-8 h-12 rounded-xl text-slate-400 font-bold uppercase tracking-widest text-[10px]"
              onClick={() => setUploadMenu({ ...uploadMenu, isOpen: false })}
            >
              Cancel
            </Button>
          </motion.div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
