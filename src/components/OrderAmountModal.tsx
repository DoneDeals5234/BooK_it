import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, AlertCircle, MapPin, Plus, Minus, CheckCircle, Navigation, ShoppingBag, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { createOrder } from '@/lib/supabase-orders';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { fetchUserLocation } from '@/lib/geolocation';

// Helper: extract lat/lng from a Google Maps URL
const extractCoordsFromMapLink = (link: string): { lat: number; lng: number } | null => {
  if (!link) return null;
  try {
    // Match ?q=lat,lng or @lat,lng
    const qMatch = link.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (qMatch) return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
    const atMatch = link.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
    return null;
  } catch {
    return null;
  }
};

interface OrderAmountModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopId: string;
  shopName?: string;
  initialAmount?: number;
  productName?: string;
  productImage?: string;
  productPrice?: number;
  shopLat?: number;
  shopLng?: number;
  shopMapLink?: string;
}

export const OrderAmountModal = ({
  isOpen,
  onClose,
  shopId,
  shopName = 'Shop',
  productName = 'Product',
  productImage,
  productPrice = 0,
  shopLat,
  shopLng,
  shopMapLink,
}: OrderAmountModalProps) => {
  const { user, userRole } = useAuth();
  const { profile } = useUserProfile();
  const [quantity, setQuantity] = useState(1);
  const [deliveryType, setDeliveryType] = useState<'pickup' | 'delivery'>('pickup');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [locationLink, setLocationLink] = useState<string | null>(null);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [deliveryCost, setDeliveryCost] = useState(0);
  const [customerCoords, setCustomerCoords] = useState<{lat: number, lng: number} | null>(null);

  // Haversine distance formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  useEffect(() => {
    // Resolve effective shop coords: use direct lat/lng or parse from map link
    const effectiveShopLat = shopLat || (shopMapLink ? extractCoordsFromMapLink(shopMapLink)?.lat : undefined);
    const effectiveShopLng = shopLng || (shopMapLink ? extractCoordsFromMapLink(shopMapLink)?.lng : undefined);

    console.log('Distance calculation triggered:', { deliveryType, customerCoords, shopLat, shopLng, shopMapLink, effectiveShopLat, effectiveShopLng });
    if (deliveryType === 'delivery' && customerCoords && effectiveShopLat && effectiveShopLng) {
      const dist = calculateDistance(effectiveShopLat, effectiveShopLng, customerCoords.lat, customerCoords.lng);
      console.log('Calculated distance:', dist);
      setDistance(dist);
      
      // Delivery cost: 0-2km=₹30, each extra 2km+₹20
      let cost = 30;
      if (dist > 2) {
        cost += Math.ceil((dist - 2) / 2) * 20;
      }
      console.log('Calculated cost:', cost);
      setDeliveryCost(cost);
    } else {
      console.log('Missing conditions — shopLat:', shopLat, 'shopLng:', shopLng, 'customerCoords:', customerCoords, 'deliveryType:', deliveryType);
      setDistance(null);
      setDeliveryCost(0);
    }
  }, [deliveryType, customerCoords, shopLat, shopLng, shopMapLink]);

  const totalAmount = (productPrice * quantity) + (deliveryType === 'delivery' ? deliveryCost : 0);



  // Pre-fill address from profile when delivery is selected
  useEffect(() => {
    if (isOpen && deliveryType === 'delivery' && profile) {
      if (!address && profile.address) {
        setAddress(profile.address);
      }
      if (!locationLink && profile.google_map_link) {
        setLocationLink(profile.google_map_link);
      }
      // Try to set customer coords from profile lat/lng, OR parse them from map link
      if (!customerCoords) {
        if (profile.latitude && profile.longitude) {
          console.log('Setting customerCoords from profile lat/lng:', profile.latitude, profile.longitude);
          setCustomerCoords({ lat: profile.latitude, lng: profile.longitude });
        } else if (profile.google_map_link) {
          const parsed = extractCoordsFromMapLink(profile.google_map_link);
          if (parsed) {
            console.log('Setting customerCoords parsed from map link:', parsed);
            setCustomerCoords(parsed);
          } else {
            console.warn('Could not parse coords from map link:', profile.google_map_link);
          }
        }
      }
    }
  }, [isOpen, deliveryType, profile]);

  const fetchLocation = useCallback(async () => {
    setIsFetchingLocation(true);
    try {
      const location = await fetchUserLocation();
      const link = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
      setLocationLink(link);
      setCustomerCoords({ lat: location.latitude, lng: location.longitude });
      if (location.formattedAddress && !address) {
        setAddress(location.formattedAddress);
      }
      toast.success('Location attached to order! 📍');
    } catch (error: any) {
      console.warn('Location error:', error);
      toast.error(error.message || 'Could not get precise location. Please check your GPS.');
    } finally {
      setIsFetchingLocation(false);
    }
  }, [address]);

  const fetchProfileLocation = useCallback(() => {
    if (profile) {
      let found = false;
      if (profile.address) {
        setAddress(profile.address);
        found = true;
      }
      if (profile.google_map_link) {
        setLocationLink(profile.google_map_link);
        const parsed = extractCoordsFromMapLink(profile.google_map_link);
        if (parsed) {
          setCustomerCoords(parsed);
        }
        found = true;
      } else if (profile.latitude && profile.longitude) {
        const link = `https://www.google.com/maps?q=${profile.latitude},${profile.longitude}`;
        setLocationLink(link);
        setCustomerCoords({ lat: profile.latitude, lng: profile.longitude });
        found = true;
      }

      if (found) {
        toast.success('Location fetched from profile! 👤');
      } else {
        toast.error('No address or location found in your profile.');
      }
    } else {
      toast.error('Profile details not loaded yet.');
    }
  }, [profile]);

  const handleClose = () => {
    setQuantity(1);
    setAddress('');
    setDescription('');
    setError('');
    setLocationLink(null);
    setDeliveryType('pickup');
    onClose();
  };

  const handleSubmit = async () => {
    if (deliveryType === 'delivery' && (!address || address.length < 5)) {
      setError('Please enter a valid delivery address');
      return;
    }

    if (!user) {
      setError('Please log in to place an order');
      return;
    }

    if (userRole === 'owner') {
      setError('Shop owners cannot place orders');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await createOrder(
        shopId,
        user.uid,
        user.displayName || profile?.name || 'Guest Customer',
        profile?.phone || 'Not provided',
        totalAmount,
        description || undefined,
        quantity,
        deliveryType === 'delivery' ? address : 'PICKUP FROM SHOP',
        locationLink || undefined,
        productName,
        productImage,
        productPrice,
        deliveryType,
        deliveryCost,
        totalAmount,
        distance || 0,
        customerCoords?.lat,
        customerCoords?.lng,
        shopLat,
        shopLng
      );

      toast.success('Order completed successfully! 🎉');
      handleClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md max-h-[95vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="border-b px-6 py-4 bg-white sticky top-0 z-10">
          <DialogTitle className="text-xl">Complete Your Order</DialogTitle>
          <DialogDescription>
            You are ordering from <strong>{shopName}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5 custom-scrollbar">
          {/* Product and Shop Info Boxes */}
          <div className="grid grid-cols-1 gap-3">
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
              <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Product</p>
              <p className="text-lg font-black text-slate-900 dark:text-white leading-none">{productName}</p>
            </div>
            
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Shop Name</p>
              <p className="text-lg font-bold text-slate-800 dark:text-slate-200 leading-none">{shopName}</p>
            </div>
          </div>

          {/* Quantity Selector - Enhanced */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">No. of Products</Label>
              <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">
                ₹{productPrice} per item
              </span>
            </div>
            <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-100 dark:border-slate-800 shadow-sm">
              <div className="flex flex-col">
                <span className="text-2xl font-black text-slate-900 dark:text-white leading-tight">{quantity}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Selected Quantity</span>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 rounded-xl border-slate-200 hover:bg-slate-50 active:scale-95 transition-all"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  <Minus className="h-5 w-5 text-slate-600" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 rounded-xl border-slate-900 bg-slate-900 text-white hover:bg-slate-800 active:scale-95 transition-all dark:border-white dark:bg-white dark:text-black"
                  onClick={() => setQuantity(Math.min(10, quantity + 1))}
                  disabled={quantity >= 10}
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Delivery Type Selection */}
          <div className="space-y-3">
            <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest text-center block mb-2">How would you like to receive your order?</Label>
            <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeliveryType('pickup')}
                className={`flex flex-col items-center justify-center gap-2 py-4 rounded-xl transition-all duration-300 ${
                  deliveryType === 'pickup' 
                    ? 'bg-white dark:bg-slate-800 shadow-sm shadow-slate-200 dark:shadow-black/40 scale-100 border border-slate-200 dark:border-slate-700' 
                    : 'bg-transparent text-slate-500 opacity-60 hover:opacity-100'
                }`}
              >
                <div className={`p-2 rounded-lg ${deliveryType === 'pickup' ? 'bg-orange-100 text-orange-600' : 'bg-slate-200 text-slate-400'}`}>
                  <ShoppingBag className="h-5 w-5" />
                </div>
                <span className={`text-xs font-black uppercase tracking-tight ${deliveryType === 'pickup' ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>Pick from Shop</span>
              </button>

              <button
                type="button"
                onClick={() => setDeliveryType('delivery')}
                className={`flex flex-col items-center justify-center gap-2 py-4 rounded-xl transition-all duration-300 ${
                  deliveryType === 'delivery' 
                    ? 'bg-white dark:bg-slate-800 shadow-sm shadow-slate-200 dark:shadow-black/40 scale-100 border border-slate-200 dark:border-slate-700' 
                    : 'bg-transparent text-slate-500 opacity-60 hover:opacity-100'
                }`}
              >
                <div className={`p-2 rounded-lg ${deliveryType === 'delivery' ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-400'}`}>
                  <Navigation className="h-5 w-5" />
                </div>
                <span className={`text-xs font-black uppercase tracking-tight ${deliveryType === 'delivery' ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>Home Delivery</span>
              </button>
            </div>
          </div>

          {/* Delivery Address */}
          {deliveryType === 'delivery' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="address" className="text-xs font-bold text-slate-500 uppercase tracking-widest">Delivery Address</Label>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-blue-600 h-auto p-0 hover:bg-transparent text-[11px] font-bold"
                  onClick={fetchProfileLocation}
                >
                  <User className="h-3 w-3 mr-1" />
                  USE PROFILE
                </Button>
                <div className="w-px h-3 bg-slate-200" />
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-blue-600 h-auto p-0 hover:bg-transparent text-[11px] font-bold"
                  onClick={fetchLocation}
                  disabled={isFetchingLocation || !!locationLink}
                >
                  {isFetchingLocation ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : locationLink ? (
                    <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                  ) : (
                    <MapPin className="h-3 w-3 mr-1" />
                  )}
                  {isFetchingLocation ? 'FETCHING...' : locationLink ? 'GPS ATTACHED' : 'USE AUTO GPS'}
                </Button>
              </div>
            </div>
            <Textarea
              id="address"
              placeholder="Enter your full home address for delivery..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="min-h-[100px] rounded-2xl border-slate-200 focus:ring-orange-500 focus:border-orange-500 resize-none bg-slate-50/50"
            />
            </div>
          )}

          {/* Optional Notes */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-xs font-bold text-slate-500 uppercase tracking-widest">Order Notes (Optional)</Label>
            <Input
              id="description"
              placeholder="Add any special requests or notes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-xl border-slate-200 bg-slate-50/50 h-11"
            />
          </div>

          {/* Total Calculation Bar */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-black p-5 rounded-2xl text-white shadow-xl space-y-4">
            <div className="space-y-2 border-b border-white/10 pb-3">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Product Price ({quantity}x)</span>
                <span>₹{productPrice * quantity}</span>
              </div>
              {deliveryType === 'delivery' && (
                <>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Delivery Fee ({distance?.toFixed(1)} km)</span>
                    <span>₹{deliveryCost}</span>
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Total Order Amount</p>
                <p className="text-4xl font-black tracking-tighter">₹{totalAmount}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm">
                <ShoppingBag className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>

          {error && (
            <div className="flex gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-6 border-t bg-gray-50/50 flex gap-4">
          <Button variant="outline" onClick={handleClose} disabled={loading} className="flex-1 h-12 rounded-xl">
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || isFetchingLocation}
            className="flex-1 h-12 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Navigation className="h-4 w-4 mr-2" />
                Confirm Order
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
