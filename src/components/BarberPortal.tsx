import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
  Store
} from 'lucide-react';
import { getShops, updateShop, getShopById } from '@/lib/shops-storage';
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
import { TimeSlotSettingsPanel } from './TimeSlotSettingsPanel';
import { IncomingBookingRequests } from './IncomingBookingRequests';
import { ShopCustomizer } from './ShopCustomizer';
import { ShopDetailsPage } from './ShopDetailsPage';
import { VideoRecorder } from './VideoRecorder';
import { WebsiteBuilder } from './WebsiteBuilder';
import { KhataBook } from './KhataBook';
import { OrderRequestsPanel } from './OrderRequestsPanel';
import toast from 'react-hot-toast';
import { notifySuccess } from '@/lib/notification-helper';
import { getFeaturedProductsByShopId, addFeaturedProduct, updateFeaturedProduct, deleteFeaturedProduct } from '@/lib/supabase-featured-products';
import { getAllOffersByShopId, addOffer, updateOffer, deleteOffer } from '@/lib/supabase-offers';
import type { Shop } from '@/lib/shops-storage';
import type { Booking } from '@/lib/bookings-storage';
import type { FeaturedProduct, ShopOffer } from '@/types';
import { useNavigate, useLocation } from 'react-router-dom';

interface BarberPortalProps {
  onClose: () => void;
  initialTab?: 'dashboard' | 'bookings' | 'settings' | 'campaigns' | 'customization' | 'uploads' | 'preview' | 'website' | 'khata-book' | 'orders' | 'campaign-analytics';
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
  const [showWebsiteBuilder, setShowWebsiteBuilder] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [showSendThought, setShowSendThought] = useState(false);

  // Settings form states
  const [formData, setFormData] = useState<Partial<Shop>>({});
  const [currentPlan, setCurrentPlan] = useState<ShopOwnerPlan | null>(null);
  const [newService, setNewService] = useState({ name: '', price: '' });
  const [newBarber, setNewBarber] = useState({ name: '', experience: '', imageUrl: '' });
  const [editingService, setEditingService] = useState<string | null>(null);
  const [editingBarber, setEditingBarber] = useState<string | null>(null);

  const [featuredProducts, setFeaturedProducts] = useState<FeaturedProduct[]>([]);
  const [newFeaturedProduct, setNewFeaturedProduct] = useState({ title: '', price: '', originalPrice: '', discountPercentage: '', imageUrl: '' });
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Shop Offers state
  const [shopOffers, setShopOffers] = useState<ShopOffer[]>([]);
  const [newOffer, setNewOffer] = useState({ title: '', description: '', discount: '', discountType: 'percentage' as 'percentage' | 'amount', imageUrl: '', validUntil: '' });
  const [editingOffer, setEditingOffer] = useState<string | null>(null);
  const [loadingOffers, setLoadingOffers] = useState(false);

  const [isVideoRecorderOpen, setIsVideoRecorderOpen] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  // Order Requests state
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // File upload refs
  const shopImageInputRef = useRef<HTMLInputElement>(null);
  const shopVideoInputRef = useRef<HTMLInputElement>(null);
  const barberImageInputRef = useRef<HTMLInputElement>(null);
  const productImageInputRef = useRef<HTMLInputElement>(null);
  const offerImageInputRef = useRef<HTMLInputElement>(null);

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

