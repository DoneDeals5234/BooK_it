import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAppUpdate } from '@/contexts/AppUpdateContext';
import { Download, ChevronLeft, Loader2, Menu, Lock, LogOut, User, Store, Plus, TrendingUp, Clock, MessageSquare, HelpCircle, Mail, Send, MessageCircle, BookOpen, Smartphone, Percent, X } from 'lucide-react';
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
  const [showHelpDialog, setShowHelpDialog] = useState(false);
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
          console.error('Error fetching user plan:', error);
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
        toast.success('Downloading update... Please follow the installation prompts when finished.');
      } else {
        window.open(sanitizedUrl, '_blank');
      }
    }
  };

  const preloadBarberPortal = () => import('@/components/BarberPortal');
  const preloadStaffPortal = () => import('@/components/StaffPortal');

  const isHighestPlan = currentPlan?.plan_name === 'premium';

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 animate-in slide-in-from-left-full duration-300 w-full fixed inset-0 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/40">
        <h1 className="text-xl sm:text-2xl font-bold">Menu</h1>
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
          <X className="h-6 w-6" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-20">
        {currentUser && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-orange-50 to-pink-50 dark:from-orange-950/30 dark:to-pink-950/30 border border-orange-200 dark:border-orange-900/50 shadow-md">
            <div className="flex-shrink-0 h-12 w-12 rounded-full bg-gradient-to-br from-orange-400 to-pink-400 flex items-center justify-center">
              <User className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-gray-900 dark:text-white">{currentUser.email}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                {roleLoading ? 'Loading...' : aggregatedData?.isShopOwner ? 'Shop Owner' : 'Customer'}
              </p>
            </div>
          </div>
        )}

        {/* Barber Portal Section for Shop Owners */}
        {!roleLoading && (userRole?.type === 'shop_owner' || aggregatedData?.isShopOwner) && (
          <div className="border-t pt-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 px-2 flex items-center gap-2">
              <Store className="h-4 w-4" />
              Owner Portal
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="justify-start h-10 text-xs font-semibold rounded-lg hover:bg-amber-500 hover:text-white transition-colors border-amber-500/30 px-2"
                onMouseEnter={preloadBarberPortal}
                onClick={() => navigate('/portal?tab=dashboard')}
              >
                Dashboard
              </Button>
              <Button
                variant="outline"
                className="justify-start h-10 text-xs font-semibold rounded-lg hover:bg-amber-500 hover:text-white transition-colors border-amber-500/30 px-2"
                onClick={() => navigate('/portal?tab=bookings')}
              >
                Requests
              </Button>
              <Button
                variant="outline"
                className="justify-start h-10 text-xs font-semibold rounded-lg hover:bg-amber-500 hover:text-white transition-colors border-amber-500/30 px-2"
                onClick={() => navigate('/portal?tab=settings')}
              >
                Settings
              </Button>
              <Button
                variant="outline"
                className="justify-start h-10 text-xs font-semibold rounded-lg hover:bg-amber-500 hover:text-white transition-colors border-amber-500/30 px-2"
                onMouseEnter={preloadBarberPortal}
                onClick={() => navigate('/portal?tab=campaigns')}
              >
                Campaigns
              </Button>
              <Button
                variant="outline"
                className="justify-start h-10 text-xs font-semibold rounded-lg hover:bg-amber-500 hover:text-white transition-colors border-amber-500/30 px-2"
                onClick={() => navigate('/portal?tab=customization')}
              >
                Design
              </Button>
              <Button
                variant="outline"
                className="justify-start h-10 text-xs font-semibold rounded-lg hover:bg-amber-500 hover:text-white transition-colors border-amber-500/30 px-2"
                onClick={() => navigate('/portal?tab=uploads')}
              >
                Uploads
              </Button>
              <Button
                variant="outline"
                className="justify-start h-10 text-xs font-semibold rounded-lg hover:bg-amber-500 hover:text-white transition-colors border-amber-500/30 px-2"
                onClick={() => navigate('/portal?tab=preview')}
              >
                Preview
              </Button>
              <Button
                variant="outline"
                className="justify-start h-10 text-xs font-semibold rounded-lg hover:bg-amber-500 hover:text-white transition-colors border-amber-500/30 px-2"
                onClick={() => navigate('/portal?tab=website')}
              >
                Website
              </Button>
              <Button
                variant="outline"
                className="justify-start h-10 text-xs font-semibold rounded-lg hover:bg-amber-500 hover:text-white transition-colors border-amber-500/30 px-2"
                onClick={() => navigate('/portal?tab=khata-book')}
              >
                <BookOpen className="mr-1 h-4 w-4" />
                Khata
              </Button>
            </div>
            <Button
              className="w-full justify-start h-10 bg-amber-500 hover:bg-amber-600 text-white font-semibold shadow-md rounded-lg mt-2 text-xs"
              onMouseEnter={preloadBarberPortal}
              onClick={() => navigate('/portal')}
            >
              <Store className="mr-2 h-4 w-4" />
              Owner's Portal
            </Button>
          </div>
        )}

        {!roleLoading && currentUser && (
          userRole?.type !== 'shop_owner' ? (
            <Button
              className="w-full justify-start h-12 bg-gradient-to-br from-green-400 to-green-500 hover:from-green-500 hover:to-green-600 text-white font-semibold shadow-lg rounded-xl text-base"
              onClick={() => navigate('/create-shop')}
            >
              <Plus className="mr-3 h-5 w-5" />
              Create Shop
            </Button>
          ) : (
            <Button
              className="w-full justify-start h-12 bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow-lg rounded-xl disabled:opacity-50 text-base"
              onClick={() => navigate('/create-shop')}
              disabled={planLoading || isHighestPlan}
            >
              <TrendingUp className="mr-3 h-5 w-5" />
              {planLoading ? 'Loading...' : isHighestPlan ? 'Highest Plan' : 'Upgrade Plan'}
            </Button>
          )
        )}

        {/* Profile Owner Tabs */}
        {currentUser && aggregatedData?.isShopOwner && (
          <div className="border-t pt-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 px-2">Profile Management</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="justify-start h-10 text-xs font-semibold rounded-lg hover:bg-red-500 hover:text-white transition-colors border-red-500/30 px-2"
                onClick={() => navigate('/profile?tab=today')}
              >
                <Clock className="mr-2 h-4 w-4" />
                Today
              </Button>
              <Button
                variant="outline"
                className="justify-start h-10 text-xs font-semibold rounded-lg hover:bg-red-500 hover:text-white transition-colors border-red-500/30 px-2"
                onClick={() => navigate('/profile?tab=history')}
              >
                <TrendingUp className="mr-2 h-4 w-4" />
                History
              </Button>
              <Button
                variant="outline"
                className="justify-start h-10 text-xs font-semibold rounded-lg hover:bg-red-500 hover:text-white transition-colors border-red-500/30 px-2"
                onClick={() => navigate('/profile?tab=campaigns')}
              >
                <Plus className="mr-2 h-4 w-4" />
                Campaigns
              </Button>
              <Button
                variant="outline"
                className="justify-start h-10 text-xs font-semibold rounded-lg hover:bg-red-500 hover:text-white transition-colors border-red-500/30 px-2"
                onClick={() => navigate('/profile?tab=posts')}
              >
                <User className="mr-2 h-4 w-4" />
                Posts
              </Button>
            </div>
          </div>
        )}

        {currentUser && (
          <div className="border-t pt-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2 mb-2">My Messages</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                className="justify-start h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md rounded-xl text-sm px-2"
                onClick={() => navigate('/profile?tab=inbox')}
              >
                <MessageCircle className="mr-2 h-5 w-5" />
                Chat Inbox
              </Button>

              <Button
                className="justify-start h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-md rounded-xl text-sm px-2"
                onClick={() => setShowThoughtInbox(true)}
              >
                <MessageSquare className="mr-2 h-5 w-5" />
                My Thoughts
              </Button>

              <Button
                className="justify-start h-12 bg-red-600 hover:bg-red-700 text-white font-semibold shadow-md rounded-xl text-sm px-2 col-span-2 mt-2"
                onClick={() => navigate('/offers-list')}
              >
                <Percent className="mr-2 h-5 w-5" />
                Exclusive Offers
              </Button>
            </div>
          </div>
        )}

        {categories.length > 0 && (
          <div className="border-t pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 px-2">Shop Categories</p>
            <div className="grid grid-cols-2 gap-2">
              {categories.map((category) => (
                <Button
                  key={category.id}
                  variant="outline"
                  className="justify-start h-10 text-xs font-semibold rounded-lg hover:bg-primary hover:text-white transition-colors border-primary/30 px-2"
                  onClick={() => navigate(`/category/${category.id}`)}
                >
                  <span className="mr-1">{category.icon}</span>
                  {category.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Support Section */}
        {currentUser && (
          <div className="border-t pt-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2">Support</p>
            <Button
              className="w-full justify-start h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-lg rounded-xl text-base"
              onClick={() => setShowSendThought(true)}
            >
              <Send className="mr-3 h-5 w-5" />
              Send Thought
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <a
                href="https://wa.me/917508990616?text=Hi%2C%20I%20need%20help%20with%20the%20app"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center h-12 rounded-xl bg-green-500 text-white font-semibold shadow-md text-sm px-2"
              >
                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.67-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421-7.403h-.006c-1.405 0-2.734-.474-3.803-1.37-.968-.81-1.566-1.966-1.566-3.164C6.676 3.075 8.751 1 11.277 1c1.38 0 2.677.474 3.754 1.367 1.077.893 1.741 2.12 1.741 3.45 0 2.526-2.075 4.565-4.495 4.565z" />
                </svg>
                WhatsApp
              </a>
              <a
                href="mailto:pv173597@gmail.com"
                className="flex items-center justify-center h-12 rounded-xl bg-blue-500 text-white font-semibold shadow-md text-sm px-2"
              >
                <Mail className="h-5 w-5 mr-2" />
                Email
              </a>
            </div>

            <Button
              className="w-full justify-start h-12 bg-teal-500 hover:bg-teal-600 text-white font-semibold shadow-lg rounded-xl text-base"
              onClick={() => setShowHelpDialog(true)}
            >
              <HelpCircle className="mr-3 h-5 w-5" />
              Full Help Guide
            </Button>
          </div>
        )}

        <div className="border-t pt-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2 mb-2">Policies</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="justify-start h-10 text-xs font-semibold rounded-lg px-2" onClick={() => navigate('/contact-us')}>Contact Us</Button>
            <Button variant="outline" className="justify-start h-10 text-xs font-semibold rounded-lg px-2" onClick={() => navigate('/terms-conditions')}>Terms</Button>
            <Button variant="outline" className="justify-start h-10 text-xs font-semibold rounded-lg px-2 col-span-2" onClick={() => navigate('/refund-policy')}>Refund Policy</Button>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-red-500 mt-2"
          onClick={() => navigate('/staff-portal')}
          title="Staff Portal"
        >
          <BookOpen className="h-5 w-5" />
        </Button>

        {currentUser && (
          <Button
            className="w-full justify-start h-12 bg-slate-500 hover:bg-slate-600 text-white font-semibold shadow-lg rounded-xl text-base mb-4 mt-4"
            onClick={handleSignOut}
          >
            <LogOut className="mr-3 h-5 w-5" />
            Sign Out
          </Button>
        )}

        <div className="mt-8 border-t pt-4 pb-8 px-2">
          <div className="flex items-center justify-between mb-3 bg-muted/30 p-3 rounded-xl border border-border/50">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Installed</p>
                <p className="text-xs font-black text-foreground">v{localVersion}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-1">
                {hasUpdate && <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />}
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                  {hasUpdate ? 'New Available' : 'Latest Version'}
                </p>
              </div>
              <p className={`text-xs font-black ${hasUpdate ? 'text-amber-600' : 'text-foreground'}`}>
                v{updateData?.latest_version || localVersion}
              </p>
            </div>
          </div>
          {hasUpdate ? (
            <Button onClick={handleUpdate} className="w-full bg-blue-600 text-white font-black rounded-xl h-12">
              <Download className="mr-2 h-4 w-4" /> UPDATE APP NOW
            </Button>
          ) : (
            <div className="flex justify-center py-2 text-xs font-bold text-slate-500 uppercase tracking-wide">
              System Up to Date
            </div>
          )}
        </div>
      </div>

      <Dialog open={showHelpDialog} onOpenChange={setShowHelpDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Help & Support</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">Contact WhatsApp: +91 7508990616</p>
            <Button variant="outline" onClick={() => setShowHelpDialog(false)} className="w-full">Close</Button>
          </div>
        </DialogContent>
      </Dialog>
      <SendThoughtModal isOpen={showSendThought} onClose={() => setShowSendThought(false)} />
      <ThoughtInboxModal isOpen={showThoughtInbox} onClose={() => setShowThoughtInbox(false)} />
    </div>
  );
}
