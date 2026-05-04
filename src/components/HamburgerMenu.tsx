import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppUpdate } from '@/contexts/AppUpdateContext';
import { Download, ChevronLeft, Loader2, Menu, Lock, LogOut, User, Store, Plus, TrendingUp, Clock, MessageSquare, HelpCircle, Mail, Send, MessageCircle, BookOpen, Smartphone, Percent, Tag } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { getAllCategories } from '@/lib/supabase-categories';
import { CreateShopModal } from '@/components/CreateShopModal';
import { SendThoughtModal } from '@/components/SendThoughtModal';
import { ThoughtInboxModal } from '@/components/ThoughtInboxModal';
import { getLatestPlanForEmail } from '@/lib/supabase-shop-owner-plans';
import toast from 'react-hot-toast';
import { sanitizeSupabaseUrl } from '@/lib/utils';
import type { Category } from '@/types/index';
import type { ShopOwnerPlan } from '@/lib/supabase-shop-owner-plans';

import { useNavigate } from 'react-router-dom';

interface HamburgerMenuProps {
  onStaffAccess: () => void;
  onShowLogin?: () => void;
}

export const HamburgerMenu = ({ onStaffAccess, onShowLogin }: HamburgerMenuProps) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showSendThought, setShowSendThought] = useState(false);
  const [showThoughtInbox, setShowThoughtInbox] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<ShopOwnerPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const { user: currentUser, signOut, userRole, roleLoading, aggregatedData } = useAuth();
  const { profile } = useUserProfile();
  const { hasUpdate, updateData, localVersion } = useAppUpdate();

  // Fetch user's current plan when user changes
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

  // Update plan from aggregated data if available
  useEffect(() => {
    if (aggregatedData?.activePlan) {
      console.log('📊 Updating plan from aggregated data in HamburgerMenu:', aggregatedData.activePlan);
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

  const handleStaffClick = () => {
    setOpen(false);
    onStaffAccess();
  };

  const preloadStaffPortal = () => {
    import('@/components/StaffPortal');
  };

  const preloadBarberPortal = () => {
    import('@/components/BarberPortal');
  };

  const preloadProfilePage = () => {
    import('@/components/ProfilePage');
  };

  const preloadShortVideos = () => {
    import('@/components/ShortVideosPage');
  };


  const handleSignOut = async () => {
    try {
      await signOut();
      setOpen(false);
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

  const firstLetter = currentUser?.email?.[0]?.toUpperCase() || '?';
  const isHighestPlan = currentPlan?.plan_name === 'premium';

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border/40 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 sm:gap-3 flex-1">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="bg-gradient-to-b from-background via-background to-muted/20 w-[85vw] sm:w-80">
                <SheetHeader className="mb-2">
                  <SheetTitle className="text-lg sm:text-2xl">Menu</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-2 sm:gap-4 mt-6 sm:mt-8 space-y-2 sm:space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
            {currentUser && (
              <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-4 rounded-xl bg-gradient-to-br from-orange-50 to-pink-50 dark:from-orange-950/30 dark:to-pink-950/30 border border-orange-200 dark:border-orange-900/50 shadow-md">
                <div className="flex-shrink-0 h-10 sm:h-12 w-10 sm:w-12 rounded-full bg-gradient-to-br from-orange-400 to-pink-400 flex items-center justify-center">
                  <User className="h-5 sm:h-6 w-5 sm:w-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-semibold truncate text-gray-900 dark:text-white">{currentUser.email}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                    {roleLoading ? 'Loading...' : aggregatedData?.isShopOwner ? 'Shop Owner' : 'Customer'}
                  </p>
                </div>
              </div>
            )}

            {/* Barber Portal Section for Shop Owners */}
            {!roleLoading && (userRole?.type === 'shop_owner' || aggregatedData?.isShopOwner) && (
              <div className="border-t pt-2 sm:pt-4 space-y-2">
                <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 sm:mb-3 px-2 flex items-center gap-2">
                  <Store className="h-3 sm:h-4 w-3 sm:w-4" />
                  Owner Portal
                </p>
                <div className="grid grid-cols-2 gap-1 sm:gap-2">
                  <Button
                    variant="outline"
                    className="justify-center sm:justify-start h-8 sm:h-10 text-[10px] sm:text-xs font-semibold rounded-lg hover:bg-amber-500 hover:text-white transition-colors border-amber-500/30 px-1 sm:px-2"
                    onMouseEnter={preloadBarberPortal}
                    onClick={() => {
                      setOpen(false);
                      navigate('/portal?tab=dashboard');
                    }}
                  >
                    Dashboard
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-center sm:justify-start h-8 sm:h-10 text-[10px] sm:text-xs font-semibold rounded-lg hover:bg-amber-500 hover:text-white transition-colors border-amber-500/30 px-1 sm:px-2"
                    onClick={() => {
                      setOpen(false);
                      navigate('/portal?tab=bookings');
                    }}
                  >
                    Requests
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-center sm:justify-start h-8 sm:h-10 text-[10px] sm:text-xs font-semibold rounded-lg hover:bg-amber-500 hover:text-white transition-colors border-amber-500/30 px-1 sm:px-2"
                    onClick={() => {
                      setOpen(false);
                      navigate('/portal?tab=settings');
                    }}
                  >
                    Settings
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-center sm:justify-start h-8 sm:h-10 text-[10px] sm:text-xs font-semibold rounded-lg hover:bg-amber-500 hover:text-white transition-colors border-amber-500/30 px-1 sm:px-2"
                    onMouseEnter={preloadBarberPortal}
                    onClick={() => {
                      setOpen(false);
                      navigate('/portal?tab=campaigns');
                    }}
                  >
                    Campaigns
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-center sm:justify-start h-8 sm:h-10 text-[10px] sm:text-xs font-semibold rounded-lg hover:bg-amber-500 hover:text-white transition-colors border-amber-500/30 px-1 sm:px-2"
                    onClick={() => {
                      setOpen(false);
                      navigate('/portal?tab=customization');
                    }}
                  >
                    Design
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-center sm:justify-start h-8 sm:h-10 text-[10px] sm:text-xs font-semibold rounded-lg hover:bg-amber-500 hover:text-white transition-colors border-amber-500/30 px-1 sm:px-2"
                    onClick={() => {
                      setOpen(false);
                      navigate('/portal?tab=uploads');
                    }}
                  >
                    Uploads
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-center sm:justify-start h-8 sm:h-10 text-[10px] sm:text-xs font-semibold rounded-lg hover:bg-amber-500 hover:text-white transition-colors border-amber-500/30 px-1 sm:px-2"
                    onClick={() => {
                      setOpen(false);
                      navigate('/portal?tab=preview');
                    }}
                  >
                    Preview
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-center sm:justify-start h-8 sm:h-10 text-[10px] sm:text-xs font-semibold rounded-lg hover:bg-amber-500 hover:text-white transition-colors border-amber-500/30 px-1 sm:px-2"
                    onClick={() => {
                      setOpen(false);
                      navigate('/portal?tab=website');
                    }}
                  >
                    Website
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-center sm:justify-start h-8 sm:h-10 text-[10px] sm:text-xs font-semibold rounded-lg hover:bg-amber-500 hover:text-white transition-colors border-amber-500/30 px-1 sm:px-2"
                    onClick={() => {
                      setOpen(false);
                      navigate('/portal?tab=khata-book');
                    }}
                  >
                    <BookOpen className="mr-1 h-3 sm:h-4 w-3 sm:w-4" />
                    Khata
                  </Button>
                </div>
                <Button
                  className="w-full justify-center sm:justify-start h-8 sm:h-10 bg-gradient-to-br from-amber-400 to-amber-500 text-white font-semibold shadow-md rounded-lg mt-1 sm:mt-2 text-[10px] sm:text-xs"
                  onMouseEnter={preloadBarberPortal}
                  onClick={() => {
                    setOpen(false);
                    navigate('/portal');
                  }}
                >
                  <Store className="mr-1 sm:mr-2 h-3 sm:h-4 w-3 sm:w-4" />
                  Owner's Portal
                </Button>
              </div>
            )}

            {!roleLoading && currentUser && (
              userRole?.type !== 'shop_owner' ? (
                <Button
                  className="w-full justify-center sm:justify-start h-9 sm:h-12 bg-gradient-to-br from-green-400 to-green-500 hover:from-green-500 hover:to-green-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5 border-0 rounded-xl text-xs sm:text-base"
                  onClick={() => {
                    setOpen(false);
                    navigate('/create-shop');
                  }}
                >
                  <Plus className="mr-1 sm:mr-3 h-4 sm:h-5 w-4 sm:w-5" />
                  Create Shop
                </Button>
              ) : (
                <Button
                  className="w-full justify-center sm:justify-start h-9 sm:h-12 bg-gradient-to-br from-purple-400 to-purple-500 hover:from-purple-500 hover:to-purple-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5 border-0 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-base"
                  onClick={() => {
                    setOpen(false);
                    navigate('/create-shop');
                  }}
                  disabled={planLoading || isHighestPlan}
                >
                  <TrendingUp className="mr-1 sm:mr-3 h-4 sm:h-5 w-4 sm:w-5" />
                  {planLoading ? 'Loading...' : isHighestPlan ? 'Highest Plan' : 'Upgrade Plan'}
                </Button>
              )
            )}

            {/* Profile Owner Tabs */}
            {currentUser && aggregatedData?.isShopOwner && (
              <div className="border-t pt-2 sm:pt-4 space-y-2">
                <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 sm:mb-3 px-2">Profile Management</p>
                <div className="grid grid-cols-2 gap-1 sm:gap-2">
                  <Button
                    variant="outline"
                    className="justify-center sm:justify-start h-8 sm:h-10 text-[10px] sm:text-xs font-semibold rounded-lg hover:bg-red-500 hover:text-white transition-colors border-red-500/30 px-1 sm:px-2"
                    onClick={() => {
                      setOpen(false);
                      navigate('/profile?tab=today');
                    }}
                  >
                    <Clock className="mr-1 sm:mr-2 h-3 sm:h-4 w-3 sm:w-4" />
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-center sm:justify-start h-8 sm:h-10 text-[10px] sm:text-xs font-semibold rounded-lg hover:bg-red-500 hover:text-white transition-colors border-red-500/30 px-1 sm:px-2"
                    onClick={() => {
                      setOpen(false);
                      navigate('/profile?tab=history');
                    }}
                  >
                    <TrendingUp className="mr-1 sm:mr-2 h-3 sm:h-4 w-3 sm:w-4" />
                    History
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-center sm:justify-start h-8 sm:h-10 text-[10px] sm:text-xs font-semibold rounded-lg hover:bg-red-500 hover:text-white transition-colors border-red-500/30 px-1 sm:px-2"
                    onClick={() => {
                      setOpen(false);
                      navigate('/profile?tab=campaigns');
                    }}
                  >
                    <Plus className="mr-1 sm:mr-2 h-3 sm:h-4 w-3 sm:w-4" />
                    Campaigns
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-center sm:justify-start h-8 sm:h-10 text-[10px] sm:text-xs font-semibold rounded-lg hover:bg-red-500 hover:text-white transition-colors border-red-500/30 px-1 sm:px-2"
                    onClick={() => {
                      setOpen(false);
                      navigate('/profile?tab=posts');
                    }}
                  >
                    <User className="mr-1 sm:mr-2 h-3 sm:h-4 w-3 sm:w-4" />
                    Posts
                  </Button>
                </div>
              </div>
            )}

            {currentUser && (
              <div className="border-t pt-2 sm:pt-4 space-y-2">
                <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2 mb-2">My Messages</p>
                <div className="grid grid-cols-2 gap-1 sm:gap-2">
                  {/* Inbox (Send Message) */}
                  <Button
                    className="justify-center sm:justify-start h-8 sm:h-12 bg-gradient-to-br from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white font-semibold shadow-md hover:shadow-lg transition-all rounded-xl border-0 text-[10px] sm:text-sm px-1 sm:px-2"
                    onClick={() => {
                      setOpen(false);
                      navigate('/profile?tab=inbox');
                    }}
                  >
                    <MessageCircle className="mr-1 sm:mr-2 h-3 sm:h-5 w-3 sm:w-5" />
                    Chat Inbox
                  </Button>

                  {/* Thought Inbox */}
                  <Button
                    className="justify-center sm:justify-start h-8 sm:h-12 bg-gradient-to-br from-indigo-400 to-indigo-500 hover:from-indigo-500 hover:to-indigo-600 text-white font-semibold shadow-md hover:shadow-lg transition-all rounded-xl border-0 text-[10px] sm:text-sm px-1 sm:px-2"
                    onClick={() => {
                      setOpen(false);
                      setShowThoughtInbox(true);
                    }}
                  >
                    <MessageSquare className="mr-1 sm:mr-2 h-3 sm:h-5 w-3 sm:w-5" />
                    My Thoughts
                  </Button>

                  {/* Offers Button */}
                  <Button
                    className="justify-center sm:justify-start h-8 sm:h-12 bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold shadow-md hover:shadow-lg transition-all rounded-xl border-0 text-[10px] sm:text-sm px-1 sm:px-2 col-span-2 mt-2"
                    onClick={() => {
                      setOpen(false);
                      // In HomePage, we'll handle navigation to the offers tab
                      // For now, let's navigate to /portal?tab=offers if they are an owner,
                      // or just a dedicated route if we have one.
                      // The user said "menu me ik button bnao offers"
                      navigate('/offers-list');
                    }}
                  >
                    <Percent className="mr-2 h-3 sm:h-5 w-3 sm:w-5" />
                    Exclusive Offers
                  </Button>
                </div>
              </div>
            )}
            {categories.length > 0 && (
              <div className="border-t pt-2 sm:pt-4">
                <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 sm:mb-3 px-2">Shop Categories</p>
                <div className="grid grid-cols-2 gap-1 sm:gap-2">
                  {categories.map((category) => (
                    <Button
                      key={category.id}
                      variant="outline"
                      className="justify-center h-8 sm:h-10 text-[10px] sm:text-xs font-semibold rounded-lg hover:bg-primary hover:text-white transition-colors border-primary/30 px-1 sm:px-2"
                      onClick={() => {
                        setOpen(false);
                        navigate(`/category/${category.id}`);
                      }}
                    >
                      <span className="mr-1">{category.icon}</span>
                      {category.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Help & Support Section */}
            {currentUser && (
              <div className="border-t pt-2 sm:pt-4 space-y-2 sm:space-y-3">
                <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2">Support</p>

                {/* Send Thought Button */}
                <Button
                  className="w-full justify-center sm:justify-start h-8 sm:h-12 bg-gradient-to-br from-indigo-400 to-indigo-500 hover:from-indigo-500 hover:to-indigo-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5 border-0 rounded-xl text-xs sm:text-base"
                  onClick={() => {
                    setOpen(false);
                    setShowSendThought(true);
                  }}
                >
                  <Send className="mr-1 sm:mr-3 h-3 sm:h-5 w-3 sm:w-5" />
                  Send Thought
                </Button>

                {/* Direct Support Buttons */}
                <div className="grid grid-cols-2 gap-1 sm:gap-2">
                  <a
                    href="https://wa.me/917508990616?text=Hi%2C%20I%20need%20help%20with%20the%20app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center h-8 sm:h-12 rounded-xl bg-gradient-to-br from-green-400 to-green-500 text-white font-semibold shadow-md hover:shadow-lg transition-all text-[10px] sm:text-sm px-1 sm:px-2"
                  >
                    <svg className="h-3 sm:h-5 w-3 sm:w-5 mr-1 sm:mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.67-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421-7.403h-.006c-1.405 0-2.734-.474-3.803-1.37-.968-.81-1.566-1.966-1.566-3.164C6.676 3.075 8.751 1 11.277 1c1.38 0 2.677.474 3.754 1.367 1.077.893 1.741 2.12 1.741 3.45 0 2.526-2.075 4.565-4.495 4.565z"/>
                    </svg>
                    <span className="hidden sm:inline">WhatsApp</span>
                  </a>
                  <a
                    href="mailto:pv173597@gmail.com"
                    className="flex items-center justify-center h-8 sm:h-12 rounded-xl bg-gradient-to-br from-blue-400 to-blue-500 text-white font-semibold shadow-md hover:shadow-lg transition-all text-[10px] sm:text-sm px-1 sm:px-2"
                  >
                    <Mail className="h-3 sm:h-5 w-3 sm:w-5 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Email</span>
                  </a>
                </div>

                <Button
                  className="w-full justify-center sm:justify-start h-8 sm:h-12 bg-gradient-to-br from-teal-400 to-teal-500 hover:from-teal-500 hover:to-teal-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5 border-0 rounded-xl text-xs sm:text-base"
                  onClick={() => {
                    setOpen(false);
                    setShowHelpDialog(true);
                  }}
                >
                  <HelpCircle className="mr-1 sm:mr-3 h-3 sm:h-5 w-3 sm:w-5" />
                  <span className="hidden sm:inline">Full Help Guide</span>
                  <span className="sm:hidden">Help</span>
                </Button>
              </div>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-red-500 hover:text-red-600 hover:bg-red-50"
              onMouseEnter={preloadStaffPortal}
              onClick={handleStaffClick}
              title="Staff Portal"
            >
              <BookOpen className="h-5 w-5" />
            </Button>

            {currentUser && (
              <Button
                className="w-full justify-center sm:justify-start h-8 sm:h-12 bg-gradient-to-br from-slate-400 to-slate-500 hover:from-slate-500 hover:to-slate-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5 border-0 rounded-xl text-xs sm:text-base mb-4"
                onClick={handleSignOut}
              >
                <LogOut className="mr-1 sm:mr-3 h-3 sm:h-5 w-3 sm:w-5" />
                Sign Out
              </Button>
            )}

            {/* App Version & Update Info */}
            <div className="mt-auto border-t pt-4 pb-2 px-2">
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
                    {hasUpdate && (
                      <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                    )}
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
                <Button
                  onClick={handleUpdate}
                  className="w-full bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-black rounded-xl h-12 shadow-lg shadow-blue-200"
                >
                  <Download className="mr-2 h-4 w-4 fill-current" />
                  UPDATE APP NOW
                </Button>
              ) : (
                <div className="flex items-center justify-center gap-2 py-2 px-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">System Up to Date</span>
                </div>
              )}
            </div>
                </div>
              </SheetContent>
            </Sheet>
            <h1 className="text-lg sm:text-2xl font-bold text-primary">Book It</h1>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {currentUser ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => navigate('/profile')}
                  className="h-9 w-9 rounded-full flex items-center justify-center text-white font-semibold hover:opacity-80 transition-opacity overflow-hidden border border-border flex-shrink-0"
                  title={currentUser.email}
                >
                  {profile?.imageUrl ? (
                    <img
                      src={profile.imageUrl}
                      alt="Profile"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className={`h-full w-full flex items-center justify-center text-xs ${getBackgroundColor(firstLetter)}`}>
                      {firstLetter}
                    </div>
                  )}
                </button>
                <span className="text-xs font-semibold hidden sm:inline">Profile</span>
              </div>
            ) : (
              <Button onClick={onShowLogin} variant="outline" size="sm" className="h-9 text-xs">
                Sign In
              </Button>
            )}
          </div>
        </div>
      </div>


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
              href="https://wa.me/7508990616?text=Hi%2C%20I%20need%20help%20with%20the%20app"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 p-4 rounded-xl bg-gradient-to-r from-green-400 to-green-500 hover:from-green-500 hover:to-green-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5 border-0 w-full"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.67-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421-7.403h-.006c-1.405 0-2.734-.474-3.803-1.37-.968-.81-1.566-1.966-1.566-3.164C6.676 3.075 8.751 1 11.277 1c1.38 0 2.677.474 3.754 1.367 1.077.893 1.741 2.12 1.741 3.45 0 2.526-2.075 4.565-4.495 4.565z"/>
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

      {/* Thought Inbox Modal */}
      <ThoughtInboxModal
        isOpen={showThoughtInbox}
        onClose={() => setShowThoughtInbox(false)}
      />


    </>
  );
};
