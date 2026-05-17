import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, type LocationData } from '@/contexts/AuthContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import toast from 'react-hot-toast';
import { getShops } from '@/lib/shops-storage';
import { fetchUserLocation } from '@/lib/geolocation';
import { initiateCashfreePayment } from '@/lib/cashfree-payment';
import { CreditCard, Store, CheckCircle, Check, Zap, X } from 'lucide-react';
import { PLAN_DETAILS, type PlanName, type ShopOwnerPlan } from '@/lib/supabase-shop-owner-plans';

interface CreateShopModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
  currentPlan?: ShopOwnerPlan | null;
  isUpgrade?: boolean;
}

const PREDEFINED_CATEGORIES = [
  'chemist',
  'hardware',
  'electrical',
  'food cart',
  'salon',
  'parlour',
  'restaurant',
  'shoes',
  'clothes',
  'cosmetics',
  'groceries',
  'stationery',
];

export const CreateShopModal = ({ open: controlledOpen, onOpenChange, onSuccess, currentPlan, isUpgrade }: CreateShopModalProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [shopCategory, setShopCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [displayAddress, setDisplayAddress] = useState('');
  const [availableCategories, setAvailableCategories] = useState<string[]>(PREDEFINED_CATEGORIES);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [upgradeComplete, setUpgradeComplete] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentEmail, setPaymentEmail] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<PlanName | null>(null);
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const { signUpAsShopOwner, user, aggregatedData } = useAuth();
  const { profile } = useUserProfile();

  // Use controlled state if provided, otherwise use internal state
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (onOpenChange || (() => {})) : setInternalOpen;

  // Load available categories from database
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const shops = await getShops();
        const shopCategories = new Set(shops.map(shop => shop.category.toLowerCase()));
        const merged = Array.from(new Set([...PREDEFINED_CATEGORIES, ...Array.from(shopCategories)]));
        setAvailableCategories(merged.sort());
      } catch (error) {
        console.error('Error loading categories:', error);
        setAvailableCategories(PREDEFINED_CATEGORIES);
      }
    };
    loadCategories();
  }, []);

  // Pre-fill email if user is logged in
  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user]);

  const handleLocationFetch = async () => {
    setLocationLoading(true);
    try {
      const location = await fetchUserLocation();
      setLocationData(location);

      const addressParts = [];
      if (location.street) addressParts.push(location.street);
      if (location.city) addressParts.push(location.city);
      if (location.state) addressParts.push(location.state);
      if (location.country) addressParts.push(location.country);

      const formattedAddress = addressParts.length > 0
        ? addressParts.join(', ')
        : location.formattedAddress;

      setDisplayAddress(formattedAddress);
      toast.success('Location fetched successfully!');
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to fetch location';
      toast.error(errorMsg);
      console.error('Location fetch error:', error);
    } finally {
      setLocationLoading(false);
    }
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentEmail.trim()) {
      toast.error('Please enter your email');
      return;
    }
    setEmailSubmitted(true);
  };

  const handlePayment = async (planToPay?: PlanName) => {
    const targetPlan = planToPay || selectedPlan;
    if (!targetPlan) {
      toast.error('Please select a plan first');
      return;
    }

    setPaymentProcessing(true);
    try {
      const planDetails = PLAN_DETAILS[targetPlan];

      // Handle FREE plan - skip Razorpay payment
      if (targetPlan === 'free') {
        console.log('🎉 FREE plan selected - skipping payment');
        setSelectedPlan('free');
        setPaymentComplete(true);
        setPaymentProcessing(false);
        toast.success(`Welcome to the FREE plan! Now complete your shop details.`);
        return;
      }

      // Handle paid plans - initiate Razorpay payment
      const tempUserId = isUpgrade && user ? user.uid : `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      console.log('💳 Initiating payment for plan:', targetPlan, 'amount:', planDetails.price);

      const emailForPayment = paymentEmail || user?.email || '';
      const nameForPayment = profile?.name || user?.email?.split('@')[0] || 'User';

      const success = await initiateCashfreePayment(
        {
          amount: planDetails.price,
          description: `${isUpgrade ? 'Plan Upgrade' : 'Shop Owner Plan'} - ${planDetails.name} (${planDetails.priceDisplay})`,
          userEmail: emailForPayment,
          userName: nameForPayment,
          userId: tempUserId,
          isShopOwnerRegistration: !isUpgrade,
          isShopOwnerPlan: true,
          planName: targetPlan,
        },
        (orderId) => {
          console.log('✅ Payment successful, order:', orderId);
          if (isUpgrade) {
            // For upgrade, show success message directly
            setUpgradeComplete(true);
            setPaymentProcessing(false);
            toast.success(`Plan successfully upgraded to ${planDetails.name}!`);
          } else {
            // For new shop creation, show shop details form
            setPaymentComplete(true);
            setPaymentProcessing(false);
            toast.success(`Payment successful for ${planDetails.name} plan! Now complete shop details.`);
          }
        },
        (error) => {
          console.error('❌ Payment failed:', error);
          setPaymentProcessing(false);
          toast.error(`Payment failed: ${error}`);
        }
      );
    } catch (error) {
      console.error('Payment error:', error);
      setPaymentProcessing(false);
      toast.error(error instanceof Error ? error.message : 'Payment error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!shopName.trim()) {
        toast.error('Please enter a shop name');
        setLoading(false);
        return;
      }

      let finalCategory = shopCategory;
      if (shopCategory === 'other') {
        if (!customCategory.trim()) {
          toast.error('Please enter your shop category');
          setLoading(false);
          return;
        }
        finalCategory = customCategory.toLowerCase();
        
        if (!availableCategories.includes(finalCategory)) {
          setAvailableCategories(prev => [...prev, finalCategory].sort());
        }
      } else if (!shopCategory) {
        toast.error('Please select a shop category');
        setLoading(false);
        return;
      }

      const finalEmail = paymentEmail || user?.email || '';
      if (!finalEmail) {
        toast.error('User email not found. Please try again.');
        setLoading(false);
        return;
      }

      const shopPassword = password || Math.floor(100000 + Math.random() * 900000).toString();
      await signUpAsShopOwner(finalEmail, shopPassword, shopName, finalCategory, locationData || undefined);
      toast.success('Shop created successfully!');
      
      // Close modal and call success callback
      setOpen(false);
      onSuccess?.();

      // Reset form
      setPaymentEmail('');
      setEmail('');
      setPassword('');
      setShopName('');
      setShopCategory('');
      setCustomCategory('');
      setPaymentComplete(false);
      setLocationData(null);
      setDisplayAddress('');
    } catch (error: any) {
      console.error('Shop creation error:', error);
      toast.error(error.message || 'Failed to create shop');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      // Pre-fill email if user is logged in
      if (user?.email) {
        setPaymentEmail(user.email);
      }
    } else {
      // Reset when modal closes
      setSelectedPlan(null);
      setPaymentComplete(false);
      setUpgradeComplete(false);
    }
  };

  const handlePlanSelected = (plan: PlanName) => {
    setSelectedPlan(plan);
    handlePayment(plan);
  };

  const allPlans: PlanName[] = isUpgrade ? ['basic', 'pro', 'premium'] : ['free', 'basic', 'pro', 'premium'];
  const plans = allPlans.filter(p => {
    // Hide the current plan if it's already paid
    if (currentPlan?.payment_status === 'success' && p === currentPlan.plan_name) {
      return false;
    }

    // If in upgrade mode, only show plans with a higher price
    if (isUpgrade && currentPlan) {
      return PLAN_DETAILS[p].price > currentPlan.plan_price;
    }

    return true;
  });

  const hasPaidPlan = !isUpgrade && currentPlan?.payment_status === 'success';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} modal={!paymentProcessing}>
      <DialogContent
        className={`${!paymentComplete ? 'sm:max-w-4xl' : 'sm:max-w-md'} max-h-[90vh] overflow-y-auto`}
        hideClose
        onPointerDownOutside={(e) => {
          if (paymentProcessing) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (paymentProcessing) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isUpgrade ? (
              <>
                <Store className="h-5 w-5" />
                {upgradeComplete ? 'Plan Upgraded!' : 'Upgrade Your Plan'}
              </>
            ) : (
              <>
                <Store className="h-5 w-5" />
                {!paymentComplete ? 'Choose Your Plan' : 'Shop Details'}
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isUpgrade ? (
              upgradeComplete
                ? 'Your plan has been successfully upgraded! You now have access to premium features.'
                : 'Select a higher tier plan to unlock more features'
            ) : (
              !paymentComplete
                ? 'Select the perfect plan for your shop. Upgrade anytime.'
                : 'Fill in your shop information'
            )}
          </DialogDescription>
        </DialogHeader>

        {upgradeComplete ? (
          // Upgrade Success Screen
          <div className="space-y-4 text-center py-6">
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-16 w-16 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Congratulations!</h3>
            <p className="text-sm text-gray-600">
              Your plan has been successfully upgraded to <strong>{selectedPlan ? PLAN_DETAILS[selectedPlan].name : 'Premium'}</strong> plan.
            </p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
              <p className="text-xs text-green-700 font-semibold">✓ Upgrade Complete</p>
              <p className="text-sm text-green-700 mt-2">You now have access to all premium features and benefits.</p>
            </div>
            <Button
              onClick={() => {
                setOpen(false);
                onSuccess?.();
              }}
              className="w-full bg-green-600 hover:bg-green-700 mt-6"
            >
              Done
            </Button>
          </div>
        ) : !paymentComplete ? (
          // Always show Plan Selection Grid until payment is complete
          <div className="space-y-4 bg-gradient-to-b from-blue-600 to-blue-500 rounded-xl p-6 -mx-6 -mt-2">
            <div className="text-center text-white mb-6">
              <h2 className="text-3xl font-extrabold tracking-tight">Book It Pricing Plans</h2>
              <p className="text-blue-100 mt-1 font-medium italic">Choose Your Plan for Booking Success!</p>
            </div>

            <div className={`grid grid-cols-1 md:grid-cols-2 ${
              plans.length >= 4 ? 'lg:grid-cols-4' : plans.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'
            } gap-6 py-4`}>
              {plans.length === 0 && (
                <div className="col-span-full py-12 text-center">
                  <p className="text-white font-medium">No higher tier plans available at this time.</p>
                </div>
              )}
              {plans.map((plan) => {
                const details = PLAN_DETAILS[plan];
                const isProcessingThis = paymentProcessing && selectedPlan === plan;
                const isAlreadyPaid = hasPaidPlan && currentPlan?.plan_name === plan;
                const isCurrentPlan = currentPlan?.plan_name === plan && hasPaidPlan;

                return (
                  <div
                    key={plan}
                    className={`relative rounded-xl bg-white shadow-2xl flex flex-col transition-all duration-300 hover:scale-[1.02] ${
                      isCurrentPlan ? 'ring-4 ring-amber-400' : ''
                    }`}
                  >
                    {/* Top Ribbon */}
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-[85%] z-10">
                      <div
                        className="h-10 rounded-lg shadow-lg flex items-center justify-center text-white font-black tracking-widest text-lg relative"
                        style={{ backgroundColor: details.color }}
                      >
                        {details.name}
                        {/* Ribbon side shadows */}
                        <div className="absolute -bottom-1 -left-1 w-2 h-2 brightness-75 -z-10" style={{ backgroundColor: details.color }} />
                        <div className="absolute -bottom-1 -right-1 w-2 h-2 brightness-75 -z-10" style={{ backgroundColor: details.color }} />
                      </div>
                    </div>

                    <div className="pt-10 px-4 pb-6 flex-1 flex flex-col items-center">
                      <div className="text-center mb-6">
                        <div className="flex items-center justify-center gap-0.5">
                          <span className="text-2xl font-bold text-gray-700 self-start mt-1">₹</span>
                          <span className="text-5xl font-black text-gray-800 tracking-tight">{details.priceDisplay.replace('₹', '')}</span>
                        </div>
                        <p className="text-sm font-bold text-gray-500 mt-1">{details.subtitle}</p>
                      </div>

                      <div className="w-full space-y-0.5 mb-8 border-t border-gray-100">
                        {details.features.map((feature, idx) => (
                          <div key={idx} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0 group">
                            {feature.included ? (
                              <div className="bg-green-50 rounded-full p-0.5">
                                <Check className="h-3.5 w-3.5 text-green-600 font-black" />
                              </div>
                            ) : (
                              <div className="bg-red-50 rounded-full p-0.5">
                                <X className="h-3.5 w-3.5 text-red-600 font-black" />
                              </div>
                            )}
                            <span className={`text-[12px] font-medium leading-tight ${feature.included ? 'text-gray-700' : 'text-gray-400 line-through decoration-red-200'}`}>
                              {feature.name}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-auto w-full">
                        {isAlreadyPaid && aggregatedData?.isShopOwner ? (
                          <div className="w-full p-3 bg-orange-50 border border-orange-200 rounded-lg text-center">
                            <p className="text-sm font-semibold text-orange-700">✓ Owned</p>
                          </div>
                        ) : (
                          <Button
                            onClick={() => {
                              if (isAlreadyPaid) {
                                setSelectedPlan(plan);
                                setPaymentComplete(true);
                                toast.success(`Using your active ${details.name} plan`);
                              } else {
                                handlePlanSelected(plan);
                              }
                            }}
                            disabled={paymentProcessing}
                            className="w-full h-12 rounded-xl text-lg font-bold shadow-lg transition-all hover:translate-y-[-2px] hover:shadow-xl active:translate-y-0"
                            style={{
                              backgroundColor: details.color,
                              color: 'white'
                            }}
                          >
                            {isProcessingThis ? (
                              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            ) : isAlreadyPaid ? (
                              'Continue'
                            ) : (
                              'Select'
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-center pt-4">
              <div className="inline-block relative">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-white/30"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-transparent px-8 text-white font-black tracking-widest text-lg drop-shadow-md">
                    Build Without Limits, Pay Just Once!
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Shop Details Form
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="h-5 w-5" />
                <span className="font-bold text-sm">Plan Confirmed & Occupied</span>
              </div>
              <div className="flex items-center justify-between bg-white/60 p-3 rounded-md border border-green-100">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: selectedPlan ? PLAN_DETAILS[selectedPlan].color : '#3b82f6' }}
                  >
                    {selectedPlan ? PLAN_DETAILS[selectedPlan].name[0].toUpperCase() : 'B'}
                  </div>
                  <div>
                    <p className="text-xs text-green-600 font-semibold uppercase tracking-wider">Active Plan</p>
                    <p className="text-sm font-bold text-gray-900">{selectedPlan ? PLAN_DETAILS[selectedPlan].name : 'Basic'} Plan</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-green-600 font-semibold uppercase tracking-wider">Amount Paid</p>
                  <p className="text-sm font-bold text-gray-900">{selectedPlan ? PLAN_DETAILS[selectedPlan].priceDisplay : '₹0'}</p>
                </div>
              </div>
              <p className="text-[11px] text-green-600 font-medium">
                Payment verified successfully. Your plan is now active for this account.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="shop-name">Shop Name</Label>
              <Input
                id="shop-name"
                type="text"
                placeholder="Enter your shop name"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shop-category">Shop Category</Label>
              <select
                id="shop-category"
                value={shopCategory}
                onChange={(e) => {
                  setShopCategory(e.target.value);
                  if (e.target.value !== 'other') {
                    setCustomCategory('');
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select a category</option>
                {availableCategories.map((category) => (
                  <option key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </option>
                ))}
                <option value="other">Other (Please specify)</option>
              </select>
            </div>

            {shopCategory === 'other' && (
              <div className="space-y-2">
                <Label htmlFor="custom-category">Enter Your Shop Category</Label>
                <Input
                  id="custom-category"
                  type="text"
                  placeholder="e.g., Pet Store, Pharmacy, etc."
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="location">Location (Optional)</Label>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleLocationFetch}
                disabled={locationLoading}
              >
                {locationLoading ? 'Fetching Location...' : '📍 Get My Location'}
              </Button>
              {displayAddress && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-900">
                    <strong>Location:</strong> {displayAddress}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setLocationData(null);
                      setDisplayAddress('');
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 mt-2"
                  >
                    Clear Location
                  </button>
                </div>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating Shop...' : 'Create Shop'}
            </Button>
          </form>
        )}

        <div className="text-center text-xs text-gray-500 mt-4">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setPaymentComplete(false);
              setPaymentEmail('');
              setSelectedPlan(null);
            }}
            className="text-gray-600 hover:text-gray-900 underline"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
