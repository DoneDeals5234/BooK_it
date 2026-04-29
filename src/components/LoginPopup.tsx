import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, type LocationData } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { fetchUserLocation } from '@/lib/geolocation';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { Preferences } from '@capacitor/preferences';

interface LoginPopupProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

type AuthStep = 'choice' | 'signin' | 'signup';

export const LoginPopup = ({ open: controlledOpen, onOpenChange }: LoginPopupProps = {}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const [authStep, setAuthStep] = useState<AuthStep>('choice');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [displayAddress, setDisplayAddress] = useState('');
  const { signIn, signUp, user } = useAuth();

  // Use controlled state if provided, otherwise use internal state
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (onOpenChange || (() => {})) : setInternalOpen;

  // Auto-show popup when user is not logged in
  useEffect(() => {
    if (!user) {
      if (!isControlled) {
        const timer = setTimeout(() => {
          setInternalOpen(true);
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [user, isControlled]);

  // Load stored credentials
  useEffect(() => {
    const loadCredentials = async () => {
      try {
        const { value } = await Preferences.get({ key: 'user_credentials' });
        if (value) {
          const { email: storedEmail, password: storedPassword } = JSON.parse(value);
          if (storedEmail && !email) setEmail(storedEmail);
          if (storedPassword && !password) setPassword(storedPassword);
          console.log('✅ Stored credentials loaded');
        }
      } catch (e) {
        console.error('Failed to load credentials:', e);
      }
    };

    if (open) {
      loadCredentials();
    }
  }, [open]);

  const getAuthErrorMessage = (error: any): string => {
    if (!error) return 'Authentication failed';
    if (error.code === 'auth/invalid-email') return 'Invalid email address';
    if (error.code === 'auth/user-disabled') return 'This account has been disabled';
    if (error.code === 'auth/user-not-found') return 'No account found with this email';
    if (error.code === 'auth/wrong-password') return 'Incorrect password';
    if (error.code === 'auth/invalid-credential') return 'Invalid email or password';
    if (error.code === 'auth/weak-password') return 'Password must be at least 6 characters';
    if (error.code === 'auth/email-already-in-use') return 'An account with this email already exists';
    if (error.code === 'auth/too-many-requests') return 'Too many login attempts. Please try again later';
    return error.message || 'Authentication failed';
  };

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
      toast.error(error.message || 'Failed to fetch location');
      console.error('Location fetch error:', error);
    } finally {
      setLocationLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signIn(email, password, locationData || undefined);
      toast.success('Logged in successfully!');
      setOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error(error?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await signUp(email, password, locationData || undefined);
      toast.success('Account created successfully!');
      setOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error(getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setLocationData(null);
    setDisplayAddress('');
    setAuthStep('choice');
  };

  const handleOpenChange = (next: boolean) => {
    if (next) setOpen(true);
    else if (user) {
      setOpen(false);
      resetForm();
    }
  };

  const handleBack = () => {
    setAuthStep('choice');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFullName('');
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-full max-w-sm p-0 border-none rounded-3xl shadow-2xl" hideClose>
        <DialogHeader>
          <DialogTitle className="sr-only">Authentication</DialogTitle>
        </DialogHeader>
        {/* Choice Screen */}
        {authStep === 'choice' && (
          <div className="bg-gradient-to-b from-blue-900 via-blue-600 to-blue-300 rounded-3xl p-8 sm:p-10 text-white flex flex-col justify-center items-center min-h-96 gap-12 shadow-2xl" style={{backgroundImage: 'linear-gradient(180deg, #0033a0 0%, #1e5db8 40%, #5ba4e8 100%)'}}>
            <div className="text-center space-y-4 w-full">
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Skip the line</h1>
              <h2 className="text-3xl sm:text-4xl font-bold">Go online</h2>
              <div className="h-1 w-16 bg-white/40 mx-auto rounded-full"></div>
            </div>

            <div className="space-y-4 w-full">
              <Button
                onClick={() => setAuthStep('signin')}
                className="w-full bg-white text-blue-600 hover:bg-gray-100 font-semibold py-3 sm:py-4 text-base sm:text-lg rounded-full"
              >
                SIGN IN
              </Button>
              <Button
                onClick={() => setAuthStep('signup')}
                className="w-full bg-white text-blue-600 hover:bg-gray-100 font-semibold py-3 sm:py-4 text-base sm:text-lg rounded-full"
              >
                CREATE ACCOUNT
              </Button>
            </div>
          </div>
        )}

        {/* Sign In Screen */}
        {authStep === 'signin' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={handleBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ChevronLeft className="h-5 w-5 text-blue-600" />
              </button>
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-blue-600">Welcome Back</h2>
                <p className="text-sm text-gray-500">Sign in to your account</p>
              </div>
            </div>

            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-email" className="text-blue-600 font-medium">Email</Label>
                <Input
                  id="signin-email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signin-password" className="text-blue-600 font-medium">Password</Label>
                <Input
                  id="signin-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <button
                type="button"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Forgot password?
              </button>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-full text-base"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'SIGN IN'
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-200 text-center">
              <p className="text-sm text-gray-600">
                Don't have an account?{' '}
                <button
                  onClick={() => setAuthStep('signup')}
                  className="text-blue-600 font-semibold hover:text-blue-700"
                >
                  Sign up
                </button>
              </p>
            </div>
          </div>
        )}

        {/* Sign Up Screen */}
        {authStep === 'signup' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={handleBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ChevronLeft className="h-5 w-5 text-blue-600" />
              </button>
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-blue-600">Create Account</h2>
                <p className="text-sm text-gray-500">Join us to book appointments</p>
              </div>
            </div>

            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullname" className="text-blue-600 font-medium">Full Name</Label>
                <Input
                  id="fullname"
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-email" className="text-blue-600 font-medium">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-password" className="text-blue-600 font-medium">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-blue-600 font-medium">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-full text-base"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  'CREATE ACCOUNT'
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-200 text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <button
                  onClick={() => setAuthStep('signin')}
                  className="text-blue-600 font-semibold hover:text-blue-700"
                >
                  Sign in
                </button>
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
