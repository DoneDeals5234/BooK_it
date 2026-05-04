import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, 
  ShoppingBag, 
  Trash2, 
  Plus, 
  Minus, 
  ArrowRight, 
  Lock, 
  ShieldCheck, 
  Truck, 
  Tag, 
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { motion, AnimatePresence } from 'framer-motion';

interface CartItem {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  product: {
    id: string;
    title: string;
    price: number;
    image_url: string;
    original_price?: number;
    shop_id?: string;
  };
}

export default function CartPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const showNotification = async (title: string, body: string) => {
    if (Capacitor.isNativePlatform()) {
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: Math.floor(Math.random() * 1000000),
              title,
              body,
              schedule: { at: new Date(Date.now() + 500) },
              sound: 'default',
            }
          ]
        });
      } catch (e) {
        console.error('Error showing notification:', e);
      }
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }

    const loadCart = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('cart_items')
          .select('*, product:featured_products(*)')
          .eq('user_id', user.uid);

        if (error) throw error;
        setItems(data || []);
      } catch (error) {
        console.error('Error loading cart:', error);
        toast.error('Failed to load cart items');
      } finally {
        setLoading(false);
      }
    };

    loadCart();
  }, [user, navigate]);

  const updateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    
    // Optimistic update
    const previousItems = [...items];
    setItems(items.map(item => 
      item.id === itemId ? { ...item, quantity: newQuantity } : item
    ));

    try {
      const { error } = await supabase
        .from('cart_items')
        .update({ quantity: newQuantity })
        .eq('id', itemId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating quantity:', error);
      setItems(previousItems);
      toast.error('Failed to update quantity');
    }
  };

  const removeItem = async (itemId: string) => {
    setIsDeleting(itemId);
    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
      
      const removedItem = items.find(i => i.id === itemId);
      setItems(items.filter(item => item.id !== itemId));
      toast.success('Removed from cart');
      showNotification('Item Removed', `${removedItem?.product.title} has been removed.`);
    } catch (error) {
      console.error('Error removing item:', error);
      toast.error('Failed to remove item');
    } finally {
      setIsDeleting(null);
    }
  };

  // Calculations
  const subtotal = items.reduce((sum, item) => {
    const price = item.product?.original_price || item.product?.price || 0;
    return sum + (price * item.quantity);
  }, 0);

  const total = items.reduce((sum, item) => {
    const price = item.product?.price || 0;
    return sum + (price * item.quantity);
  }, 0);

  const discount = subtotal - total;
  const deliveryFee = total > 0 && total < 500 ? 40 : 0;
  const finalAmount = total + deliveryFee;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-4">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="h-12 w-12 rounded-full border-4 border-red-500/20 border-t-red-600"
        />
        <p className="text-slate-500 font-medium animate-pulse">Loading your cart...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-slate-950 pb-40">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50">
        <div className="flex items-center justify-between p-4 max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate(-1)} 
              className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <div>
              <h1 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                My Cart
                <span className="h-5 w-5 bg-red-100 dark:bg-red-900/30 text-red-600 text-[10px] rounded-full flex items-center justify-center font-black">
                  {items.length}
                </span>
              </h1>
              {items.length > 0 && (
                <p className="text-[10px] text-green-600 font-bold uppercase tracking-wider">
                  You are saving ₹{discount} today!
                </p>
              )}
            </div>
          </div>
          <ShoppingBag className="h-5 w-5 text-red-600 opacity-20" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto pt-24 px-4">
        <AnimatePresence mode="popLayout">
          {items.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-20 px-6"
            >
              <div className="relative h-32 w-32 mx-auto mb-8">
                <div className="absolute inset-0 bg-red-100 dark:bg-red-900/20 rounded-full animate-ping opacity-20" />
                <div className="relative bg-white dark:bg-slate-900 h-32 w-32 rounded-full shadow-2xl flex items-center justify-center border border-slate-100 dark:border-slate-800">
                  <ShoppingBag className="h-16 w-16 text-red-500" />
                </div>
              </div>
              <h2 className="text-2xl font-black mb-3 text-slate-900 dark:text-white">Your cart is empty</h2>
              <p className="text-slate-500 mb-10 max-w-xs mx-auto leading-relaxed">
                Looks like you haven't added anything to your cart yet. Explore the Bazar for amazing deals!
              </p>
              <Button 
                onClick={() => navigate('/')} 
                className="bg-red-600 hover:bg-red-700 text-white px-8 h-14 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-red-200 dark:shadow-none transition-all active:scale-95"
              >
                Start Shopping
              </Button>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {/* Delivery Estimation Card */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-2xl border border-blue-100 dark:border-blue-900/30 flex items-center gap-3 mb-6"
              >
                <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                  <Truck className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Fast Delivery</p>
                  <p className="text-xs font-black text-blue-900 dark:text-blue-100">Estimated delivery by Tomorrow</p>
                </div>
              </motion.div>

              {items.filter(item => item.product).map((item) => {
                const itemDiscount = (item.product.original_price || 0) > item.product.price 
                  ? Math.round(((item.product.original_price! - item.product.price) / item.product.original_price!) * 100) 
                  : 0;
                const savings = (item.product.original_price || item.product.price) - item.product.price;

                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9, x: -20 }}
                    transition={{ type: "spring", damping: 20, stiffness: 300 }}
                  >
                    <Card className="group relative p-4 border-0 shadow-sm hover:shadow-md bg-white dark:bg-slate-900 overflow-hidden transition-all duration-300 rounded-2xl">
                      <div className="flex gap-4">
                        {/* Image Section */}
                        <div className="relative h-24 w-24 sm:h-28 sm:w-28 rounded-2xl bg-slate-50 dark:bg-slate-800 overflow-hidden flex-shrink-0 border border-slate-100 dark:border-slate-800">
                          <img 
                            src={item.product.image_url} 
                            alt={item.product.title} 
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" 
                          />
                          {itemDiscount > 0 && (
                            <div className="absolute top-1 left-1 bg-green-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-lg shadow-sm">
                              {itemDiscount}% OFF
                            </div>
                          )}
                        </div>

                        {/* Content Section */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                          <div>
                            <div className="flex justify-between items-start gap-2">
                              <h3 className="font-bold text-slate-900 dark:text-white leading-tight line-clamp-2 text-sm sm:text-base">
                                {item.product.title}
                              </h3>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => removeItem(item.id)}
                                className="h-8 w-8 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 flex-shrink-0"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-lg font-black text-red-600">₹{item.product.price}</span>
                              {item.product.original_price && (
                                <span className="text-xs text-slate-400 line-through">₹{item.product.original_price}</span>
                              )}
                              {savings > 0 && (
                                <span className="text-[10px] font-bold text-green-600 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded-md">
                                  Save ₹{savings * item.quantity}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between mt-3">
                            {/* Quantity Stepper */}
                            <div className="flex items-center bg-slate-50 dark:bg-slate-800 rounded-xl p-1 border border-slate-100 dark:border-slate-700/50">
                              <motion.button 
                                whileTap={{ scale: 0.8 }}
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-500 transition-colors"
                              >
                                <Minus className="h-3 w-3" />
                              </motion.button>
                              <span className="px-3 text-sm font-black w-8 text-center text-slate-900 dark:text-white">
                                {item.quantity}
                              </span>
                              <motion.button 
                                whileTap={{ scale: 0.8 }}
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-500 transition-colors"
                              >
                                <Plus className="h-3 w-3" />
                              </motion.button>
                            </div>

                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-orange-600">
                              <AlertCircle className="h-3 w-3" />
                              Only 3 left
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}

              {/* Coupon Section */}
              <Card className="p-4 border-dashed border-2 border-slate-200 dark:border-slate-800 bg-transparent rounded-2xl flex items-center justify-between group cursor-pointer hover:border-red-200 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center shadow-sm">
                    <Tag className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900 dark:text-white">Apply Coupon Code</p>
                    <p className="text-[10px] text-slate-500 font-medium">Save up to 50% extra</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-red-500 transition-colors" />
              </Card>

              {/* Bill Details Section */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 mt-8 mb-8">
                <h4 className="font-black text-slate-900 dark:text-white mb-4 uppercase tracking-widest text-[10px]">Bill Details</h4>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Item Total</span>
                    <span className="font-bold text-slate-900 dark:text-white">₹{subtotal}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Product Discount</span>
                    <span className="font-bold text-green-600">- ₹{discount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Delivery Fee</span>
                    <div className="flex items-center gap-2">
                      {deliveryFee === 0 ? (
                        <span className="font-black text-green-600 uppercase text-[10px] bg-green-50 px-2 py-0.5 rounded-full">FREE</span>
                      ) : (
                        <span className="font-bold text-slate-900 dark:text-white">₹{deliveryFee}</span>
                      )}
                    </div>
                  </div>
                  <div className="h-px bg-slate-100 dark:bg-slate-800 my-2" />
                  <div className="flex justify-between items-center pt-2">
                    <span className="font-black text-slate-900 dark:text-white text-base">To Pay</span>
                    <span className="font-black text-red-600 text-2xl tracking-tighter">₹{finalAmount}</span>
                  </div>
                </div>
              </div>

              {/* Trust Signals */}
              <div className="flex justify-center gap-6 py-4 opacity-50">
                <div className="flex flex-col items-center gap-1">
                  <ShieldCheck className="h-5 w-5 text-slate-400" />
                  <span className="text-[8px] font-bold uppercase tracking-widest text-slate-500">100% Secure</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <ShieldCheck className="h-5 w-5 text-slate-400" />
                  <span className="text-[8px] font-bold uppercase tracking-widest text-slate-500">Easy Returns</span>
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Sticky Bottom Action Bar */}
      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 pb-8 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border-t border-slate-200/50 dark:border-slate-800/50 z-50">
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="flex items-center justify-between px-2">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Pay</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">₹{finalAmount}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-green-600 uppercase tracking-widest bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-lg">You Save ₹{discount}</p>
              </div>
            </div>
            
            <motion.div whileTap={{ scale: 0.98 }}>
              <Button 
                className="w-full h-14 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-black rounded-2xl shadow-xl shadow-red-200 dark:shadow-none flex items-center justify-center gap-3 text-base group"
              >
                <Lock className="h-5 w-5 opacity-50 group-hover:opacity-100 transition-opacity" />
                CHECKOUT NOW
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </motion.div>

            <div className="flex items-center justify-center gap-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              <ShieldCheck className="h-3 w-3" />
              Secure Checkout • Book It Trusted
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
