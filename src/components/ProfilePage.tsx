import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Upload, Clock, MapPin, Edit, Trash2, Check, AlertCircle, Loader2, Phone, MessageCircle, MessageSquare, Store } from 'lucide-react';
import toast from 'react-hot-toast';
import { ProfileChatModal } from '@/components/ProfileChatModal';
import { ImageUploadModal } from '@/components/ImageUploadModal';
import { getBookingHistory, deleteBooking, type BookingHistoryItem } from '@/lib/booking-history';
import { getVideosByUploaderId, deleteVideoWithFile, checkUniqueProfileName } from '@/lib/videos-storage';
import { formatIST } from '@/lib/utils';
import { fetchUserLocation } from '@/lib/geolocation';
import { VideoUploadModal } from '@/components/VideoUploadModal';
import { CampaignAlertsSection } from '@/components/CampaignAlertsSection';
import { AnimatedCreature } from '@/components/AnimatedCreature';
import { CustomerOrdersPanel } from '@/components/CustomerOrdersPanel';
import { getLatestPlanForEmail, PLAN_DETAILS, type ShopOwnerPlan } from '@/lib/supabase-shop-owner-plans';
import { getUserDevicePassword, updateUserDevicePassword } from '@/lib/supabase-user-devices';
import { getUserProfile, type UserProfile } from '@/lib/supabase-user-profiles';
import type { Video } from '@/lib/videos-storage';
import { useNavigate, useLocation } from 'react-router-dom';

interface ProfilePageProps {
  onClose: () => void;
  onShopSelect: (shopId: string) => void;
  initialTab?: 'today' | 'history' | 'posts' | 'campaigns' | 'inbox';
  initiallyEditing?: boolean;
  openInbox?: number;
  targetUserId?: string;
}

type BookingTab = 'today' | 'history' | 'posts' | 'campaigns' | 'orders' | 'inbox';

