import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  Loader2, MapPin, Navigation, ShoppingBag, Store, 
  Minus, Plus, ChevronLeft, ArrowLeft, Info, CheckCircle2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { createOrder } from '@/lib/supabase-orders';
import { getProductById } from '@/lib/supabase-marketplace';
import { getShopByIdFromSupabase } from '@/lib/supabase-shops';
import { motion, AnimatePresence } from 'framer-motion';

const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function CheckoutPage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { profile } = useUserProfile();

  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [product, setProduct] = useState<any>(location.state?.product || null);
  const [shop, setShop] = useState<any>(location.state?.shop || null);
  
  const [quantity, setQuantity] = useState(1);
  const [isPickup, setIsPickup] = useState(false); // Default Home Delivery (No)
  const [customerLocation, setCustomerLocation] = useState<string>('');
  const [customerLat, setCustomerLat] = useState<number | null>(null);
  const [customerLng, setCustomerLng] = useState<number | null>(null);
  const [houseNo, setHouseNo] = useState('');
  const [landmark, setLandmark] = useState('');
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!productId) return;
      
      try {
        setDataLoading(true);
        let currentProduct = product;
        if (!currentProduct) {
          currentProduct = await getProductById(productId);
          setProduct(currentProduct);
        }

        if (currentProduct && !shop) {
          const shopData = await getShopByIdFromSupabase(currentProduct.shopId);
          setShop(shopData);
        }
      } catch (error) {
        console.error('Error loading checkout data:', error);
        toast.error('Failed to load product details');
      } finally {
        setDataLoading(false);
      }
    };

    fetchData();
  }, [productId]);

  const deliveryCharge = isPickup ? 0 : 30;
  const totalAmount = (product?.price || 0) * quantity + deliveryCharge;

  const handleGetLocation = () => {
    setIsFetchingLocation(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        setCustomerLat(latitude);
        setCustomerLng(longitude);
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await response.json();
          setCustomerLocation(data.display_name);
          toast.success("Location fetched successfully!");
        } catch (error) {
          setCustomerLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        }
        setIsFetchingLocation(false);
      }, (error) => {
        toast.error("Could not get location. Please enter manually.");
        setIsFetchingLocation(false);
      });
    }
  };

  const handleConfirmOrder = async () => {
    if (!user) {
      toast.error("Please login to place order");
      return;
    }
    if (!isPickup && !customerLocation) {
      toast.error("Please provide delivery location");
      return;
    }

    setLoading(true);
    try {
      const orderData = {
        shopId: shop?.id || product?.shopId,
        customerId: user.uid,
        customerName: profile?.name || user.displayName || 'Customer',
        customerPhone: profile?.phone || '',
        amount: totalAmount,
        description: `Order for ${product?.title} (Qty: ${quantity})${isPickup ? ' - Pickup from Shop' : ' - Home Delivery'}`,
        quantity: quantity,
        productName: product?.title,
        productImage: product?.imageUrl,
        address: isPickup ? 'PICKUP FROM SHOP' : customerLocation,
        customerLat: customerLat || undefined,
        customerLng: customerLng || undefined,
        deliveryType: isPickup ? 'pickup' : ('delivery' as const),
        houseNo: isPickup ? undefined : houseNo,
        landmark: isPickup ? undefined : landmark,
        totalAmount: totalAmount
      };

      const result = await createOrder(orderData);
      if (result) {
        toast.success("Order placed successfully!");
        navigate('/profile?tab=orders&expanded=true');
      }
    } catch (error) {
      toast.error("Failed to place order");
    } finally {
      setLoading(false);
    }
  };

  if (dataLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-red-600" />
          <p className="font-bold text-slate-500">Loading Checkout...</p>
        </div>
      </div>
    );
  }

  if (!product || !shop) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <Store className="h-16 w-16 text-slate-200 mb-4" />
        <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
        <p className="text-slate-500 mb-6">We couldn't find the product or shop details.</p>
        <Button onClick={() => navigate(-1)} className="bg-red-600">Go Back</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FB] pb-32">
      {/* Premium Header */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-4 py-4 flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)} 
          className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-900 active:scale-90 transition-transform"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-black tracking-tight text-slate-900 uppercase">Checkout</h1>
      </div>

      <div className="max-w-md mx-auto space-y-4 pt-4 px-4">
        {/* Product Hero Section */}
        <div className="bg-white rounded-[32px] overflow-hidden shadow-sm border border-slate-100">
          <div className="relative aspect-video w-full bg-slate-50">
            <img src={product.imageUrl} className="w-full h-full object-cover" alt={product.title} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-4 left-6 right-6">
              <h2 className="text-white text-xl font-black leading-tight mb-1">{product.title}</h2>
              <p className="text-white/80 text-sm font-bold">₹{product.price} per item</p>
            </div>
          </div>

          <div className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Quantity</span>
              <div className="flex items-center gap-4 bg-slate-50 p-1 rounded-2xl border border-slate-100">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-900"><Minus className="h-4 w-4" /></button>
                <span className="font-black text-lg w-6 text-center">{quantity}</span>
                <button onClick={() => setQuantity(quantity + 1)} className="w-10 h-10 rounded-xl bg-slate-900 shadow-sm flex items-center justify-center text-white"><Plus className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        </div>

        {/* Shop Section */}
        <div className="bg-white rounded-[32px] p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-4 mb-4">
            <div className="h-12 w-12 rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 shrink-0">
              <img src={shop.shopImageUrl || "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=100"} className="w-full h-full object-cover" alt={shop.name} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-black uppercase text-red-500 tracking-tighter">Ordering From</span>
              <h3 className="font-black text-sm text-slate-900 truncate leading-none mt-0.5">{shop.name}</h3>
              <p className="text-[10px] text-slate-400 font-bold truncate mt-1">{shop.location}</p>
            </div>
          </div>
        </div>

        {/* Pickup Toggle */}
        <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100 text-center">
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Will you pick up product from shop?</h4>
          <div className="flex p-1 bg-slate-50 rounded-2xl gap-1">
            <button 
              onClick={() => setIsPickup(true)} 
              className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${isPickup ? 'bg-white text-slate-900 shadow-md scale-[1.02]' : 'text-slate-400'}`}
            >
              YES, I'LL PICK
            </button>
            <button 
              onClick={() => setIsPickup(false)} 
              className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${!isPickup ? 'bg-orange-500 text-white shadow-lg shadow-orange-200 scale-[1.02]' : 'text-slate-400'}`}
            >
              NO, DELIVER AT HOME
            </button>
          </div>
        </div>

        {/* Address Fields (Conditional) */}
        {!isPickup && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100 space-y-4">
              <Button 
                onClick={handleGetLocation} 
                disabled={isFetchingLocation}
                className="w-full h-14 bg-green-500 hover:bg-green-600 text-white font-black rounded-2xl shadow-lg shadow-green-100 gap-2"
              >
                {isFetchingLocation ? <Loader2 className="h-5 w-5 animate-spin" /> : <Navigation className="h-5 w-5 fill-white" />}
                GET MY LOCATION
              </Button>
              
              <div className="space-y-2">
                <Input 
                  placeholder="Street Address / Area" 
                  value={customerLocation} 
                  onChange={e => setCustomerLocation(e.target.value)}
                  className="h-12 bg-slate-50 border-none rounded-2xl text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">House / Bldg No.</Label>
                  <Input value={houseNo} onChange={e => setHouseNo(e.target.value)} placeholder="e.g. 123" className="h-12 bg-slate-50 border-none rounded-2xl text-xs font-bold" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Landmark</Label>
                  <Input value={landmark} onChange={e => setLandmark(e.target.value)} placeholder="e.g. Near Park" className="h-12 bg-slate-50 border-none rounded-2xl text-xs font-bold" />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Bill Summary */}
        <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Payment Summary</h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 font-bold">Item Total ({quantity}x)</span>
              <span className="font-black">₹{product.price * quantity}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 font-bold">Delivery Fee</span>
              <span className={deliveryCharge === 0 ? "text-green-600 font-black" : "font-black"}>
                {deliveryCharge === 0 ? "FREE" : `₹${deliveryCharge}`}
              </span>
            </div>
            <div className="h-px bg-slate-50 my-2" />
            <div className="flex justify-between items-center">
              <span className="text-slate-900 font-black">Total Amount</span>
              <span className="text-xl font-black text-red-600">₹{totalAmount}</span>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3 p-3 bg-blue-50 rounded-2xl border border-blue-100">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shrink-0">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black text-blue-400 uppercase leading-none">Payment Method</p>
              <p className="text-xs font-black text-blue-900">Cash on Delivery (COD)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-xl border-t border-slate-100 z-50">
        <div className="max-w-md mx-auto flex gap-3">
          <Button 
            variant="ghost" 
            onClick={() => navigate(-1)}
            className="flex-1 h-14 rounded-2xl font-black text-xs text-slate-400 uppercase"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmOrder} 
            disabled={loading || isFetchingLocation}
            className="flex-[2] h-14 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-black text-sm shadow-lg shadow-orange-200 active:scale-95 transition-all"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'CONFIRM ORDER'}
          </Button>
        </div>
      </div>
    </div>
  );
}
