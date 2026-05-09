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
import { CampaignAlertsSection } from '@/components/CampaignAlertsSection';
import { AnimatedCreature } from '@/components/AnimatedCreature';
import { CustomerOrdersPanel } from '@/components/CustomerOrdersPanel';
import { getLatestPlanForEmail, PLAN_DETAILS, type ShopOwnerPlan } from '@/lib/supabase-shop-owner-plans';
import { getUserDevicePassword, updateUserDevicePassword } from '@/lib/supabase-user-devices';
import { getUserProfile, type UserProfile } from '@/lib/supabase-user-profiles';
import type { Video } from '@/lib/videos-storage';
import { useNavigate, useLocation, useParams } from 'react-router-dom';

interface ProfilePageProps {
  onClose: () => void;
  onShopSelect: (shopId: string) => void;
  initialTab?: 'today' | 'history' | 'posts' | 'campaigns' | 'inbox';
  initiallyEditing?: boolean;
  openInbox?: number;
  targetUserId?: string;
}

type BookingTab = 'today' | 'history' | 'campaigns' | 'orders' | 'posts';

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
  const { userId: routeUserId } = useParams();
  const effectiveTargetUserId = routeUserId || targetUserId;
  const searchParams = new URLSearchParams(location.search);
  const urlTab = searchParams.get('tab') as any;
  const [activeTab, setActiveTab] = useState<any>(urlTab || initialTab);
  const isExpanded = searchParams.get('expanded') === 'true';

  const handleTabChange = (tab: any) => {
    setActiveTab(tab);
    navigate(`/profile${effectiveTargetUserId ? `/${effectiveTargetUserId}` : ''}?tab=${tab}&expanded=true`, { replace: false });
  };

  const handleCloseExpanded = () => {
    navigate(`/profile${effectiveTargetUserId ? `/${effectiveTargetUserId}` : ''}?tab=${activeTab}`, { replace: true });
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
  const [address, setAddress] = useState('');
  const [village, setVillage] = useState('');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [instagramId, setInstagramId] = useState('');
  const [facebookId, setFacebookId] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [bookingHistory, setBookingHistory] = useState<BookingHistoryItem[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [userVideos, setUserVideos] = useState<Video[]>([]);
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);
  const [showProfileChatModal, setShowProfileChatModal] = useState((openInbox || 0) > 0);
  const [showImageUploadModal, setShowImageUploadModal] = useState(false);

  const selectedBookingsForDelete = new Set<string>(); // Simplified for now
  const toggleBookingSelection = (id: string) => {}; // Simplified
  const handleLongPressStart = (id: string) => {}; // Simplified
  const handleLongPressEnd = () => {}; // Simplified

  const tabOrder: BookingTab[] = ['today', 'history', 'campaigns', 'orders', 'posts'];

  useEffect(() => {
    const fetchTargetProfile = async () => {
      if (effectiveTargetUserId && effectiveTargetUserId !== user?.uid) {
        setTargetLoading(true);
        try {
          const profileData = await getUserProfile(effectiveTargetUserId);
          setTargetProfile(profileData);
        } catch (error) {
          console.error('Error fetching target profile:', error);
        } finally {
          setTargetLoading(false);
        }
      } else {
        setTargetProfile(null);
      }
    };
    fetchTargetProfile();
  }, [effectiveTargetUserId, user?.uid]);

  useEffect(() => {
    const displayProfile = !effectiveTargetUserId || effectiveTargetUserId === user?.uid ? currentUserProfile : targetProfile;
    if (displayProfile) {
      setName(displayProfile.name);
      setPhone(displayProfile.phone);
      setImagePreview(displayProfile.imageUrl || '');
      setInstagramUrl(displayProfile.instagram_url || '');
      setFacebookUrl(displayProfile.facebook_url || '');
      setAddress(displayProfile.address || '');
      setVillage(displayProfile.village || '');
      setDistrict(displayProfile.district || '');
      setState(displayProfile.state || '');
      setCountry(displayProfile.country || '');
      setInstagramId(displayProfile.instagram_id || '');
      setFacebookId(displayProfile.facebook_id || '');
    }
  }, [currentUserProfile, targetProfile, effectiveTargetUserId, user?.uid]);

  useEffect(() => {
    const userIdToLoad = effectiveTargetUserId || user?.uid;
    if (!userIdToLoad) return;

    if (activeTab === 'today' || activeTab === 'history') {
      if (bookingHistory.length === 0) {
        setBookingHistory(getBookingHistory(userIdToLoad));
      }
    } else if (activeTab === 'posts') {
      if (userVideos.length === 0) {
        getVideosByUploaderId(userIdToLoad).then(setUserVideos);
      }
    }
  }, [activeTab, effectiveTargetUserId, user?.uid]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const success = await saveProfile(name, phone, image || undefined, {
        instagram_url: instagramUrl || undefined,
        facebook_url: facebookUrl || undefined,
        instagram_id: instagramId || undefined,
        facebook_id: facebookId || undefined,
        address,
        village,
        district,
        state,
        country,
      });
      if (success) {
        toast.success('Profile updated!');
        setIsEditing(false);
      }
    } catch (error) {
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVideo = async (id: string, url: string) => {
    if (!confirm('Delete video?')) return;
    setDeletingVideoId(id);
    try {
      await deleteVideoWithFile(id, url);
      setUserVideos(prev => prev.filter(v => v.id !== id));
      toast.success('Video deleted');
    } catch (error) {
      toast.error('Delete failed');
    } finally {
      setDeletingVideoId(null);
    }
  };

  const handleImageSelected = (file: File) => {
    setImage(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleAutoFillAddress = async () => {
    try {
      toast.loading('Fetching location...', { id: 'locationToast' });
      const location = await fetchUserLocation();
      if (location) {
        setAddress(location.address || '');
        setVillage(location.village || '');
        setDistrict(location.district || '');
        setState(location.state || '');
        setCountry(location.country || '');
        toast.success('Address filled!', { id: 'locationToast' });
      }
    } catch (error) {
      toast.error('Failed to get location. Check permissions.', { id: 'locationToast' });
    }
  };

  const isOwnProfile = !effectiveTargetUserId || effectiveTargetUserId === user?.uid;
  const userIdToLoad = effectiveTargetUserId || user?.uid;

  if (profileLoading || targetLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-white" />
      </div>
    );
  }

  const todayBookings = bookingHistory.filter(b => {
    const d = new Date(b.bookingDate);
    const now = new Date();
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const historyBookings = bookingHistory.filter(b => {
    const d = new Date(b.bookingDate);
    const now = new Date();
    return !(d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear());
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Premium 3D Shining Black Header */}
      <div className="relative pb-12 overflow-hidden shadow-2xl" style={{ 
        background: 'linear-gradient(145deg, #2a2a2a, #000000)',
        boxShadow: 'inset 0 -20px 50px rgba(0,0,0,0.6)'
      }}>
        {/* Glossy Reflection */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-transparent pointer-events-none opacity-40" />
        <div className="absolute top-0 left-0 right-0 h-px bg-white/20" />
        
        {/* Navigation Buttons */}
        <div className="relative z-20 flex justify-between p-4">
          <button onClick={() => navigate(-1)} className="p-3 bg-white/10 backdrop-blur-xl rounded-2xl text-white border border-white/10 shadow-2xl hover:bg-white/20 transition-all">
            <ArrowLeft className="h-5 w-5" />
          </button>
          {isOwnProfile && !isEditing && (
            <button onClick={() => setIsEditing(true)} className="p-3 bg-white/10 backdrop-blur-xl rounded-2xl text-white border border-white/10 shadow-2xl hover:bg-white/20 transition-all">
              <Edit className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Profile Avatar */}
        <div className="flex justify-center -mt-2">
          <div className="relative group">
            <div className="w-32 h-32 rounded-full border-4 border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.7)] overflow-hidden bg-slate-900 transition-transform group-hover:scale-105 duration-700 relative z-10">
              {imagePreview ? (
                <img src={imagePreview} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/10 font-black text-4xl bg-gradient-to-br from-slate-800 to-slate-900">
                  {name?.[0] || user?.email?.[0] || '?'}
                </div>
              )}
              {isEditing && (
                <button onClick={() => setShowImageUploadModal(true)} className="absolute inset-0 bg-black/70 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm">
                  <Upload className="h-6 w-6" />
                </button>
              )}
            </div>
            <div className="absolute -inset-1 bg-gradient-to-b from-white/20 to-transparent rounded-full blur-md opacity-50" />
          </div>
        </div>

        {/* Name and Email */}
        <div className="pt-8 text-center px-6 space-y-2">
          <h2 className="text-4xl font-black text-white tracking-tighter uppercase italic drop-shadow-2xl">
            {isEditing ? (
              <input className="text-center bg-white/5 border-b-2 border-red-500 outline-none w-full max-w-[300px] rounded-t-2xl py-2 px-4 text-white font-black" value={name} onChange={e => setName(e.target.value)} placeholder="Full Name" />
            ) : (
              name || 'User Profile'
            )}
          </h2>
          <div className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)] animate-pulse" />
            <p className="text-white/30 text-[10px] font-black tracking-[0.3em] uppercase">
              {isOwnProfile ? user?.email : targetProfile?.email}
            </p>
          </div>
        </div>

        {/* Action Buttons - Grey/White Style */}
        {!isEditing && (
          <div className="flex justify-center gap-5 mt-10 px-6">
            <a href={`tel:+91${phone}`} className="w-14 h-14 bg-white/95 rounded-3xl flex items-center justify-center shadow-2xl transition-all active:scale-90 border border-white/20 group hover:bg-white">
              <Phone className="h-6 w-6 text-slate-900 group-hover:rotate-12 transition-transform" />
            </a>
            <a href={`https://wa.me/91${phone}`} target="_blank" className="w-14 h-14 bg-white/95 rounded-3xl flex items-center justify-center shadow-2xl transition-all active:scale-90 border border-white/20 group hover:bg-white">
              <MessageCircle className="h-6 w-6 text-slate-900 group-hover:scale-110 transition-transform" />
            </a>
            {instagramUrl && (
              <button onClick={() => window.open(instagramUrl, '_blank')} className="w-14 h-14 bg-white/95 rounded-3xl flex items-center justify-center shadow-2xl transition-all active:scale-90 border border-white/20 group hover:bg-white overflow-hidden">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7 transition-transform group-hover:scale-110" style={{ fill: 'url(#ig-gradient-profile)' }}>
                  <defs>
                    <linearGradient id="ig-gradient-profile" x1="0%" y1="100%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#f09433" />
                      <stop offset="25%" stopColor="#e6683c" />
                      <stop offset="50%" stopColor="#dc2743" />
                      <stop offset="75%" stopColor="#cc2366" />
                      <stop offset="100%" stopColor="#bc1888" />
                    </linearGradient>
                  </defs>
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm3.98-10.98a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                </svg>
              </button>
            )}
            {facebookUrl && (
              <button onClick={() => window.open(facebookUrl, '_blank')} className="w-14 h-14 bg-white/95 rounded-3xl flex items-center justify-center shadow-2xl transition-all active:scale-90 border border-white/20 group hover:bg-white">
                <span className="text-[12px] font-black text-slate-900 group-hover:scale-110 transition-transform">FB</span>
              </button>
            )}
          </div>
        )}

        {/* View Shop Button */}
        {!isEditing && isOwnProfile && userRole?.type === 'shop_owner' && userRole?.shopId && (
          <div className="px-6 mt-10">
            <button onClick={() => onShopSelect(userRole.shopId!)} className="w-full h-16 bg-gradient-to-r from-red-600 to-red-500 rounded-3xl font-black tracking-[0.3em] shadow-[0_20px_40px_rgba(220,38,38,0.4)] flex items-center justify-center gap-4 text-white transition-all active:scale-95 border border-red-400/20 uppercase text-sm italic">
              <Store className="h-6 w-6" />
              Your Shop
            </button>
          </div>
        )}

        {/* Edit Form Actions */}
        {isEditing && (
          <div className="px-6 mt-10 space-y-4">
            <div className="space-y-3">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Full Name" className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 h-14 text-white font-bold outline-none" />
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone Number" className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 h-14 text-white font-bold outline-none" />
              
              <div className="flex justify-between items-center pt-2">
                 <Label className="text-white font-bold text-xs uppercase tracking-widest">Location Details</Label>
                 <button onClick={handleAutoFillAddress} className="text-[9px] bg-red-500/20 text-red-500 hover:bg-red-500/30 px-3 py-1 rounded-full font-black uppercase tracking-widest flex items-center gap-1 transition-all border border-red-500/20">
                   <MapPin className="h-3 w-3" /> Auto Fill
                 </button>
              </div>

              <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Address" className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 h-14 text-white font-bold outline-none" />
              
              <div className="grid grid-cols-2 gap-3">
                <input value={village} onChange={e => setVillage(e.target.value)} placeholder="Village/Street" className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 h-14 text-white font-bold outline-none" />
                <input value={district} onChange={e => setDistrict(e.target.value)} placeholder="District" className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 h-14 text-white font-bold outline-none" />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <input value={state} onChange={e => setState(e.target.value)} placeholder="State" className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 h-14 text-white font-bold outline-none" />
                <input value={country} onChange={e => setCountry(e.target.value)} placeholder="Country" className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 h-14 text-white font-bold outline-none" />
              </div>

              <Label className="text-white font-bold text-xs uppercase tracking-widest block pt-2">Social Profiles</Label>
              <div className="grid grid-cols-2 gap-3">
                <input value={instagramId} onChange={e => setInstagramId(e.target.value)} placeholder="Instagram ID (@username)" className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 h-14 text-white font-bold outline-none" />
                <input value={facebookId} onChange={e => setFacebookId(e.target.value)} placeholder="Facebook ID" className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 h-14 text-white font-bold outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input value={instagramUrl} onChange={e => setInstagramUrl(e.target.value)} placeholder="Instagram URL" className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 h-14 text-white font-bold outline-none" />
                <input value={facebookUrl} onChange={e => setFacebookUrl(e.target.value)} placeholder="Facebook URL" className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 h-14 text-white font-bold outline-none" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleSave} className="flex-1 bg-white text-black rounded-2xl font-black h-16 shadow-2xl transition-all active:scale-95 text-xs tracking-widest uppercase">Save</button>
              <button onClick={() => setIsEditing(false)} className="px-8 bg-white/10 text-white rounded-2xl font-black h-16 border border-white/10 hover:bg-white/20 transition-all uppercase text-xs">X</button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-2xl border-b border-slate-100 shadow-sm flex overflow-x-auto no-scrollbar h-16 items-center px-4">
        {tabOrder.map(tab => (
          <button key={tab} onClick={() => handleTabChange(tab)} className={`relative px-6 h-full flex items-center justify-center transition-all ${activeTab === tab ? 'text-red-500 scale-105' : 'text-slate-400'}`}>
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">{tab}</span>
            {activeTab === tab && (
              <motion.div layoutId="activeTabIndicator" className="absolute bottom-0 left-4 right-4 h-1.5 bg-red-500 rounded-t-full shadow-[0_-5px_15px_rgba(239,68,68,0.4)]" />
            )}
          </button>
        ))}
      </div>

      {/* Normal View Placeholder */}
      <div className="flex-1 flex flex-col items-center justify-center p-10 space-y-4 opacity-30">
        <div className="w-20 h-20 bg-slate-200 rounded-[35px] flex items-center justify-center">
          <Clock className="h-8 w-8 text-slate-400" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Tap a tab to expand</p>
      </div>

      {/* Fullscreen Expandable Content Overlay */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} className="fixed inset-0 z-[100] bg-white flex flex-col">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10 shadow-sm">
              <div className="flex items-center gap-5">
                <button onClick={handleCloseExpanded} className="p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-all border border-slate-100">
                  <ArrowLeft className="h-6 w-6 text-slate-900" />
                </button>
                <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic">{activeTab}</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Live</span>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-5 bg-slate-50">
              <div className="max-w-2xl mx-auto space-y-6 pb-20">
                {activeTab === 'today' && (
                  <div className="grid gap-4">
                    {todayBookings.length === 0 ? <EmptyView icon={<Clock />} text="No activity for today" /> : 
                    todayBookings.map(b => <BookingCard key={b.id} booking={b} isOwnProfile={isOwnProfile} />)}
                  </div>
                )}
                {activeTab === 'history' && (
                  <div className="grid gap-4">
                    {historyBookings.length === 0 ? <EmptyView icon={<Clock />} text="History is empty" /> : 
                    historyBookings.map(b => <BookingCard key={b.id} booking={b} isOwnProfile={isOwnProfile} />)}
                  </div>
                )}
                {activeTab === 'campaigns' && <CampaignAlertsSection userId={userIdToLoad || ''} />}
                {activeTab === 'orders' && <CustomerOrdersPanel customerId={userIdToLoad || ''} />}
                {activeTab === 'posts' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm">
                      <div>
                        <p className="text-sm font-black text-slate-900 uppercase italic">Your Gallery</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{userVideos.length} Posts Available</p>
                      </div>
                      {isOwnProfile && <button onClick={() => navigate('/upload-video?source=profile')} className="bg-slate-900 hover:bg-black text-white rounded-2xl px-6 py-3 font-black text-[10px] uppercase tracking-[0.2em] shadow-xl">Post</button>}
                    </div>
                    {userVideos.length === 0 ? <EmptyView icon={<Upload />} text="No posts yet" /> : (
                      <div className="grid grid-cols-2 gap-4">
                        {userVideos.map(v => (
                          <div key={v.id} className="relative aspect-[9/16] bg-black rounded-[32px] overflow-hidden shadow-2xl group border border-slate-100">
                            <video src={v.videoUrl} className="w-full h-full object-cover" />
                            {isOwnProfile && (
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center backdrop-blur-sm">
                                <button onClick={() => handleDeleteVideo(v.id, v.videoUrl)} className="w-14 h-14 bg-red-500 rounded-3xl text-white shadow-2xl flex items-center justify-center hover:scale-110 transition-transform">
                                  {deletingVideoId === v.id ? <Loader2 className="animate-spin h-6 w-6" /> : <Trash2 className="h-6 w-6" />}
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ImageUploadModal isOpen={showImageUploadModal} onClose={() => setShowImageUploadModal(false)} onImageSelected={handleImageSelected} />
      <ProfileChatModal isOpen={showProfileChatModal} onClose={() => setShowProfileChatModal(false)} />
    </div>
  );
};

const BookingCard = ({ booking, isOwnProfile }: { booking: BookingHistoryItem, isOwnProfile: boolean }) => (
  <div className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-4">
    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center">
      <Clock className="h-6 w-6 text-slate-300" />
    </div>
    <div className="flex-1">
      <p className="font-black text-slate-900 text-sm italic">{booking.shopName}</p>
      <div className="flex gap-3 mt-1">
        <p className="text-[10px] text-slate-500 font-bold uppercase">{booking.timeSlot}</p>
        <p className="text-[10px] text-red-500 font-black uppercase">#{booking.tokenNumber}</p>
      </div>
    </div>
  </div>
);

const EmptyView = ({ icon, text }: { icon: any, text: string }) => (
  <div className="bg-white p-20 rounded-[45px] border border-slate-100 text-center space-y-5 shadow-sm">
    <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
      {icon}
    </div>
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{text}</p>
  </div>
);
