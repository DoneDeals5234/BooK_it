import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, type LocationData } from '@/contexts/AuthContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import toast from 'react-hot-toast';
import { ArrowLeft, Store, CheckCircle, Check, X, MapPin } from 'lucide-react';
import { fetchUserLocation } from '@/lib/geolocation';
import { initiateRazorpayPayment } from '@/lib/razorpay-payment';
import { PLAN_DETAILS, type PlanName } from '@/lib/supabase-shop-owner-plans';
import { getShops } from '@/lib/shops-storage';
import { useAppUpdate } from '@/contexts/AppUpdateContext';

const PREDEFINED_CATEGORIES = [
  'chemist', 'hardware', 'electrical', 'food cart', 'salon', 'parlour',
  'restaurant', 'shoes', 'clothes', 'cosmetics', 'groceries', 'stationery'
];

export const CreateShopPage = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<'plan' | 'details' | 'success'>('plan');
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
  const [selectedPlan, setSelectedPlan] = useState<PlanName | null>(null);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  
  const { signUpAsShopOwner, user, aggregatedData } = useAuth();
  const { profile } = useUserProfile();

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const shops = await getShops();
        const shopCategories = new Set(shops.map(shop => shop.category.toLowerCase()));
        const merged = Array.from(new Set([...PREDEFINED_CATEGORIES, ...Array.from(shopCategories)]));
        setAvailableCategories(merged.sort());
      } catch (error) {
        setAvailableCategories(PREDEFINED_CATEGORIES);
      }
    };
    loadCategories();
  }, []);

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user]);

  const handleLocationFetch = async () => {
    setLocationLoading(true);
    try {
      const location = await fetchUserLocation();
      setLocationData(location);
      const addressParts = [location.street, location.city, location.state, location.country].filter(Boolean);
      setDisplayAddress(addressParts.length > 0 ? addressParts.join(', ') : location.formattedAddress);
      toast.success('Location fetched successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch location');
    } finally {
      setLocationLoading(false);
    }
  };

  const handlePlanSelected = async (plan: PlanName) => {
    setSelectedPlan(plan);
    
    if (plan === 'free') {
      setCurrentStep('details');
      toast.success('Free plan selected!');
      return;
    }

    setPaymentProcessing(true);
    try {
      const planDetails = PLAN_DETAILS[plan];
      const emailForPayment = user?.email || '';
      const nameForPayment = profile?.name || 'User';

      await initiateRazorpayPayment(
        {
          amount: planDetails.price,
          description: `Shop Owner Plan - ${planDetails.name}`,
          userEmail: emailForPayment,
          userName: nameForPayment,
          userId: user?.uid || `temp_${Date.now()}`,
          isShopOwnerRegistration: true,
          isShopOwnerPlan: true,
          planName: plan,
        },
        () => {
          setPaymentProcessing(false);
          setCurrentStep('details');
          toast.success('Payment successful! Now complete your shop details.');
        },
        (error) => {
          setPaymentProcessing(false);
          toast.error(`Payment failed: ${error}`);
        }
      );
    } catch (error) {
      setPaymentProcessing(false);
      toast.error('Payment error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName.trim()) return toast.error('Please enter a shop name');
    
    setLoading(true);
    try {
      const finalCategory = shopCategory === 'other' ? customCategory.toLowerCase() : shopCategory;
      await signUpAsShopOwner(user?.email || '', password || '123456', shopName, finalCategory, locationData || undefined);
      toast.success('Shop created successfully!');
      setCurrentStep('success');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create shop');
    } finally {
      setLoading(false);
    }
  };

  const plans: PlanName[] = ['free', 'basic', 'pro', 'premium'];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10 px-4 py-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {currentStep === 'plan' && 'Choose Your Plan'}
            {currentStep === 'details' && 'Complete Shop Details'}
            {currentStep === 'success' && 'Shop Created!'}
          </h1>
          <p className="text-xs text-slate-500 font-medium">Create your professional shop presence</p>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-4xl mx-auto w-full">
        {currentStep === 'plan' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {plans.map((plan) => {
                const details = PLAN_DETAILS[plan];
                const isProcessing = paymentProcessing && selectedPlan === plan;
                return (
                  <div key={plan} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                    <div className="p-6 flex-1">
                      <div className="flex justify-between items-start mb-4">
                        <div className="p-2 rounded-xl bg-slate-50" style={{ color: details.color }}>
                          <Store className="h-6 w-6" />
                        </div>
                        <span className="text-2xl font-black" style={{ color: details.color }}>₹{details.priceDisplay.replace('₹', '')}</span>
                      </div>
                      <h3 className="text-xl font-bold mb-1">{details.name}</h3>
                      <p className="text-sm text-slate-500 mb-6">{details.subtitle}</p>
                      <ul className="space-y-3">
                        {details.features.map((f, i) => (
                          <li key={i} className="flex items-center gap-3 text-sm font-medium">
                            {f.included ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-slate-300" />}
                            <span className={f.included ? 'text-slate-700' : 'text-slate-400 line-through'}>{f.name}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="p-4 bg-slate-50 border-t">
                      <Button 
                        className="w-full h-12 text-lg font-bold rounded-xl"
                        style={{ backgroundColor: details.color }}
                        onClick={() => handlePlanSelected(plan)}
                        disabled={paymentProcessing}
                      >
                        {isProcessing ? 'Processing...' : 'Select Plan'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {currentStep === 'details' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
            <div className="bg-green-50 rounded-xl p-4 flex items-center gap-3 border border-green-100">
              <CheckCircle className="h-6 w-6 text-green-500" />
              <div>
                <p className="text-sm font-bold text-green-800">Plan Confirmed</p>
                <p className="text-xs text-green-600 font-medium">You selected the {PLAN_DETAILS[selectedPlan!].name} plan.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-700 font-bold">Shop Name</Label>
                <Input 
                  placeholder="e.g. Classic Barber" 
                  className="h-12 rounded-xl"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-700 font-bold">Category</Label>
                <select 
                  className="w-full h-12 rounded-xl border border-slate-200 px-4 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={shopCategory}
                  onChange={(e) => setShopCategory(e.target.value)}
                  required
                >
                  <option value="">Select Category</option>
                  {availableCategories.map(c => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                  <option value="other">Other</option>
                </select>
              </div>

              {shopCategory === 'other' && (
                <Input 
                  placeholder="Specify category" 
                  className="h-12 rounded-xl"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                />
              )}

              <div className="space-y-2">
                <Label className="text-slate-700 font-bold">Location</Label>
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full h-12 rounded-xl border-dashed border-2 border-slate-200 flex gap-2"
                  onClick={handleLocationFetch}
                  disabled={locationLoading}
                >
                  <MapPin className="h-4 w-4" />
                  {locationLoading ? 'Fetching...' : 'Fetch My Location'}
                </Button>
                {displayAddress && (
                  <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border italic">{displayAddress}</p>
                )}
              </div>

              <Button type="submit" className="w-full h-14 text-xl font-black bg-blue-600 hover:bg-blue-700 rounded-xl mt-4 shadow-lg shadow-blue-200" disabled={loading}>
                {loading ? 'Creating...' : 'Create My Shop'}
              </Button>
            </form>
          </div>
        )}

        {currentStep === 'success' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center space-y-6">
            <div className="flex justify-center">
              <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center">
                <Check className="h-12 w-12 text-green-600" />
              </div>
            </div>
            <h2 className="text-3xl font-black text-slate-900">All Set!</h2>
            <p className="text-slate-500 font-medium">Your shop "{shopName}" has been created successfully. You can now start managing your services and bookings.</p>
            <Button className="w-full h-14 text-xl font-bold bg-slate-900 hover:bg-slate-800 rounded-xl mt-4" onClick={() => navigate('/')}>
              Go to Dashboard
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};
