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
  const [phone, setPhone] = useState('');
  const [altPhone, setAltPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [displayAddress, setDisplayAddress] = useState('');
  const [availableCategories, setAvailableCategories] = useState<string[]>(PREDEFINED_CATEGORIES);
  const [selectedPlan, setSelectedPlan] = useState<PlanName | null>(null);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [instagramId, setInstagramId] = useState('');
  const [facebookId, setFacebookId] = useState('');
  const [showLocationMenu, setShowLocationMenu] = useState(false);
  const [showManualLocation, setShowManualLocation] = useState(false);
  
  const [village, setVillage] = useState('');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');
  const [address, setAddress] = useState('');
  
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
    if (profile) {
      if (profile.phone) setPhone(profile.phone);
      if (profile.instagram_id) setInstagramId(profile.instagram_id);
      if (profile.facebook_id) setFacebookId(profile.facebook_id);
    }
  }, [user, profile]);

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

  const handleManualLocationToggle = () => {
    setShowManualLocation(true);
    setShowLocationMenu(false);
    setLocationData(null);
    setDisplayAddress('');
  };

  const handleDeviceLocationFetch = async () => {
    setShowLocationMenu(false);
    setLocationLoading(true);
    try {
      const location = await fetchUserLocation();
      setLocationData(location);
      const addressParts = [location.street, location.city, location.state, location.country].filter(Boolean);
      setDisplayAddress(addressParts.length > 0 ? addressParts.join(', ') : location.formattedAddress);
      setShowManualLocation(false); // Hide manual fields if we got device location
      toast.success('Location detected!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to detect location');
    } finally {
      setLocationLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName.trim()) return toast.error('Please enter a shop name');
    if (!phone.trim()) return toast.error('Please enter a primary phone number');
    
    setLoading(true);
    try {
      const finalCategory = shopCategory === 'other' ? customCategory.toLowerCase() : shopCategory;
      
      const finalLocationData: LocationData | undefined = locationData || (showManualLocation ? {
        address: address,
        street: village,
        state: state,
        country: country,
        latitude: null,
        longitude: null,
        formattedAddress: address || `${village}, ${state}`,
        city: district
      } : undefined);

      await signUpAsShopOwner(
        user?.email || '', 
        password || '123456', 
        shopName, 
        finalCategory, 
        finalLocationData, 
        phone, 
        altPhone,
        instagramId,
        facebookId
      );
      
      // Update the shop with phone numbers after creation if needed
      // (Actually signUpAsShopOwner in AuthContext creates the shop)
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
              {!user ? (
                <>
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-bold">Account Email</Label>
                    <Input 
                      type="email"
                      placeholder="email@example.com" 
                      className="h-12 rounded-xl"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-bold">Account Password</Label>
                    <Input 
                      type="password"
                      placeholder="Create a password" 
                      className="h-12 rounded-xl"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </>
              ) : (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase font-black text-slate-400">Linked Account</p>
                    <p className="text-sm font-bold text-slate-700">{user.email}</p>
                  </div>
                  <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-black uppercase">Authenticated</span>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-slate-700 font-bold">Shop Name</Label>
                <Input 
                  placeholder="e.g. Classic Shop" 
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
                <Label className="text-slate-700 font-bold">Primary Phone Number</Label>
                <Input 
                  placeholder="Enter phone number" 
                  className="h-12 rounded-xl"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-700 font-bold">Alternative Phone Number (Optional)</Label>
                <Input 
                  placeholder="Enter alternative number" 
                  className="h-12 rounded-xl"
                  value={altPhone}
                  onChange={(e) => setAltPhone(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-700 font-bold">Instagram ID (Optional)</Label>
                  <Input 
                    placeholder="e.g. username" 
                    className="h-12 rounded-xl"
                    value={instagramId}
                    onChange={(e) => setInstagramId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700 font-bold">Facebook ID (Optional)</Label>
                  <Input 
                    placeholder="e.g. username" 
                    className="h-12 rounded-xl"
                    value={facebookId}
                    onChange={(e) => setFacebookId(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <Label className="text-slate-700 font-bold">Location</Label>
                {!showManualLocation && !displayAddress && !locationLoading && (
                  <Button 
                    type="button" 
                    className="w-full h-16 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white hover:from-slate-800 hover:to-slate-700 flex items-center justify-center gap-4 shadow-xl border-b-4 border-slate-950 active:border-b-0 active:translate-y-1 transition-all group"
                    onClick={() => setShowLocationMenu(true)}
                  >
                    <div className="h-10 w-10 bg-white/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <MapPin className="h-6 w-6" />
                    </div>
                    <div className="text-left">
                      <span className="block text-sm font-black uppercase tracking-tight">Enter Shop Location</span>
                      <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-widest">Manual or GPS</span>
                    </div>
                  </Button>
                )}

                {locationLoading && (
                  <div className="w-full h-14 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center gap-3 animate-pulse bg-slate-50">
                    <MapPin className="h-6 w-6 text-slate-400" />
                    <span className="text-slate-500 font-bold">Fetching Location...</span>
                  </div>
                )}

                {displayAddress && !locationLoading && (
                  <div className="space-y-3">
                    <div className="bg-slate-100 p-4 rounded-2xl border border-slate-200 flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-red-500 mt-1 shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-slate-700">Device Location Detected</p>
                        <p className="text-xs text-slate-500 italic">{displayAddress}</p>
                      </div>
                    </div>
                    <Button 
                      type="button" 
                      variant="link" 
                      className="text-blue-600 font-bold p-0 h-auto"
                      onClick={() => setShowLocationMenu(true)}
                    >
                      Change Location
                    </Button>
                  </div>
                )}

                {showManualLocation && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-bold text-slate-800 text-sm">Manual Address Details</h4>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        className="text-blue-600 h-auto p-0 font-bold"
                        onClick={handleDeviceLocationFetch}
                      >
                        Use GPS Instead
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-black text-slate-400">Village</Label>
                        <Input placeholder="Village" value={village} onChange={(e) => setVillage(e.target.value)} className="h-10 rounded-lg text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-black text-slate-400">District</Label>
                        <Input placeholder="District" value={district} onChange={(e) => setDistrict(e.target.value)} className="h-10 rounded-lg text-sm" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-black text-slate-400">State</Label>
                        <Input placeholder="State" value={state} onChange={(e) => setState(e.target.value)} className="h-10 rounded-lg text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-black text-slate-400">Country</Label>
                        <Input placeholder="Country" value={country} onChange={(e) => setCountry(e.target.value)} className="h-10 rounded-lg text-sm" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-black text-slate-400">Full Address</Label>
                      <Input placeholder="House No, Street, Landmark" value={address} onChange={(e) => setAddress(e.target.value)} className="h-12 rounded-lg text-sm" />
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Location Menu Bottom Sheet */}
              <AnimatePresence>
                {showLocationMenu && (
                  <>
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setShowLocationMenu(false)}
                      className="fixed inset-0 bg-black/60 z-[100] backdrop-blur-sm"
                    />
                    <motion.div 
                      initial={{ y: "100%" }}
                      animate={{ y: 0 }}
                      exit={{ y: "100%" }}
                      transition={{ type: "spring", damping: 25, stiffness: 200 }}
                      className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[32px] z-[101] p-6 pb-12 shadow-2xl"
                    >
                      <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
                      <h3 className="text-xl font-black text-slate-900 mb-6 text-center">Enter Shop Location</h3>
                      <div className="grid grid-cols-1 gap-4">
                        <Button 
                          type="button"
                          className="h-16 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-start px-6 gap-4 shadow-lg shadow-blue-100"
                          onClick={handleDeviceLocationFetch}
                        >
                          <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center">
                            <MapPin className="h-6 w-6" />
                          </div>
                          <div className="text-left">
                            <p className="font-bold">Use Current Location</p>
                            <p className="text-[10px] opacity-80">Best for accurate GPS coordinates</p>
                          </div>
                        </Button>
                        <Button 
                          type="button"
                          variant="outline"
                          className="h-16 rounded-2xl border-2 border-slate-200 hover:bg-slate-50 flex items-center justify-start px-6 gap-4"
                          onClick={handleManualLocationToggle}
                        >
                          <div className="h-10 w-10 bg-slate-100 rounded-xl flex items-center justify-center">
                            <Edit className="h-6 w-6 text-slate-600" />
                          </div>
                          <div className="text-left text-slate-700">
                            <p className="font-bold">Fill Manually</p>
                            <p className="text-[10px] opacity-80 text-slate-500">Type address and village details</p>
                          </div>
                        </Button>
                      </div>
                      <Button 
                        variant="ghost" 
                        className="w-full mt-6 text-slate-500 font-bold"
                        onClick={() => setShowLocationMenu(false)}
                      >
                        Cancel
                      </Button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>

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
