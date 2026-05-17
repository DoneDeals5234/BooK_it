import { useState, useEffect } from 'react';
// Sheet removed
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
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate('/menu')}>
              <Menu className="h-5 w-5" />
            </Button>
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

      {/* Thought Inbox Modal */}
      <ThoughtInboxModal
        isOpen={showThoughtInbox}
        onClose={() => setShowThoughtInbox(false)}
      />


    </>
  );
};
