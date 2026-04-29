import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Plus, Check } from 'lucide-react';
import { getPlans, type Plan } from '@/lib/supabase-plans';
import toast from 'react-hot-toast';

interface AddShopPageProps {
  onClose: () => void;
}

type FormStep = 'shop-info' | 'owner-credentials' | 'plan-selection' | 'success';

export const AddShopPage = ({ onClose }: AddShopPageProps) => {
  const [currentStep, setCurrentStep] = useState<FormStep>('shop-info');
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);

  // Form state
  const [shopName, setShopName] = useState('');
  const [category, setCategory] = useState('salon');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [successShopId, setSuccessShopId] = useState('');

  // Load plans on mount
  useEffect(() => {
    const loadPlans = async () => {
      setPlansLoading(true);
      const fetchedPlans = await getPlans();
      setPlans(fetchedPlans);
      if (fetchedPlans.length > 0) {
        setSelectedPlanId(fetchedPlans[0].id);
      }
      setPlansLoading(false);
    };
    loadPlans();
  }, []);

  // Validation functions
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const isStrongPassword = (password: string): boolean => {
    return (
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password)
    );
  };

  // Step validation
  const validateShopInfo = (): boolean => {
    if (!shopName.trim()) {
      toast.error('Please enter a shop name');
      return false;
    }
    if (!category.trim()) {
      toast.error('Please select a shop category');
      return false;
    }
    return true;
  };

  const validateOwnerCredentials = (): boolean => {
    if (!ownerEmail.trim()) {
      toast.error('Please enter an email address');
      return false;
    }
    if (!isValidEmail(ownerEmail)) {
      toast.error('Please enter a valid email address');
      return false;
    }
    if (!ownerPassword.trim()) {
      toast.error('Please enter a password');
      return false;
    }
    if (!isStrongPassword(ownerPassword)) {
      toast.error('Password must have at least 8 characters, including uppercase, lowercase, and numbers');
      return false;
    }
    if (ownerPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return false;
    }
    return true;
  };

  const validatePlanSelection = (): boolean => {
    if (!selectedPlanId) {
      toast.error('Please select a plan');
      return false;
    }
    return true;
  };

  // Step handlers
  const handleNextStep = () => {
    if (currentStep === 'shop-info' && validateShopInfo()) {
      setCurrentStep('owner-credentials');
    } else if (currentStep === 'owner-credentials' && validateOwnerCredentials()) {
      setCurrentStep('plan-selection');
    } else if (currentStep === 'plan-selection' && validatePlanSelection()) {
      handleCreateShop();
    }
  };

  const handlePreviousStep = () => {
    if (currentStep === 'owner-credentials') {
      setCurrentStep('shop-info');
    } else if (currentStep === 'plan-selection') {
      setCurrentStep('owner-credentials');
    }
  };

  // Create shop
  const handleCreateShop = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-shop-with-owner`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            shopName: shopName.trim(),
            category,
            planId: selectedPlanId,
            ownerEmail: ownerEmail.trim(),
            ownerPassword,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to create shop');
        return;
      }

      setSuccessShopId(data.shopId);
      setCurrentStep('success');
      toast.success('Shop created successfully!');
    } catch (error) {
      console.error('Error creating shop:', error);
      toast.error('Failed to create shop');
    } finally {
      setLoading(false);
    }
  };

  // Reset form
  const handleStartOver = () => {
    setShopName('');
    setCategory('salon');
    setOwnerEmail('');
    setOwnerPassword('');
    setConfirmPassword('');
    setSelectedPlanId(plans.length > 0 ? plans[0].id : '');
    setCurrentStep('shop-info');
  };

  return (
    <div className="h-screen bg-background p-6 flex flex-col overflow-hidden">
      <div className="max-w-2xl mx-auto space-y-6 flex-1 overflow-y-auto scroll-smooth">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={currentStep === 'success' ? onClose : handlePreviousStep}
            disabled={currentStep === 'shop-info'}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {currentStep === 'shop-info' && 'Add New Shop'}
              {currentStep === 'owner-credentials' && 'Owner Account'}
              {currentStep === 'plan-selection' && 'Select Plan'}
              {currentStep === 'success' && 'Shop Created'}
            </h1>
            <p className="text-muted-foreground">
              {currentStep === 'shop-info' && 'Provide basic shop information'}
              {currentStep === 'owner-credentials' && 'Set up your owner account credentials'}
              {currentStep === 'plan-selection' && 'Choose a subscription plan'}
              {currentStep === 'success' && 'Your shop has been created successfully'}
            </p>
          </div>
        </div>

        {/* Step Indicators */}
        {currentStep !== 'success' && (
          <div className="flex gap-2">
            <div className={`flex-1 h-1 rounded-full ${currentStep === 'shop-info' ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`flex-1 h-1 rounded-full ${['owner-credentials', 'plan-selection'].includes(currentStep) ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`flex-1 h-1 rounded-full ${currentStep === 'plan-selection' ? 'bg-primary' : 'bg-muted'}`} />
          </div>
        )}

        {/* Step 1: Shop Information */}
        {currentStep === 'shop-info' && (
          <Card>
            <CardHeader>
              <CardTitle>Shop Information</CardTitle>
              <CardDescription>
                Provide basic shop details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Shop Name */}
              <div className="space-y-2">
                <Label htmlFor="shop-name">Shop Name *</Label>
                <Input
                  id="shop-name"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="e.g., Classic Cuts Barber Shop"
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  The name of your shop that customers will see
                </p>
              </div>

              {/* Shop Category */}
              <div className="space-y-2">
                <Label htmlFor="shop-category">Shop Category *</Label>
                <select
                  id="shop-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                  disabled={loading}
                >
                  <option value="salon">💇 Salon</option>
                  <option value="parlour">💄 Parlour</option>
                  <option value="restaurant">🍽️ Restaurant</option>
                  <option value="gym">🏋️ Gym</option>
                  <option value="clinic">⚕️ Clinic</option>
                  <option value="shoes">👟 Shoes</option>
                  <option value="clothes">👔 Clothes</option>
                  <option value="cosmetics">💅 Cosmetics</option>
                  <option value="groceries">🛒 Groceries</option>
                  <option value="stationery">✏️ Stationery</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  Select the type of shop
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Owner Credentials */}
        {currentStep === 'owner-credentials' && (
          <Card>
            <CardHeader>
              <CardTitle>Owner Account</CardTitle>
              <CardDescription>
                Create login credentials for the shop owner. Anyone can sign in with this email and password to access the owner portal.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="owner-email">Email Address *</Label>
                <Input
                  id="owner-email"
                  type="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  placeholder="owner@example.com"
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  This email will be used to login to the shop owner portal
                </p>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="owner-password">Password *</Label>
                <Input
                  id="owner-password"
                  type="password"
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  Must be at least 8 characters with uppercase, lowercase, and numbers
                </p>
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password *</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Plan Selection */}
        {currentStep === 'plan-selection' && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Select Subscription Plan</CardTitle>
                <CardDescription>
                  Choose a plan that best suits your business needs. You can change your plan anytime.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {plansLoading ? (
                  <p className="text-muted-foreground text-center py-8">Loading plans...</p>
                ) : plans.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No plans available</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-3">
                    {plans.map((plan) => (
                      <div
                        key={plan.id}
                        onClick={() => setSelectedPlanId(plan.id)}
                        className={`p-4 border rounded-lg cursor-pointer transition ${
                          selectedPlanId === plan.id
                            ? 'border-primary bg-primary/5'
                            : 'border-muted hover:border-primary'
                        }`}
                      >
                        <h3 className="font-semibold mb-2">{plan.name}</h3>
                        <p className="text-xs text-muted-foreground mb-3">{plan.description}</p>
                        {plan.features.length > 0 && (
                          <ul className="text-xs space-y-1">
                            {plan.features.slice(0, 3).map((feature, idx) => (
                              <li key={idx} className="text-muted-foreground">
                                ✓ {feature}
                              </li>
                            ))}
                            {plan.features.length > 3 && (
                              <li className="text-muted-foreground">
                                + {plan.features.length - 3} more
                              </li>
                            )}
                          </ul>
                        )}
                        {selectedPlanId === plan.id && (
                          <div className="mt-3 pt-3 border-t border-primary">
                            <p className="text-xs font-semibold text-primary">Selected</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 4: Success */}
        {currentStep === 'success' && (
          <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
            <CardContent className="pt-6 text-center">
              <Check className="h-16 w-16 text-green-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-green-900 dark:text-green-200 mb-2">
                Shop Created Successfully!
              </h2>
              <p className="text-green-900 dark:text-green-200 mb-4">
                Your shop has been created with the following details:
              </p>
              <div className="bg-white dark:bg-slate-950 rounded p-4 mb-4 text-left space-y-2">
                <p><strong>Shop Name:</strong> {shopName}</p>
                <p><strong>Category:</strong> {category}</p>
                <p><strong>Owner Email:</strong> {ownerEmail}</p>
                <p><strong>Plan:</strong> {plans.find(p => p.id === selectedPlanId)?.name}</p>
                <p><strong>Shop ID:</strong> {successShopId}</p>
              </div>
              <p className="text-sm text-green-900 dark:text-green-200 mb-4">
                You can now login with your email and password to access the owner portal and complete your shop details.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Navigation Buttons */}
        <div className="flex gap-3">
          {currentStep !== 'success' && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleNextStep}
                className="flex-1"
                disabled={loading || (currentStep === 'plan-selection' && plansLoading)}
              >
                <Plus className="mr-2 h-4 w-4" />
                {currentStep === 'plan-selection' ? 'Create Shop' : 'Next'}
              </Button>
            </>
          )}
          {currentStep === 'success' && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleStartOver}
                className="flex-1"
              >
                Add Another Shop
              </Button>
              <Button
                type="button"
                onClick={onClose}
                className="flex-1"
              >
                Done
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
