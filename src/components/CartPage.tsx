import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ShoppingBag, Trash2, Plus, Minus, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

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
  };
}

export default function CartPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

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
    
    try {
      const { error } = await supabase
        .from('cart_items')
        .update({ quantity: newQuantity })
        .eq('id', itemId);

      if (error) throw error;
      
      setItems(items.map(item => 
        item.id === itemId ? { ...item, quantity: newQuantity } : item
      ));
    } catch (error) {
      console.error('Error updating quantity:', error);
      toast.error('Failed to update quantity');
    }
  };

  const removeItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
      
      const removedItem = items.find(i => i.id === itemId);
      setItems(items.filter(item => item.id !== itemId));
      toast.success('Item removed from cart');
      showNotification('Item Removed', `${removedItem?.product.title} has been removed from your cart.`);
    } catch (error) {
      console.error('Error removing item:', error);
      toast.error('Failed to remove item');
    }
  };

  const total = items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-500/30 border-t-cyan-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center gap-4 p-4 max-w-2xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-cyan-500" />
            My Cart ({items.length})
          </h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto pt-20 px-4">
        {items.length === 0 ? (
          <div className="text-center py-20">
            <div className="bg-cyan-100 dark:bg-cyan-900/30 h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShoppingBag className="h-10 w-10 text-cyan-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Your cart is empty</h2>
            <p className="text-slate-500 mb-8">Add some amazing products from the Bazar!</p>
            <Button 
              onClick={() => navigate('/')} 
              className="bg-cyan-500 hover:bg-cyan-600 rounded-xl"
            >
              Back to Bazar
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <Card key={item.id} className="p-4 border-0 shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
                <div className="flex gap-4">
                  <div className="h-24 w-24 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0">
                    <img 
                      src={item.product.image_url} 
                      alt={item.product.title} 
                      className="h-full w-full object-cover mix-blend-multiply" 
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 dark:text-white truncate">{item.product.title}</h3>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-lg font-black text-cyan-600">₹{item.product.price}</span>
                      {item.product.original_price && (
                        <span className="text-xs text-slate-400 line-through">₹{item.product.original_price}</span>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden h-8">
                        <button 
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="px-2 hover:bg-slate-50 text-slate-500"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="px-3 text-sm font-bold w-8 text-center">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="px-2 hover:bg-slate-50 text-slate-500"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      
                      <button 
                        onClick={() => removeItem(item.id)}
                        className="text-red-400 hover:text-red-500 p-1"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
            
            {/* Order Summary */}
            <Card className="p-5 border-0 shadow-lg bg-gradient-to-br from-cyan-600 to-blue-700 text-white mt-8 mb-32">
              <div className="flex justify-between items-center mb-4">
                <span className="opacity-80">Total Amount</span>
                <span className="text-3xl font-black">₹{total}</span>
              </div>
              <Button 
                className="w-full h-12 bg-white text-cyan-600 hover:bg-slate-100 font-bold rounded-xl flex items-center justify-center gap-2"
              >
                Checkout Now
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