        // Load featured products for the shop
        const productsData = await getFeaturedProductsByShopId(shopId);
        setFeaturedProducts(productsData);

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
      // Reload orders every 10 seconds
      const interval = setInterval(loadPendingOrders, 10000);
      return () => clearInterval(interval);
    }
  }, [selectedShop?.id, step]);

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
        setFormData(selectedShop);
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

  const handleSaveSettings = async () => {
    if (!selectedShop) return;

    setSavingSettings(true);
    try {
      const updated = await updateShop(selectedShop.id, formData);
      if (updated) {
        setSelectedShop(updated);
        setFormData(updated);
        toast.success('Settings saved successfully!');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSavingSettings(false);
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

  const handleRemoveBarber = (barberId: string) => {
    const barberMembers = (formData.barberMembers || []).filter((b) => b.id !== barberId);
    setFormData({ ...formData, barberMembers });
    toast.success(`${getCategoryName()} removed`);
  };

  // Featured Products Handlers
  const handleAddFeaturedProduct = async () => {
    if (!selectedShop || !newFeaturedProduct.title || !newFeaturedProduct.price || !newFeaturedProduct.imageUrl) {
      toast.error('Please fill in all product fields including image');
      return;
    }

    try {
      const result = await addFeaturedProduct(
        selectedShop.id,
        newFeaturedProduct.title,
        parseFloat(newFeaturedProduct.price),
        newFeaturedProduct.imageUrl,
        undefined, // description
        newFeaturedProduct.originalPrice ? parseFloat(newFeaturedProduct.originalPrice) : undefined,
        newFeaturedProduct.discountPercentage ? parseInt(newFeaturedProduct.discountPercentage) : undefined
      );

      if (result) {
        setFeaturedProducts([...featuredProducts, result]);
        setNewFeaturedProduct({ title: '', price: '', originalPrice: '', discountPercentage: '', imageUrl: '' });
        toast.success('Featured product added successfully!');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add featured product';
      console.error('Error adding featured product:', error);
      toast.error(errorMessage);
    }
  };

  const handleDeleteFeaturedProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      await deleteFeaturedProduct(productId);
      setFeaturedProducts(featuredProducts.filter((p) => p.id !== productId));
      toast.success('Featured product deleted successfully!');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete featured product';
      console.error('Error deleting featured product:', error);
      toast.error(errorMessage);
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, imageType: 'shop' | 'location' | 'barber' | 'product' | 'offer') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        if (imageType === 'shop') {
          setFormData({ ...formData, shopImageUrl: base64String });
        } else if (imageType === 'barber') {
          setNewBarber({ ...newBarber, imageUrl: base64String });
        } else if (imageType === 'product') {
          setNewFeaturedProduct({ ...newFeaturedProduct, imageUrl: base64String });
        } else if (imageType === 'offer') {
          setNewOffer({ ...newOffer, imageUrl: base64String });
        }
      };
      reader.readAsDataURL(file);
    }
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

  const generateGoogleMapsLink = (latitude?: number, longitude?: number): string | null => {
    const lat = latitude ?? formData.latitude;
    const lon = longitude ?? formData.longitude;
    if (lat && lon) {
      return `https://www.google.com/maps?q=${lat},${lon}`;
    }
    return null;
  };

  const handleCoordinatesChange = (latitude?: number, longitude?: number) => {
    const mapsLink = generateGoogleMapsLink(latitude, longitude);
    setFormData({
      ...formData,
      latitude: latitude ?? formData.latitude,
      longitude: longitude ?? formData.longitude,
      locationMapLink: mapsLink || formData.locationMapLink,
    });
  };

  const handleGetLocation = async () => {
    setGettingLocation(true);
    try {
      const location = await fetchUserLocation();
      const googleMapsLink = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
      setFormData({
        ...formData,
        location: location.formattedAddress,
        latitude: location.latitude,
        longitude: location.longitude,
        locationMapLink: googleMapsLink,
        address: location.formattedAddress,
        village: location.village || null,
        district: location.district || null,
        state: location.state || null,
        country: location.country || null,
      });
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

          {/* Tab Navigation - Modern Scrolling Tabs */}
          <div className="flex overflow-x-auto gap-2 pb-2 no-scrollbar -mx-4 px-4">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: <Eye className="h-4 w-4" /> },
              { id: 'bookings', label: 'Requests', icon: <Bell className="h-4 w-4" /> },
              { id: 'orders', label: 'Orders', icon: <ShoppingCart className="h-4 w-4" /> },
              { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
              { id: 'campaigns', label: 'Campaigns', icon: <Megaphone className="h-4 w-4" />, restricted: isTabRestricted('campaigns') },
              { id: 'customization', label: 'Design', icon: <Palette className="h-4 w-4" />, restricted: isTabRestricted('customization') },
              { id: 'uploads', label: 'Uploads', icon: <Upload className="h-4 w-4" />, restricted: isTabRestricted('uploads') },
              { id: 'preview', label: 'Preview', icon: <Eye className="h-4 w-4" />, restricted: isTabRestricted('preview') },
              { id: 'website', label: 'Website', icon: <GlobeIcon className="h-4 w-4" />, restricted: isTabRestricted('website') },
              { id: 'khata-book', label: 'Khata', icon: <Book className="h-4 w-4" />, restricted: isTabRestricted('khata-book') },
            ].map((tab) => {
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
                  className={`flex items-center gap-2 h-10 px-4 rounded-xl shrink-0 transition-all ${
                    isActive 
                      ? 'bg-slate-900 text-white shadow-md' 
                      : 'text-slate-600 hover:bg-slate-100'
                  } ${tab.restricted ? 'opacity-50' : ''}`}
                >
                  <div className="relative">
                    {tab.icon}
                    {tab.restricted && <Lock className="absolute -top-1 -right-1 h-2 w-2 text-red-500" />}
                  </div>
                  <span className="text-xs font-bold whitespace-nowrap">{tab.label}</span>
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
                {/* Shop Header Section */}
                <div className="mb-6 rounded-lg overflow-hidden bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-900">
                  <div className="p-6 sm:p-8">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                      {/* Shop Image */}
                      {selectedShop?.shopImageUrl && (
                        <div className="flex-shrink-0">
                          <img
                            src={selectedShop.shopImageUrl}
                            alt={selectedShop.name}
                            className="w-32 h-32 sm:w-40 sm:h-40 object-cover rounded-lg shadow-lg"
                          />
                        </div>
                      )}

                      {/* Shop Info */}
                      <div className="flex-1 text-center sm:text-left">
                        {/* Shop Name */}
                        <h1 className="text-3xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-2">
                          {selectedShop?.name}
                        </h1>

                        {/* Category Badge */}
                        {selectedShop?.category && (
                          <div className="flex justify-center sm:justify-start gap-3 mb-4">
                            <span className="inline-block px-4 py-2 bg-blue-600 text-white rounded-full text-sm font-semibold capitalize shadow-md">
                              {selectedShop.category}
                            </span>
                          </div>
                        )}

                        {/* Additional Info */}
                        {selectedShop?.about && (
                          <p className="text-gray-600 dark:text-gray-300 mt-3 max-w-2xl">
                            {selectedShop.about}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                  <Card className={selectedShop?.isOpen ? 'border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20' : 'border-red-200 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20'}>
                    <CardHeader className="pb-3 sm:pb-4">
                      <CardTitle className="text-base sm:text-lg">
                        {selectedShop?.isOpen ? '🟢 Open' : '🔴 Closed'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 sm:space-y-4">
                      <div className="flex items-center justify-between p-4 bg-white/50 dark:bg-black/20 rounded-lg border-2 border-dashed" style={{ borderColor: selectedShop?.isOpen ? '#16a34a' : '#dc2626' }}>
                        <div>
                          <p className="font-semibold text-base">Shop Status</p>
                          <p className={`font-bold text-lg ${selectedShop?.isOpen ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                            {selectedShop?.isOpen ? '✅ OPEN' : '❌ CLOSED'}
                          </p>
                        </div>
                        <Button
                          variant={selectedShop?.isOpen ? 'destructive' : 'default'}
                          size="sm"
                          onClick={handleToggleShopOpen}
                          className="min-w-fit"
                        >
                          {selectedShop?.isOpen ? '🔴 Close Shop' : '🟢 Open Shop'}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-muted rounded mt-4">
                        <div>
                          <p className="font-medium">Booking Token Facility</p>
                          <p className="text-xs text-muted-foreground">
                            {selectedShop?.isTokenBookingEnabled !== false ? '✅ Enabled' : '❌ Disabled'}
                          </p>
                        </div>
                        <Switch
                          checked={selectedShop?.isTokenBookingEnabled !== false}
                          onCheckedChange={handleToggleTokenBookingFacility}
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-muted rounded mt-4">
                        <div>
                          <p className="font-medium">Token Booking</p>
                          <p className={selectedShop?.tokenBookingPaused ? 'text-orange-600 text-sm' : 'text-green-600 text-sm'}>
                            {selectedShop?.tokenBookingPaused ? '⏸️ Paused' : '▶️ Active'}
                          </p>
                        </div>
                        <Button
                          variant={selectedShop?.tokenBookingPaused ? 'default' : 'outline'}
                          size="sm"
                          onClick={handleToggleTokenBooking}
                        >
                          {selectedShop?.tokenBookingPaused ? (
                            <>
                              <Play className="mr-2 h-3 w-3" />
                              Resume
                            </>
                          ) : (
                            <>
                              <Pause className="mr-2 h-3 w-3" />
                              Pause
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3 sm:pb-4">
                      <CardTitle className="text-base sm:text-lg">Quick Stats</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 sm:space-y-3">
                      <div className="flex items-center justify-between p-2 sm:p-3 bg-muted rounded">
                        <span className="font-medium text-sm sm:text-base">Total Bookings</span>
                        <span className="text-xl sm:text-2xl font-bold">{bookings.length}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 sm:p-3 bg-muted rounded">
                        <span className="font-medium text-sm sm:text-base">Pending</span>
                        <span className="text-xl sm:text-2xl font-bold">{bookings.filter((b) => b.status === 'pending').length}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 sm:p-3 bg-muted rounded">
                        <span className="font-medium text-sm sm:text-base">In Progress</span>
                        <span className="text-xl sm:text-2xl font-bold">{bookings.filter((b) => b.status === 'in-progress').length}</span>
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

                <Card>
                  <CardHeader className="pb-3 sm:pb-4">
                    <CardTitle className="text-base sm:text-xl">Bookings</CardTitle>
                    <CardDescription className="text-xs">Customer booking details</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {bookings.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No bookings yet</p>
                    ) : (
                      <div className="space-y-2 sm:space-y-3">
                        {bookings.map((booking) => (
                          <div key={booking.id} className="border rounded-lg p-2 sm:p-4 space-y-2 sm:space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-2">
                                  <h3 className="font-semibold text-sm sm:text-lg truncate">{booking.userName}</h3>
                                  <span
                                    className={`px-2 py-1 rounded text-xs font-medium w-fit ${booking.status === 'pending'
                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100'
                                        : booking.status === 'in-progress'
                                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100'
                                          : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                                      }`}
                                  >
                                    {booking.status === 'pending' && '⏳ Pending'}
                                    {booking.status === 'in-progress' && '🔴 In Progress'}
                                    {booking.status === 'completed' && '✅ Completed'}
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground">
                                  <div>
                                    <p className="font-medium text-foreground">Service</p>
                                    <p className="truncate">{booking.serviceName}</p>
                                  </div>
                                  <div>
                                    <p className="font-medium text-foreground">Time</p>
                                    <p>{booking.timeSlot}</p>
                                  </div>
                                  <div>
                                    <p className="font-medium text-foreground">Token Number</p>
                                    <p className="text-lg font-bold text-primary">#{booking.tokenNumber}</p>
                                  </div>
                                  <div>
                                    <p className="font-medium text-foreground">Price</p>
                                    <p>{booking.servicePrice}</p>
                                  </div>
                                  <div>
                                    <p className="font-medium text-foreground">Date</p>
                                    <p>{formatIST(booking.bookingDate, false)}</p>
                                  </div>
                                  <div>
                                    <p className="font-medium text-foreground">Phone</p>
                                    <p className="truncate">{booking.userPhone}</p>
                                  </div>
                                </div>
                              </div>
                              <Button
                                onClick={() => handleCall(booking.userPhone)}
                                size="sm"
                                className="sm:ml-4 w-full sm:w-auto mt-2 sm:mt-0 text-xs sm:text-sm h-8 sm:h-9"
                              >
                                <Phone className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                                <span className="hidden sm:inline">Call</span>
                                <span className="sm:hidden">📱</span>
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
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
                  <IncomingBookingRequests
                    shopId={selectedShop.id}
                    timeSlotSettings={selectedShop.timeSlotSettings}
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
                {/* Booking Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg sm:text-2xl">Booking Settings</CardTitle>
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
                        onCheckedChange={(checked) => setFormData({ ...formData, isTokenBookingEnabled: checked })}
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
                        onCheckedChange={(checked) => setFormData({ ...formData, tokenBookingPaused: checked })}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Printing Service Settings */}
                <PrintingSettingsPanel shopId={selectedShop.id} />

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
                          placeholder="Enter email"
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="owner-phone" className="text-xs sm:text-sm">Phone</Label>
                        <Input
                          id="owner-phone"
                          value={formData.ownerPhone || ''}
                          onChange={(e) => setFormData({ ...formData, ownerPhone: e.target.value })}
                          placeholder="Enter phone number"
                          className="text-sm"
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t space-y-4">
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
                            placeholder="e.g. shopname@okicici"
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <Label htmlFor="advance-payment-mode" className="text-xs sm:text-sm">Advance Payment Mode</Label>
                          <select
                            id="advance-payment-mode"
                            value={formData.advancePaymentMode || 'none'}
                            onChange={(e) => setFormData({ ...formData, advancePaymentMode: e.target.value as any })}
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
                            <div className="relative inline-block">
                              <img
                                src={formData.shopImageUrl}
                                alt="Shop"
                                className="h-24 w-24 sm:h-40 sm:w-40 object-cover rounded border-2 border-primary"
                              />
                              <button
                                type="button"
                                onClick={() => shopImageInputRef.current?.click()}
                                className="absolute bottom-2 right-2 bg-primary text-primary-foreground p-1 sm:p-2 rounded-full hover:bg-primary/90 transition-colors"
                              >
                                <Camera className="h-3 w-3 sm:h-4 sm:w-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => shopImageInputRef.current?.click()}
                              className="flex flex-col items-center justify-center w-24 h-24 sm:w-40 sm:h-40 border-2 border-dashed border-muted-foreground rounded hover:border-primary transition-colors"
                            >
                              <Camera className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground mb-1 sm:mb-2" />
                              <span className="text-xs sm:text-sm text-muted-foreground">Upload</span>
                            </button>
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
                              onClick={() => shopVideoInputRef.current?.click()}
                              disabled={uploadingVideo}
                            >
                              <Upload className="h-6 w-6 text-muted-foreground" />
                              <span className="text-xs sm:text-sm">Upload from Gallery</span>
                            </Button>

                            <Button
                              variant="outline"
                              className="h-24 sm:h-32 flex flex-col gap-2 border-dashed"
                              onClick={() => setIsVideoRecorderOpen(true)}
                              disabled={uploadingVideo}
                            >
                              <Camera className="h-6 w-6 text-muted-foreground" />
                              <span className="text-xs sm:text-sm">Record with Camera</span>
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
                      </div>
                    </div>

                    {/* Google Maps Link */}
                    <div className="space-y-3">
                      <Label htmlFor="location-map" className="text-xs sm:text-sm">Google Maps Link</Label>
                      <div className="flex gap-2">
                        <Input
                          id="location-map"
                          value={formData.locationMapLink || ''}
                          onChange={(e) => setFormData({ ...formData, locationMapLink: e.target.value })}
                          placeholder="Paste your Google Maps link here"
                          className="text-sm flex-1"
                        />
                        {formData.locationMapLink && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(formData.locationMapLink, '_blank')}
                            className="shrink-0"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Test
                          </Button>
                        )}
                      </div>
                      {formData.latitude && formData.longitude && !formData.locationMapLink && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const link = generateGoogleMapsLink(formData.latitude, formData.longitude);
                            if (link) {
                              setFormData({ ...formData, locationMapLink: link });
                              notifySuccess('Google Maps link generated!', 'Location');
                            }
                          }}
                          className="w-full"
                        >
                          <MapPin className="h-4 w-4 mr-2" />
                          Generate Maps Link from Coordinates
                        </Button>
                      )}
                      <p className="text-[10px] text-muted-foreground italic">
                        Customers will use this link to find your shop.
                      </p>
                    </div>

                    {/* Auto-detect Location */}
                    <div className="border-t pt-3 sm:pt-4">
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
                            className="text-xs sm:text-sm"
                          />
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Input
                              placeholder="Village/City"
                              value={formData.village || ''}
                              onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                              className="text-xs sm:text-sm"
                            />
                            <Input
                              placeholder="District"
                              value={formData.district || ''}
                              onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                              className="text-xs sm:text-sm"
                            />
                            <Input
                              placeholder="State"
                              value={formData.state || ''}
                              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                              className="text-xs sm:text-sm"
                            />
                            <Input
                              placeholder="Country"
                              value={formData.country || ''}
                              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
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
                                className="text-xs sm:text-sm"
                              />
                              <Input
                                placeholder="Longitude (e.g., 77.2090)"
                                type="number"
                                step="0.0001"
                                value={formData.longitude || ''}
                                onChange={(e) => handleCoordinatesChange(formData.latitude, e.target.value ? parseFloat(e.target.value) : undefined)}
                                className="text-xs sm:text-sm"
                              />
                            </div>
                            <p className="text-[10px] text-muted-foreground italic mt-1">
                              Enter coordinates to automatically generate Google Maps link
                            </p>
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

                {/* Barber Members */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg sm:text-2xl">{getCategoryName()} Members</CardTitle>
                    <CardDescription>Manage your {getCategoryName().toLowerCase()} team</CardDescription>
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
                      <h4 className="font-medium">Add New {getCategoryName()}</h4>
                      <Input
                        placeholder={`${getCategoryName()} name`}
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
                        {newBarber.imageUrl ? (
                          <div className="relative inline-block">
                            <img
                              src={newBarber.imageUrl}
                              alt={getCategoryName()}
                              className="h-24 w-24 rounded-full object-cover border-2 border-primary"
                            />
                            <button
                              type="button"
                              onClick={() => barberImageInputRef.current?.click()}
                              className="absolute bottom-0 right-0 bg-primary text-primary-foreground p-1.5 rounded-full hover:bg-primary/90 transition-colors"
                            >
                              <Camera className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => barberImageInputRef.current?.click()}
                            className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-muted-foreground rounded-full hover:border-primary transition-colors"
                          >
                            <Camera className="h-5 w-5 text-muted-foreground" />
                          </button>
                        )}
                        <input
                          ref={barberImageInputRef}
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageUpload(e, 'barber')}
                          className="hidden"
                        />
                      </div>
                      <Button onClick={handleAddBarber} className="w-full">
                        <Plus className="mr-2 h-4 w-4" />
                        Add {getCategoryName()}
                      </Button>
                    </div>
                  </CardContent>
                </Card>


                {/* Featured Products */}
                {selectedShop && (
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
                          <div className="space-y-2">
                            <Label className="text-xs sm:text-sm">Product Image</Label>
                            {newFeaturedProduct.imageUrl ? (
                              <div className="relative inline-block">
                                <img
                                  src={newFeaturedProduct.imageUrl}
                                  alt="Product"
                                  className="h-32 w-32 rounded-lg object-cover border-2 border-primary"
                                />
                                <button
                                  type="button"
                                  onClick={() => productImageInputRef.current?.click()}
                                  className="absolute bottom-0 right-0 bg-primary text-primary-foreground p-1.5 rounded-full hover:bg-primary/90 transition-colors"
                                >
                                  <Camera className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => productImageInputRef.current?.click()}
                                className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-muted-foreground rounded-lg hover:border-primary transition-colors"
                              >
                                <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                                <span className="text-xs text-muted-foreground">Upload Image</span>
                              </button>
                            )}
                            <input
                              ref={productImageInputRef}
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleImageUpload(e, 'product')}
                              className="hidden"
                            />
                          </div>
                          <Button onClick={handleAddFeaturedProduct} className="w-full">
                            <Plus className="mr-2 h-4 w-4" />
                            Add Featured Product
                          </Button>
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
                                    <button
                                      onClick={() => handleDeleteFeaturedProduct(product.id)}
                                      className="absolute top-1 right-1 bg-white/80 hover:bg-red-500 hover:text-white text-red-500 p-1.5 rounded-full transition-all shadow-sm opacity-0 group-hover:opacity-100"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                  <CardContent className="p-2 space-y-1">
                                    <h5 className="font-bold text-[11px] line-clamp-1 text-slate-700 dark:text-slate-200">{product.title}</h5>
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

                {/* Shop Offers */}
                {selectedShop && (
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
                              <div className="relative inline-block">
                                <img
                                  src={newOffer.imageUrl}
                                  alt="Offer"
                                  className="h-32 w-32 rounded-lg object-cover border-2 border-primary"
                                />
                                <button
                                  type="button"
                                  onClick={() => offerImageInputRef.current?.click()}
                                  className="absolute bottom-0 right-0 bg-primary text-primary-foreground p-1.5 rounded-full hover:bg-primary/90 transition-colors"
                                >
                                  <Camera className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => offerImageInputRef.current?.click()}
                                className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-muted-foreground rounded-lg hover:border-primary transition-colors"
                              >
                                <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                                <span className="text-xs text-muted-foreground">Upload Image</span>
                              </button>
                            )}
                            <input
                              ref={offerImageInputRef}
                              type="file"
                              accept="image/*"
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
                  onChange={(settings) => setFormData({ ...formData, timeSlotSettings: settings })}
                />

                {/* Save Button */}
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sticky bottom-0 bg-background/95 backdrop-blur-sm p-3 sm:p-4 -mx-3 sm:-mx-4 -mb-3 sm:-mb-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentTab('dashboard')}
                    className="text-sm sm:text-base"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveSettings}
                    disabled={savingSettings}
                    className="text-sm sm:text-base"
                  >
                    {savingSettings ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
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
                    {selectedShop && <CampaignHistory shopId={selectedShop.id} />}
                  </>
                )}
              </div>
            )}

            {currentTab === 'customization' && selectedShop && (
              <div className="space-y-4 sm:space-y-6 pb-6">
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
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Shop Image</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedShop.shopImageUrl ? (
                      <div className="space-y-3">
                        <img src={selectedShop.shopImageUrl} alt="Shop" className="w-full h-64 object-cover rounded-lg border-2 border-primary" />
                        <Button variant="outline" className="w-full" onClick={() => shopImageInputRef.current?.click()}>
                          <Camera className="mr-2 h-4 w-4" />
                          Change Shop Image
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg">
                        <Camera className="h-12 w-12 text-muted-foreground mb-2" />
                        <p className="text-muted-foreground mb-4">No shop image uploaded yet</p>
                        <Button onClick={() => shopImageInputRef.current?.click()}>
                          <Upload className="mr-2 h-4 w-4" />
                          Upload Shop Image
                        </Button>
                      </div>
                    )}
                    <input ref={shopImageInputRef} type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'shop')} className="hidden" />
                  </CardContent>
                </Card>

                {/* Barber Images */}
                {selectedShop.barberMembers && selectedShop.barberMembers.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">{getCategoryName()} Images</CardTitle>
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
    </div>
  );
};
