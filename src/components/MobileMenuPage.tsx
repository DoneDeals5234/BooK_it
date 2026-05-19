import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppUpdate } from '@/contexts/AppUpdateContext';
import { Download, User, Store, Plus, TrendingUp, Clock, MessageSquare, HelpCircle, Mail, Send, MessageCircle, BookOpen, Smartphone, Percent, X, LogOut, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { getAllCategories } from '@/lib/supabase-categories';
import { SendThoughtModal } from '@/components/SendThoughtModal';
import { ThoughtInboxModal } from '@/components/ThoughtInboxModal';
import { getLatestPlanForEmail } from '@/lib/supabase-shop-owner-plans';
import toast from 'react-hot-toast';
import { sanitizeSupabaseUrl } from '@/lib/utils';
import type { Category } from '@/types/index';
import type { ShopOwnerPlan } from '@/lib/supabase-shop-owner-plans';

export function MobileMenuPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [showSendThought, setShowSendThought] = useState(false);
  const [showThoughtInbox, setShowThoughtInbox] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<ShopOwnerPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const { user: currentUser, signOut, userRole, roleLoading, aggregatedData } = useAuth();
  const { profile } = useUserProfile();
  const { hasUpdate, updateData, localVersion } = useAppUpdate();

  useEffect(() => {
    const fetchUserPlan = async () => {
      if (currentUser?.email) {
        setPlanLoading(true);
        try {
          const plan = await getLatestPlanForEmail(currentUser.email);
          setCurrentPlan(plan);
        } catch (error) {
          setCurrentPlan(null);
        } finally {
          setPlanLoading(false);
        }
      } else {
        setCurrentPlan(null);
      }
    };
    fetchUserPlan();
  }, [currentUser?.email]);

  useEffect(() => {
    if (aggregatedData?.activePlan) {
      setCurrentPlan(aggregatedData.activePlan);
    }
  }, [aggregatedData?.activePlan]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const categoriesData = await getAllCategories();
        setCategories(categoriesData);
      } catch (error) {
        console.error('Error loading categories:', error);
      }
    };
    loadCategories();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
      toast.success('Signed out successfully');
    } catch (error) {
      toast.error('Failed to sign out');
    }
  };

  const handleUpdate = () => {
    if (updateData?.apk_url) {
      const sanitizedUrl = sanitizeSupabaseUrl(updateData.apk_url);
      const alarmBridge = (window as any).AlarmBridge;
      if (alarmBridge && typeof alarmBridge.downloadAndInstallApk === 'function') {
        alarmBridge.downloadAndInstallApk(sanitizedUrl);
        toast.success('Downloading update...');
      } else {
        window.open(sanitizedUrl, '_blank');
      }
    }
  };

  const preloadBarberPortal = () => import('@/components/BarberPortal');
  const isHighestPlan = currentPlan?.plan_name === 'premium';

  // Helper for rendering menu items consistently
  const MenuItem = ({ icon: Icon, label, onClick, highlight = false, badge = null }: any) => (
    <button 
      onClick={onClick}
      className={`w-full flex items-center justify-between p-4 mb-2 rounded-2xl transition-colors ${highlight ? 'bg-red-50 text-red-600 dark:bg-red-950/30' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200'}`}
    >
      <div className="flex items-center gap-3">
        <Icon className={`h-5 w-5 ${highlight ? 'text-red-600' : 'text-slate-500'}`} />
        <span className="font-semibold text-sm">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {badge}
        <ChevronRight className={`h-4 w-4 ${highlight ? 'text-red-300' : 'text-slate-300'}`} />
      </div>
    </button>
  );

  return (
    <div className="w-full bg-white dark:bg-slate-950 min-h-screen pb-20">
      
      {/* HEADER - No sticky, no shadow */}
      <div className="flex items-center justify-between p-5 bg-white dark:bg-slate-950">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Menu</h1>
        <button 
          onClick={() => navigate(-1)} 
          className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-600 dark:text-slate-300 active:bg-slate-200"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      <div className="px-5 space-y-6">
        
        {/* PROFILE SECTION */}
        {currentUser && (
          <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-3xl flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0">
              <User className="h-6 w-6 text-slate-500" />
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="font-bold text-slate-900 dark:text-white truncate">{currentUser.email}</p>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                {roleLoading ? 'Loading...' : aggregatedData?.isShopOwner ? 'Shop Owner' : 'Customer'}
              </p>
            </div>
          </div>
        )}

        {/* PRIMARY ACTION */}
        {!roleLoading && currentUser && (
          userRole?.type !== 'shop_owner' ? (
            <button 
              onClick={() => navigate('/create-shop')}
              className="w-full bg-red-500 text-white p-4 rounded-2xl flex items-center justify-center gap-2 font-bold active:bg-red-600"
            >
              <Plus className="h-5 w-5" />
              Create Your Shop
            </button>
          ) : (
            <button 
              onClick={() => navigate('/create-shop')}
              disabled={planLoading || isHighestPlan}
              className={`w-full p-4 rounded-2xl flex items-center justify-center gap-2 font-bold ${isHighestPlan ? 'bg-slate-100 text-slate-400' : 'bg-red-500 text-white active:bg-red-600'}`}
            >
              <TrendingUp className="h-5 w-5" />
              {planLoading ? 'Loading...' : isHighestPlan ? 'Highest Plan Active' : 'Upgrade Plan'}
            </button>
          )
        )}

        {/* OWNER PORTAL */}
        {!roleLoading && (userRole?.type === 'shop_owner' || aggregatedData?.isShopOwner) && (
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">Owner Portal</p>
            <MenuItem icon={Store} label="Dashboard" onClick={() => { preloadBarberPortal(); navigate('/portal?tab=dashboard'); }} />
            <MenuItem icon={Clock} label="Requests" onClick={() => navigate('/portal?tab=bookings')} />
            <MenuItem icon={Plus} label="Campaigns" onClick={() => navigate('/portal?tab=campaigns')} />
            <MenuItem icon={BookOpen} label="Khata Book" onClick={() => navigate('/portal?tab=khata-book')} />
            
            <button 
              onMouseEnter={preloadBarberPortal}
              onClick={() => navigate('/portal')}
              className="w-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 p-4 rounded-2xl flex items-center justify-center gap-2 font-bold mt-2 active:bg-slate-800"
            >
              Open Full Portal
            </button>
          </div>
        )}

        {/* PROFILE MANAGEMENT */}
        {currentUser && aggregatedData?.isShopOwner && (
           <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">Profile</p>
            <MenuItem icon={Clock} label="Today" onClick={() => navigate('/profile?tab=today')} />
            <MenuItem icon={TrendingUp} label="History" onClick={() => navigate('/profile?tab=history')} />
            <MenuItem icon={User} label="Posts" onClick={() => navigate('/profile?tab=posts')} />
           </div>
        )}

        {/* MESSAGES & OFFERS */}
        {currentUser && (
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">Social & Offers</p>
            <MenuItem icon={MessageCircle} label="Chat Inbox" onClick={() => navigate('/profile?tab=inbox')} />
            <MenuItem icon={MessageSquare} label="My Thoughts" onClick={() => setShowThoughtInbox(true)} />
            <MenuItem icon={Percent} label="Exclusive Offers" highlight onClick={() => navigate('/offers-list')} />
          </div>
        )}

        {/* SHOP CATEGORIES */}
        {categories.length > 0 && (
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">Categories</p>
            <div className="grid grid-cols-2 gap-3">
              {categories.map((category) => (
                <button 
                  key={category.id} 
                  onClick={() => navigate(`/category/${category.id}`)}
                  className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl flex flex-col items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200 active:bg-slate-100"
                >
                  <span className="text-2xl">{category.icon}</span>
                  <span className="truncate w-full text-center text-xs">{category.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* SUPPORT */}
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">Support & Legal</p>
          <MenuItem icon={Send} label="Send Thought" onClick={() => setShowSendThought(true)} />
          <MenuItem icon={MessageCircle} label="WhatsApp Support" onClick={() => window.open('https://wa.me/917508990616?text=Hi%2C%20I%20need%20help', '_blank')} />
          <MenuItem icon={Mail} label="Email Us" onClick={() => window.open('mailto:pv173597@gmail.com')} />
          <MenuItem icon={HelpCircle} label="Terms & Conditions" onClick={() => navigate('/terms-conditions')} />
          <MenuItem icon={HelpCircle} label="Refund Policy" onClick={() => navigate('/refund-policy')} />
          <MenuItem icon={BookOpen} label="Staff Portal" onClick={() => navigate('/staff-portal')} />
        </div>

        {/* APP VERSION */}
        <div className="bg-slate-50 dark:bg-slate-900 p-5 rounded-3xl mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-slate-500">
              <Smartphone className="h-5 w-5" />
              <span className="text-xs font-bold uppercase tracking-widest">Version</span>
            </div>
            <span className="font-black text-slate-900 dark:text-white">v{localVersion}</span>
          </div>
          
          {hasUpdate ? (
            <button 
              onClick={handleUpdate}
              className="w-full bg-green-500 text-white p-4 rounded-2xl flex items-center justify-center gap-2 font-bold active:bg-green-600"
            >
              <Download className="h-5 w-5" />
              Update to v{updateData?.latest_version}
            </button>
          ) : (
            <div className="text-center p-3 bg-slate-200/50 dark:bg-slate-800 rounded-2xl text-xs font-bold text-slate-500 uppercase tracking-widest">
              Up to date
            </div>
          )}
        </div>

        {/* SIGN OUT */}
        {currentUser && (
          <button 
            onClick={handleSignOut}
            className="w-full p-4 bg-red-50 dark:bg-red-950/30 text-red-600 rounded-2xl flex items-center justify-center gap-2 font-bold mb-10 active:bg-red-100"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </button>
        )}

      </div>

      <SendThoughtModal isOpen={showSendThought} onClose={() => setShowSendThought(false)} />
      <ThoughtInboxModal isOpen={showThoughtInbox} onClose={() => setShowThoughtInbox(false)} />
    </div>
  );
}