export const ProfilePage = ({
  onClose,
  onShopSelect,
  initialTab = 'today',
  initiallyEditing = false,
  openInbox = 0,
  targetUserId,
}: ProfilePageProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Use URL param if available, otherwise fallback to prop
  const searchParams = new URLSearchParams(location.search);
  const urlTab = searchParams.get('tab') as any;
  const [activeTab, setActiveTab] = useState<any>(urlTab || initialTab);

  // Sync tab with URL
  const handleTabChange = (tab: any) => {
    setActiveTab(tab);
    navigate(`/profile?tab=${tab}`, { replace: true });
  };

  const { user, userRole, aggregatedData } = useAuth();
  const { profile: currentUserProfile, saveProfile, loading: profileLoading } = useUserProfile();
  const [targetProfile, setTargetProfile] = useState<UserProfile | null>(null);
  const [targetLoading, setTargetLoading] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [address, setAddress] = useState('');
  const [village, setVillage] = useState('');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [googleMapLink, setGoogleMapLink] = useState('');
  const [bookingHistory, setBookingHistory] = useState<BookingHistoryItem[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  const [selectedBookingsForDelete, setSelectedBookingsForDelete] = useState<Set<string>>(new Set());
  const longPressTimerRef = useRef<NodeJS.Timeout>();
  const [longPressBookingId, setLongPressBookingId] = useState<string | null>(null);

  const [currentPlan, setCurrentPlan] = useState<ShopOwnerPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [devicePassword, setDevicePassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const tabOrder: BookingTab[] = ['today', 'history', 'campaigns', 'orders', 'posts'];

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartXRef.current || !touchStartYRef.current) return;

    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    const deltaX = touchStartXRef.current - touchX;
    const deltaY = touchStartYRef.current - touchY;

    // If horizontal swipe is dominant
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (Math.abs(deltaX) > 50) {
        const currentIndex = tabOrder.indexOf(activeTab);
        if (deltaX > 0 && currentIndex < tabOrder.length - 1) {
          // Swipe left -> Next tab
          setActiveTab(tabOrder[currentIndex + 1]);
          setSelectedBookingsForDelete(new Set());
          touchStartXRef.current = null;
          touchStartYRef.current = null;
        } else if (deltaX < 0 && currentIndex > 0) {
          // Swipe right -> Previous tab
          setActiveTab(tabOrder[currentIndex - 1]);
          setSelectedBookingsForDelete(new Set());
          touchStartXRef.current = null;
          touchStartYRef.current = null;
        }
      }
    }
  };

  const handleTouchEnd = () => {
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  // Post tab states
  const [userVideos, setUserVideos] = useState<Video[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);

  // Profile chat modal state
  const [showProfileChatModal, setShowProfileChatModal] = useState((openInbox || 0) > 0);

  // Image upload modal state
  const [showImageUploadModal, setShowImageUploadModal] = useState(false);

  useEffect(() => {
    if (openInbox && openInbox > 0) {
      setShowProfileChatModal(true);
    }
  }, [openInbox]);

  useEffect(() => {
    if (initiallyEditing) {
      setIsEditing(true);
    }
  }, [initiallyEditing]);

  const isOwnProfile = !targetUserId || targetUserId === user?.uid;
  const displayProfile = isOwnProfile ? currentUserProfile : targetProfile;
  const isLoading = profileLoading || targetLoading;

  useEffect(() => {
    const fetchTargetProfile = async () => {
      if (targetUserId && targetUserId !== user?.uid) {
        setTargetLoading(true);
        try {
          const profileData = await getUserProfile(targetUserId);
          setTargetProfile(profileData);
        } catch (error) {
          console.error('Error fetching target profile:', error);
          toast.error('Failed to load user profile');
        } finally {
          setTargetLoading(false);
        }
      } else {
        setTargetProfile(null);
      }
    };

    fetchTargetProfile();
  }, [targetUserId, user?.uid]);

  useEffect(() => {
    if (displayProfile) {
      setName(displayProfile.name);
      setPhone(displayProfile.phone);
      setImagePreview(displayProfile.imageUrl || '');
      setAddress(displayProfile.address || '');
      setVillage(displayProfile.village || '');
      setDistrict(displayProfile.district || '');
      setState(displayProfile.state || '');
      setCountry(displayProfile.country || '');
      setLatitude(displayProfile.latitude || null);
      setLongitude(displayProfile.longitude || null);
      setGoogleMapLink(displayProfile.google_map_link || '');
    }

    const userIdToLoad = targetUserId || user?.uid;
    const userEmailToLoad = isOwnProfile ? user?.email : displayProfile?.email;

    if (userIdToLoad) {
      const history = getBookingHistory(userIdToLoad);
      setBookingHistory(history);

      // Load user's videos
      loadUserVideos(userIdToLoad);

      // Load user's plan
      if (userEmailToLoad) {
        loadUserPlan(userEmailToLoad);
      }

      // Load user's device password (only for own profile)
      if (isOwnProfile) {
        loadDevicePassword(userIdToLoad);
      }
    }
  }, [displayProfile, user, targetUserId, isOwnProfile]);

  // Load plan from aggregated data if available (only for own profile)
  useEffect(() => {
    if (isOwnProfile && aggregatedData?.activePlan) {
      console.log('📊 Setting current plan from aggregated data:', aggregatedData.activePlan);
      setCurrentPlan(aggregatedData.activePlan);
    }
  }, [aggregatedData, isOwnProfile]);

  const loadDevicePassword = async (userId: string) => {
    try {
      const password = await getUserDevicePassword(userId);
      if (password) {
        setDevicePassword(password);
      }
    } catch (error) {
      console.error('Error loading device password:', error);
    }
  };

  const handleUpdatePassword = async () => {
    if (!user || !isOwnProfile) return;
    if (!devicePassword.trim()) {
      toast.error('Password cannot be empty');
      return;
    }

    setUpdatingPassword(true);
    try {
      const success = await updateUserDevicePassword(user.uid, devicePassword);
      if (success) {
        toast.success('Portal password updated successfully!');
      } else {
        toast.error('Failed to update portal password');
      }
    } catch (error) {
      console.error('Error updating password:', error);
      toast.error('An error occurred while updating password');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const loadUserPlan = async (email: string) => {
    if (!email) return;
    setPlanLoading(true);
    try {
      const plan = await getLatestPlanForEmail(email);
      setCurrentPlan(plan);
    } catch (error) {
      console.error('Error loading user plan:', error);
    } finally {
      setPlanLoading(false);
    }
  };

  const loadUserVideos = async (userId: string) => {
    try {
      const videos = await getVideosByUploaderId(userId);
      setUserVideos(videos);
    } catch (error) {
      console.error('Error loading user videos:', error);
    }
  };

  const handleImageSelected = (file: File) => {
    setImage(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleGetLocation = async () => {
    setGettingLocation(true);
    try {
      const location = await fetchUserLocation();
      setAddress(location.formattedAddress);
      setVillage(location.village || '');
      setDistrict(location.district || '');
      setState(location.state || '');
      setCountry(location.country || '');
      setLatitude(location.latitude);
      setLongitude(location.longitude);

      const gMapLink = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
      setGoogleMapLink(gMapLink);

      toast.success('Location detected successfully!');
    } catch (error) {
      console.error('Error getting location:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to get your location');
    } finally {
      setGettingLocation(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwnProfile) return;

    if (!name.trim() || !phone.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setSaving(true);
    try {
      const success = await saveProfile(name, phone, image || undefined, {
        address: address || undefined,
        village: village || undefined,
        district: district || undefined,
        state: state || undefined,
        country: country || undefined,
        latitude: latitude || undefined,
        longitude: longitude || undefined,
        google_map_link: googleMapLink || undefined,
      });
      if (success) {
        toast.success('Profile updated successfully!');
        setImage(null);
        setIsEditing(false);
      }
    } catch (error: any) {
      const errorMsg = error?.message || 'An error occurred. Please try again.';
      console.error('Error saving profile:', errorMsg);
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };


  const handleDeleteVideo = async (videoId: string, videoUrl: string) => {
    if (!window.confirm('Are you sure you want to delete this video?')) {
      return;
    }

    setDeletingVideoId(videoId);
    try {
      const success = await deleteVideoWithFile(videoId, videoUrl);
      if (success) {
        setUserVideos((prev) => prev.filter((v) => v.id !== videoId));
        toast.success('Video deleted successfully!');
      } else {
        toast.error('Failed to delete video');
      }
    } catch (error: any) {
      const errorMsg = error?.message || 'Failed to delete video';
      console.error('Error deleting video:', errorMsg);
      toast.error(errorMsg);
    } finally {
      setDeletingVideoId(null);
    }
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const todayBookings = bookingHistory.filter((booking) =>
    isToday(new Date(booking.bookingDate))
  );

  const historyBookings = bookingHistory.filter(
    (booking) => !isToday(new Date(booking.bookingDate))
  );

  const handleLongPressStart = (bookingId: string) => {
    longPressTimerRef.current = setTimeout(() => {
      setLongPressBookingId(bookingId);
      const newSelected = new Set(selectedBookingsForDelete);
      newSelected.add(bookingId);
      setSelectedBookingsForDelete(newSelected);
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
  };

  const toggleBookingSelection = (bookingId: string) => {
    const newSelected = new Set(selectedBookingsForDelete);
    if (newSelected.has(bookingId)) {
      newSelected.delete(bookingId);
    } else {
      newSelected.add(bookingId);
    }
    setSelectedBookingsForDelete(newSelected);
  };

  const handleDeleteBookings = async () => {
    if (selectedBookingsForDelete.size === 0 || !isOwnProfile) return;

    setSaving(true);
    try {
      for (const bookingId of selectedBookingsForDelete) {
        if (user) {
          deleteBooking(user.uid, bookingId);
        }
      }
      const userIdToLoad = targetUserId || user?.uid;
      const history = userIdToLoad ? getBookingHistory(userIdToLoad) : [];
      setBookingHistory(history);
      setSelectedBookingsForDelete(new Set());
      setLongPressBookingId(null);
      toast.success(`${selectedBookingsForDelete.size} booking(s) deleted!`);
    } catch (error: any) {
      toast.error('Failed to delete bookings');
      console.error('Error deleting bookings:', error);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-600 to-pink-500 flex items-center justify-center">
        <p className="text-white text-lg">Loading profile...</p>
      </div>
    );
  }

  const userIdToDisplay = targetUserId || user?.uid;
  const firstLetter = displayProfile?.name?.[0]?.toUpperCase() || displayProfile?.email?.[0]?.toUpperCase() || '?';
  const getBackgroundColor = (letter: string) => {
    const colors = [
      'bg-red-500',
      'bg-blue-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-orange-500',
    ];
    const index = letter.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Beautiful Gradient Header with 3D Background */}
      <div className="relative bg-gradient-to-b from-red-600 via-red-500 to-pink-500 text-white p-2 sm:p-4 flex items-center justify-between flex-shrink-0 overflow-hidden shadow-lg">
        {/* Decorative 3D Wave Background - Hidden on mobile */}
        <div className="absolute inset-0 opacity-20 hidden sm:block">
          <svg viewBox="0 0 1200 120" className="w-full h-full" preserveAspectRatio="none">
            <path d="M0,50 Q300,30 600,50 T1200,50 L1200,120 L0,120 Z" fill="white" opacity="0.1" />
            <path d="M0,70 Q300,50 600,70 T1200,70 L1200,120 L0,120 Z" fill="white" opacity="0.05" />
          </svg>
        </div>

        {/* Floating 3D Shapes - Hidden on mobile */}
        <div className="absolute top-2 right-12 w-32 h-32 bg-white/10 rounded-full blur-3xl animate-pulse hidden sm:block"></div>
        <div className="absolute -top-8 -left-8 w-40 h-40 bg-white/5 rounded-full blur-3xl hidden sm:block"></div>

        {/* Content */}
        <div className="relative z-10 flex items-center justify-between w-full gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate('/')}
              className="hover:opacity-80 transition-opacity p-1 hover:bg-white/20 rounded-lg"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-lg sm:text-2xl font-bold">
              {isOwnProfile ? 'Profile' : `${displayProfile?.name}'s Profile`}
            </h1>
          </div>
          {!isEditing && isOwnProfile && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setShowUploadModal(true);
                  handleTabChange('posts');
                }}
                className="hover:opacity-80 transition-opacity flex flex-col items-center gap-0.5 hover:bg-white/20 p-1 rounded"
                title="Upload video"
              >
                <Upload className="h-5 w-5" />
                <span className="text-[10px] font-medium">upload</span>
              </button>
              <button
                onClick={() => setIsEditing(true)}
                className="hover:opacity-80 transition-opacity flex flex-col items-center gap-0.5 p-1 hover:bg-white/20 rounded"
                title="Edit profile"
              >
                <Edit className="h-5 w-5" />
                <span className="text-[10px] font-medium">edit</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Beautiful Background with Gradient and Decorative Elements */}
      <div className="relative flex-1 overflow-y-auto overflow-x-hidden bg-gradient-to-b from-slate-50 via-slate-100 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        {/* Decorative Background Elements with Creatures - Hidden on mobile */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden hidden sm:block">
          <div className="absolute top-20 -right-40 w-80 h-80 bg-red-200/20 dark:bg-red-900/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-40 -left-40 w-80 h-80 bg-pink-200/20 dark:bg-pink-900/10 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-gradient-to-br from-red-100/10 to-pink-100/10 dark:from-red-900/5 dark:to-pink-900/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>

          {/* Animated creatures */}
          <div className="absolute top-32 right-20 opacity-25 dark:opacity-15">
            <AnimatedCreature size="lg" color="text-red-400" />
          </div>
          <div className="absolute bottom-20 left-10 opacity-20 dark:opacity-10 -scale-x-100">
            <AnimatedCreature size="md" color="text-pink-500" />
          </div>
        </div>

        <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-4 max-w-2xl relative z-10">
          {/* Profile Card - Always visible but content changes based on edit mode */}
          <Card className="mb-2 sm:mb-4 shadow-xl border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-center text-base sm:text-xl font-bold mb-3">Profile</CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-4">
              {isEditing ? (
                <form onSubmit={handleSave} className="space-y-2 sm:space-y-3">
                  {/* Profile Image */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative">
                      {imagePreview ? (
                        <img
                          src={imagePreview}
                          alt="Profile"
                          className="h-24 sm:h-32 w-24 sm:w-32 rounded-full object-cover border-2 sm:border-4 border-red-500 shadow-lg"
                        />
                      ) : (
                        <div
                          className={`h-24 sm:h-32 w-24 sm:w-32 rounded-full flex items-center justify-center text-3xl sm:text-5xl font-bold text-white ${getBackgroundColor(
                            firstLetter
                          )} border-2 sm:border-4 border-red-500 shadow-lg`}
                        >
                          {firstLetter}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowImageUploadModal(true)}
                        className="absolute bottom-0 right-0 bg-red-500 text-white p-1.5 sm:p-2 rounded-full hover:bg-red-600 transition-colors shadow-lg"
                        title="Change profile image"
                      >
                        <Upload className="h-3 w-3 sm:h-4 sm:w-4" />
                      </button>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                      {isOwnProfile ? user?.email : displayProfile?.email}
                    </p>
                  </div>

                  {/* Name Field */}
                  <div className="space-y-1">
                    <Label htmlFor="name" className="text-xs sm:text-sm font-bold">Name</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="Enter your full name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="h-8 sm:h-10 text-sm"
                    />
                  </div>

                  {/* Phone Field */}
                  <div className="space-y-1">
                    <Label htmlFor="phone" className="text-xs sm:text-sm font-bold">Phone</Label>
                    <div className="flex items-center border border-input rounded-md bg-background">
                      <span className="px-3 py-2 sm:py-3 text-sm sm:text-base font-semibold text-muted-foreground bg-muted/50 border-r border-input">
                        +91
                      </span>
                      <input
                        id="phone"
                        type="tel"
                        placeholder="10 digits only"
                        maxLength={10}
                        value={phone}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setPhone(value);
                        }}
                        inputMode="numeric"
                        required
                        className="flex-1 px-3 py-2 sm:py-3 text-sm sm:text-base bg-transparent outline-none"
                      />
                    </div>
                  </div>

                  {/* Location Section */}
                  <div className="border-t pt-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Address</h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleGetLocation}
                        disabled={gettingLocation}
                      >
                        {gettingLocation ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Auto filling...
                          </>
                        ) : (
                          <>
                            <MapPin className="mr-2 h-4 w-4" />
                            Auto fill
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Village Field */}
                    <div className="space-y-2">
                      <Label htmlFor="village">Village</Label>
                      <Input
                        id="village"
                        type="text"
                        placeholder="Enter village name"
                        value={village}
                        onChange={(e) => setVillage(e.target.value)}
                      />
                    </div>

                    {/* District Field */}
                    <div className="space-y-2">
                      <Label htmlFor="district">District</Label>
                      <Input
                        id="district"
                        type="text"
                        placeholder="Enter district name"
                        value={district}
                        onChange={(e) => setDistrict(e.target.value)}
                      />
                    </div>

                    {/* State Field */}
                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        type="text"
                        placeholder="Enter state name"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                      />
                    </div>

                    {/* Country Field */}
                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <Input
                        id="country"
                        type="text"
                        placeholder="Enter country name"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                      />
                    </div>

                    {/* Full Address Field */}
                    <div className="space-y-2">
                      <Label htmlFor="address">Full Address</Label>
                      <Input
                        id="address"
                        type="text"
                        placeholder="Full address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                      />
                    </div>

                    {/* Google Map Link Field */}
                    <div className="space-y-2">
                      <Label htmlFor="googleMapLink">Google Map Link</Label>
                      <Input
                        id="googleMapLink"
                        type="text"
                        placeholder="Enter Google Map link or use Auto fill"
                        value={googleMapLink}
                        onChange={(e) => setGoogleMapLink(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Save and Cancel Buttons */}
                  <div className="flex gap-3">
                    <Button
                      type="submit"
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                      disabled={saving}
                      size="lg"
                    >
                      {saving ? 'Saving...' : 'Save Profile'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      size="lg"
                      onClick={() => {
                        setIsEditing(false);
                        // Reset form to original values
                        if (currentUserProfile) {
                          setName(currentUserProfile.name);
                          setPhone(currentUserProfile.phone);
                          setAddress(currentUserProfile.address || '');
                          setVillage(currentUserProfile.village || '');
                          setDistrict(currentUserProfile.district || '');
                          setState(currentUserProfile.state || '');
                          setCountry(currentUserProfile.country || '');
                          setLatitude(currentUserProfile.latitude || null);
                          setLongitude(currentUserProfile.longitude || null);
                          setGoogleMapLink(currentUserProfile.google_map_link || '');
                        }
                        setImage(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  {/* Shop Owner Status Badge - Top of Profile */}
                  {aggregatedData?.isShopOwner && (
                    <div>
                      <span className="inline-block px-6 py-2 rounded-full text-sm font-bold bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg">
                        ✓ Shop Owner
                      </span>
                    </div>
                  )}

                  {/* Profile Image - View Mode */}
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex flex-col items-center gap-1">
                      {imagePreview ? (
                        <img
                          src={imagePreview}
                          alt="Profile"
                          className="h-40 w-40 rounded-full object-cover border-4 border-red-500 shadow-lg"
                        />
                      ) : (
                        <div
                          className={`h-40 w-40 rounded-full flex items-center justify-center text-6xl font-bold text-white ${getBackgroundColor(
                            firstLetter
                          )} border-4 border-red-500 shadow-lg`}
                        >
                          {firstLetter}
                        </div>
                      )}
                      <div className="flex gap-3 text-xs font-bold text-muted-foreground mt-1">
                        <span>Edit</span>
                        <span>Upload</span>
                      </div>
                    </div>
                    <div className="text-center">
                      <h2 className="text-2xl font-bold">{name || 'Not provided'}</h2>
                      <p className="text-sm text-muted-foreground">
                        {isOwnProfile ? user?.email : displayProfile?.email}
                      </p>
                    </div>
                  </div>

                  {/* Display Profile Info */}
                  <div className="space-y-3 border-t pt-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Full Name</p>
                      <p className="text-base font-semibold">{name || 'Not provided'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Phone Number</p>
                      <p className="text-base font-semibold">{phone ? `+91 ${phone}` : 'Not provided'}</p>
                    </div>

                    {/* Account Type - Only show if not shop owner (since it's already shown at top) */}
                    {!aggregatedData?.isShopOwner && (
                      <div className="border-t pt-4">
                        <p className="text-sm font-medium text-muted-foreground mb-2">Account Type</p>
                        <div className="flex flex-wrap gap-2">
                          <span className="inline-block px-4 py-2 rounded-full text-sm font-semibold bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200">
                            Customer Account
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Device/Portal Password Section - Only show when editing */}
                    {isEditing && (
                      <div className="border-t pt-4">
                        <p className="text-sm font-medium text-muted-foreground mb-2">Portal Access Password</p>
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                            <Input
                              type="text"
                              placeholder="Enter new portal password"
                              value={devicePassword}
                              onChange={(e) => setDevicePassword(e.target.value)}
                              className="h-10 text-sm"
                            />
                            <Button
                              onClick={handleUpdatePassword}
                              disabled={updatingPassword}
                              className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
                            >
                              {updatingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update'}
                            </Button>
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            This password is used for specialized portal access on this device.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Current Plan - Show if available */}
                    {(currentPlan) && (currentPlan)?.payment_status === 'success' && (
                      <div className="border-t pt-4">
                        <p className="text-sm font-medium text-muted-foreground mb-2">Current Plan</p>
                        <span className="inline-block px-4 py-3 rounded-lg text-sm font-bold bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg">
                          {PLAN_DETAILS[(currentPlan)!.plan_name].name} Plan
                        </span>
                      </div>
                    )}

                    {/* Address Section */}
                    {(address || village || district || state || country) && (
                      <>
                        <div className="border-t pt-4 mt-4">
                          <div className="flex items-center gap-2 mb-3">
                            <MapPin className="h-4 w-4 text-red-500" />
                            <p className="font-semibold">Address</p>
                          </div>
                          <div className="space-y-2 text-sm">
                            {village && (
                              <div>
                                <p className="text-muted-foreground">Village</p>
                                <p className="text-base">{village}</p>
                              </div>
                            )}
                            {district && (
                              <div>
                                <p className="text-muted-foreground">District</p>
                                <p className="text-base">{district}</p>
                              </div>
                            )}
                            {state && (
                              <div>
                                <p className="text-muted-foreground">State</p>
                                <p className="text-base">{state}</p>
                              </div>
                            )}
                            {country && (
                              <div>
                                <p className="text-muted-foreground">Country</p>
                                <p className="text-base">{country}</p>
                              </div>
                            )}
                            {address && (
                              <div>
                                <p className="text-muted-foreground">Full Address</p>
                                <p className="text-base">{address}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    {/* Action Buttons Section */}
                    <div className="border-t pt-4 mt-4 space-y-4">
                      {userRole?.type === 'shop_owner' && userRole?.shopId && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-muted-foreground">Shop Management</p>
                          <button
                            onClick={() => navigate(`/shop/${userRole.shopId}`)}
                            className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors shadow-md hover:shadow-lg"
                          >
                            <Store className="h-5 w-5" />
                            View Shop
                          </button>
                        </div>
                      )}

                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground mb-3">Contact</p>
                        {/* Call Button */}
                        <a
                          href={`tel:+91${phone}`}
                          className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors shadow-md hover:shadow-lg"
                        >
                          <Phone className="h-5 w-5" />
                          Call
                        </a>

                        {/* WhatsApp Button */}
                        <a
                          href={`https://wa.me/91${phone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors shadow-md hover:shadow-lg"
                        >
                          <MessageCircle className="h-5 w-5" />
                          WhatsApp
                        </a>

                        {/* Chat Button */}
                        <button
                          onClick={() => setShowProfileChatModal(true)}
                          className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors shadow-md hover:shadow-lg"
                        >
                          <MessageSquare className="h-5 w-5" />
                          Inbox
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Swipeable Content Area */}
          <div
            className="flex flex-col flex-1 min-h-0"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Tabs */}
            <div className="mb-2 flex gap-1 border-b border-border overflow-x-auto bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-t-lg p-1">
              <button
                onClick={() => {
                  handleTabChange('today');
                  setSelectedBookingsForDelete(new Set());
                }}
                className={`px-2 py-1 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap rounded ${activeTab === 'today'
                    ? 'bg-red-500 text-white shadow-lg'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
                  }`}
              >
                Today ({todayBookings.length})
              </button>
              <button
                onClick={() => {
                  handleTabChange('history');
                  setSelectedBookingsForDelete(new Set());
                }}
                className={`px-2 py-1 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap rounded ${activeTab === 'history'
                    ? 'bg-red-500 text-white shadow-lg'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
                  }`}
              >
                History ({historyBookings.length})
              </button>
              <button
                onClick={() => {
                  handleTabChange('campaigns');
                  setSelectedBookingsForDelete(new Set());
                }}
                className={`px-2 py-1 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap rounded ${activeTab === 'campaigns'
                    ? 'bg-red-500 text-white shadow-lg'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
                  }`}
              >
                Campaigns
              </button>
              <button
                onClick={() => {
                  handleTabChange('orders');
                  setSelectedBookingsForDelete(new Set());
                }}
                className={`px-2 py-1 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap rounded ${activeTab === 'orders'
                    ? 'bg-red-500 text-white shadow-lg'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
                  }`}
              >
                Orders
              </button>
              <button
                onClick={() => {
                  handleTabChange('posts');
                  setSelectedBookingsForDelete(new Set());
                }}
                className={`px-2 py-1 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap rounded ${activeTab === 'posts'
                    ? 'bg-red-500 text-white shadow-lg'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
                  }`}
              >
                Posts
              </button>
            </div>

            {/* Content Card */}
            <Card className="shadow-xl border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between py-2 px-2 sm:px-4">
                <CardTitle className="text-sm sm:text-base font-bold">
                  {activeTab === 'today' ? "Today" : activeTab === 'history' ? 'History' : activeTab === 'campaigns' ? 'Alerts' : activeTab === 'orders' ? 'My Orders' : 'Posts'}
                </CardTitle>
                {activeTab === 'history' && selectedBookingsForDelete.size > 0 && (
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteBookings}
                      disabled={saving}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete ({selectedBookingsForDelete.size})
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedBookingsForDelete(new Set())}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
                {activeTab === 'posts' && (
                  <Button
                    onClick={() => setShowUploadModal(true)}
                    className="bg-red-500 text-white hover:bg-red-600 font-semibold px-4 py-2"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Video
                  </Button>
                )}
              </CardHeader>
              <CardContent className="overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    {activeTab === 'campaigns' ? (
                      user ? (
                        <CampaignAlertsSection userId={user.uid} />
                      ) : (
                        <p className="text-center text-muted-foreground py-8">Please log in to view campaigns</p>
                      )
                    ) : activeTab === 'orders' ? (
                      user ? (
                        <CustomerOrdersPanel customerId={user.uid} />
                      ) : (
                        <p className="text-center text-muted-foreground py-8">Please log in to view your orders</p>
                      )
                    ) : activeTab !== 'posts' && (activeTab === 'today' ? todayBookings : historyBookings).length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        {activeTab === 'today'
                          ? "No bookings for today. Schedule one now!"
                          : "No booking history. Start booking to see your history here!"}
                      </p>
                    ) : activeTab === 'posts' && userVideos.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground mb-4">No videos yet. Upload your first video!</p>
                      </div>
                    ) : activeTab === 'posts' ? (
                      userVideos.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">No videos yet. Upload your first video!</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {userVideos.map((video) => (
                            <div
                              key={video.id}
                              className="relative group border rounded-lg overflow-hidden bg-black shadow-lg hover:shadow-xl transition-shadow"
                            >
                              <video
                                src={video.videoUrl}
                                className="w-full h-40 object-cover"
                                crossOrigin="anonymous"
                                preload="metadata"
                              />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeleteVideo(video.id, video.videoUrl)}
                                  disabled={deletingVideoId === video.id}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  {deletingVideoId === video.id ? 'Deleting...' : 'Delete'}
                                </Button>
                              </div>
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-2">
                                <p className="text-white text-xs truncate">{video.caption || 'Untitled'}</p>
                                <p className="text-white/70 text-xs">{video.likes} likes • {video.duration}s</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    ) : (
                      <div className="space-y-4">
                        {(activeTab === 'today' ? todayBookings : historyBookings)
                          .sort((a, b) => b.createdAt - a.createdAt)
                          .map((booking) => (
                            <div
                              key={booking.id}
                              onMouseDown={() => {
                                if (activeTab === 'history') {
                                  handleLongPressStart(booking.id);
                                }
                              }}
                              onMouseUp={handleLongPressEnd}
                              onMouseLeave={handleLongPressEnd}
                              onTouchStart={() => {
                                if (activeTab === 'history') {
                                  handleLongPressStart(booking.id);
                                }
                              }}
                              onTouchEnd={handleLongPressEnd}
                              className={`border rounded-lg p-4 space-y-2 transition-colors cursor-pointer ${selectedBookingsForDelete.has(booking.id)
                                  ? 'bg-red-50 border-red-300 dark:bg-red-950 dark:border-red-700'
                                  : 'border-border hover:border-red-500/50 shadow-sm hover:shadow-md'
                                } ${activeTab === 'history' ? 'select-none' : ''}`}
                              onClick={() => {
                                if (activeTab === 'history' && longPressBookingId) {
                                  toggleBookingSelection(booking.id);
                                }
                              }}
                            >
                              <div className="flex items-start justify-between gap-4">
                                {activeTab === 'history' && selectedBookingsForDelete.size > 0 && (
                                  <input
                                    type="checkbox"
                                    checked={selectedBookingsForDelete.has(booking.id)}
                                    onChange={() => toggleBookingSelection(booking.id)}
                                    className="mt-1 cursor-pointer"
                                  />
                                )}
                                <div className="flex-1">
                                  <h3 className="font-semibold">{booking.shopName}</h3>
                                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-1">
                                      <Clock className="h-4 w-4" />
                                      <span>{booking.timeSlot}</span>
                                    </div>
                                    <div>
                                      {formatIST(booking.bookingDate, false)}
                                    </div>
                                  </div>
                                </div>
                                <span
                                  className={`px-3 py-1 rounded-full text-xs font-semibold ${booking.status === 'completed'
                                      ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
                                      : booking.status === 'cancelled'
                                        ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200'
                                        : booking.status === 'in-progress'
                                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                                          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200'
                                    }`}
                                >
                                  {booking.status.charAt(0).toUpperCase() +
                                    booking.status.slice(1)}
                                </span>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Token #{booking.tokenNumber}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </CardContent>
            </Card>
          </div>

          {/* Upload Modal */}
          {showUploadModal && (
            <VideoUploadModal
              onClose={() => setShowUploadModal(false)}
              onVideoUploaded={() => {
                setShowUploadModal(false);
                if (user) {
                  loadUserVideos(user.uid);
                }
              }}
              sourceContext="profile"
            />
          )}

          {/* Profile Chat Modal */}
          {userIdToDisplay && (
            <ProfileChatModal
              isOpen={showProfileChatModal}
              onClose={() => setShowProfileChatModal(false)}
              profileUserId={userIdToDisplay}
              profileUserName={displayProfile?.name || 'User'}
              profileUserEmail={displayProfile?.email || undefined}
              onLoginRequired={() => {
                // This shouldn't happen since we're checking user exists above
              }}
            />
          )}

          {/* Image Upload Modal */}
          <ImageUploadModal
            isOpen={showImageUploadModal}
            onClose={() => setShowImageUploadModal(false)}
            onImageSelected={handleImageSelected}
            imageType="profile photo"
            title="Add Profile Photo"
          />
        </div>
      </div>
    </div>
  );
};
