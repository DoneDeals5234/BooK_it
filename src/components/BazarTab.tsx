import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  ShoppingCart, 
  Heart, 
  Plus, 
  Minus, 
  Clock, 
  Star,
  Zap,
  ArrowRight,
  PackageSearch,
  MapPin,
  ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getAllActiveProducts, getCartItems, updateCartQuantity } from '@/lib/supabase-marketplace';
import { getShopByIdFromSupabase } from '@/lib/supabase-shops';
import { FeaturedProduct, Shop } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

// Categories with STABLE images
const CATEGORIES = [
  { id: 'dairy', name: 'Dairy & Eggs', image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&q=80&w=150' },
  { id: 'snacks', name: 'Snacks', image: 'https://images.unsplash.com/photo-1599490659213-e2b9527bb087?auto=format&fit=crop&q=80&w=150' },
  { id: 'beverages', name: 'Drinks', image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=150' },
  { id: 'instant', name: 'Instant Food', image: 'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?auto=format&fit=crop&q=80&w=150' },
  { id: 'grocery', name: 'Grocery', image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&q=80&w=150' },
  { id: 'household', name: 'Household', image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=150' },
  { id: 'personal', name: 'Personal Care', image: 'https://images.unsplash.com/photo-1556229167-93049176461f?auto=format&fit=crop&q=80&w=150' },
];

const getProductCategory = (title: string): string => {
  const t = title.toLowerCase();
  if (t.includes('milk') || t.includes('curd') || t.includes('butter') || t.includes('paneer') || t.includes('cheese') || t.includes('bread') || t.includes('pav')) return 'dairy';
  if (t.includes('lays') || t.includes('kurkure') || t.includes('bingo') || t.includes('doritos') || t.includes('bhujia') || t.includes('chips') || t.includes('biscuit') || t.includes('oreo')) return 'snacks';
  if (t.includes('cola') || t.includes('pepsi') || t.includes('sprite') || t.includes('thums') || t.includes('fanta') || t.includes('maaza') || t.includes('juice') || t.includes('water') || t.includes('sting')) return 'beverages';
  if (t.includes('maggi') || t.includes('yippee') || t.includes('noodles') || t.includes('pasta') || t.includes('cake')) return 'instant';
  if (t.includes('rice') || t.includes('atta') || t.includes('dal') || t.includes('oil') || t.includes('sugar') || t.includes('salt') || t.includes('masala')) return 'grocery';
  if (t.includes('soap') || t.includes('shampoo') || t.includes('toothpaste') || t.includes('detergent') || t.includes('surf') || t.includes('tide') || t.includes('dishwash')) return 'household';
  return 'snacks';
};

interface BazarTabProps {
  setCurrentTab?: (tab: string) => void;
  onShowLogin?: () => void;
}

const ProductSkeleton = () => (
  <div className="bg-white rounded-2xl p-3 border border-slate-100 space-y-3">
    <div className="aspect-square w-full bg-slate-100 animate-pulse rounded-xl" />
    <div className="h-4 w-3/4 bg-slate-100 animate-pulse rounded" />
    <div className="h-4 w-1/2 bg-slate-100 animate-pulse rounded" />
    <div className="flex justify-between items-center pt-2">
      <div className="h-6 w-1/3 bg-slate-100 animate-pulse rounded" />
      <div className="h-8 w-1/3 bg-slate-100 animate-pulse rounded-lg" />
    </div>
  </div>
);

export default function BazarTab({ onShowLogin }: BazarTabProps) {
  const [products, setProducts] = useState<FeaturedProduct[]>([]);
  const [shops, setShops] = useState<Record<string, Shop>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { user } = useAuth();
  const [cartQuantities, setCartQuantities] = useState<Record<string, number>>({});
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    const loadProducts = async () => {
      setLoading(true);
      try {
        const data = await getAllActiveProducts();
        setProducts(data);

        const shopIds = Array.from(new Set(data.map(p => p.shopId)));
        const shopData: Record<string, Shop> = {};
        for (const id of shopIds) {
          const shop = await getShopByIdFromSupabase(id);
          if (shop) shopData[id] = shop;
        }
        setShops(shopData);
        
        if (user) {
          const cartItems = await getCartItems(user.uid);
          const quantities: Record<string, number> = {};
          cartItems.forEach(item => {
            quantities[item.productId] = item.quantity;
          });
          setCartQuantities(quantities);
        }
      } catch (error) {
        console.error('Error loading bazar products:', error);
      } finally {
        setLoading(false);
      }
    };
    loadProducts();
  }, [user]);

  const handleUpdateQuantity = async (productId: string, delta: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!user) {
      if (onShowLogin) onShowLogin();
      return;
    }

    const currentQty = cartQuantities[productId] || 0;
    const newQty = Math.max(0, currentQty + delta);

    setCartQuantities(prev => ({ ...prev, [productId]: newQty }));

    try {
      const success = await updateCartQuantity(user.uid, productId, newQty);
      if (!success) {
        setCartQuantities(prev => ({ ...prev, [productId]: currentQty }));
        toast.error('Failed to update cart');
      } else if (newQty > currentQty && currentQty === 0) {
        toast.success('Added to cart! 🛒');
      }
    } catch (error) {
      setCartQuantities(prev => ({ ...prev, [productId]: currentQty }));
      toast.error('Something went wrong');
    }
  };

  const handleOrderNow = (productId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      if (onShowLogin) onShowLogin();
      return;
    }
    navigate(`/product/${productId}`);
  };

  const filteredProducts = useMemo(() => {
    let filtered = products;
    if (searchQuery) {
      filtered = filtered.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    if (activeCategory) {
      filtered = filtered.filter(p => (p.category || getProductCategory(p.title)) === activeCategory);
    }
    return filtered;
  }, [products, searchQuery, activeCategory]);

  const sections = [
    { title: 'Popular Near You', icon: <Star className="h-4 w-4 text-amber-500 fill-amber-500" /> },
    { title: 'New Arrivals', icon: <Zap className="h-4 w-4 text-primary fill-primary" /> }
  ];

  const cartItemCount = useMemo(() => 
    Object.values(cartQuantities).filter(q => q > 0).length
  , [cartQuantities]);

  return (
    <div className="min-h-screen bg-[#F8F9FB] pb-24">
      {/* Search Header - Cart moved next to search */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100 shadow-sm">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors shrink-0"
            >
              <ArrowLeft className="h-5 w-5 text-slate-600" />
            </button>
            <div className="relative flex-1 group">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-400 group-focus-within:text-primary transition-colors" />
              </div>
              <Input 
                className="pl-10 pr-4 h-11 bg-slate-50 border-none rounded-2xl text-sm focus-visible:ring-2 focus-visible:ring-primary/20 transition-all shadow-inner"
                placeholder="Search for atta, chips, cold drinks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <button 
              onClick={() => navigate('/cart')}
              className="relative flex items-center justify-center w-11 h-11 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors shrink-0"
            >
              <ShoppingCart className="h-5 w-5 text-slate-700" />
              {cartItemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                  {cartItemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 pt-4 space-y-6">
        {/* Shop by Category */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tighter">Shop by Category</h3>
            <button className="text-xs font-bold text-primary flex items-center gap-1">See All <ArrowRight className="h-3 w-3" /></button>
          </div>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 snap-x">
            {CATEGORIES.map((cat) => (
              <button 
                key={cat.id} 
                onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                className={`flex flex-col items-center gap-2 snap-start shrink-0 min-w-[70px] transition-all ${activeCategory === cat.id ? 'scale-105' : 'opacity-80 hover:opacity-100'}`}
              >
                <div className={`h-16 w-16 rounded-[22px] shadow-sm border-2 overflow-hidden flex items-center justify-center p-0 ${activeCategory === cat.id ? 'border-primary' : 'border-white'}`}>
                  <img src={cat.image} className="w-full h-full object-cover" alt={cat.name} onError={(e) => (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=Category'} />
                </div>
                <span className={`text-[9px] font-black uppercase tracking-tighter text-center ${activeCategory === cat.id ? 'text-primary font-black' : 'text-slate-600'}`}>
                  {cat.name.split(' ')[0]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Hero Banner */}
        {!activeCategory && !searchQuery && (
          <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-yellow-300 via-yellow-400 to-amber-500 p-6 shadow-xl shadow-yellow-100">
            <div className="relative z-10 space-y-2">
              <Badge className="bg-black text-white text-[9px] border-none font-black px-2">LOCAL SHOP DELIVERY</Badge>
              <h2 className="text-2xl font-black text-black leading-tight tracking-tighter">
                Quick Delivery from <br/> Local Stores <span className="inline-block animate-pulse">🛵</span>
              </h2>
              <p className="text-black/70 text-[10px] font-bold">Groceries, Snacks & more at your doorstep.</p>
            </div>
            <div className="absolute right-[-20px] bottom-[-20px] w-40 h-40 bg-white/20 rounded-full blur-3xl" />
            <div className="absolute right-4 bottom-4 w-24 h-24 rotate-12 opacity-90 drop-shadow-2xl">
              <img src="https://www.bigbasket.com/media/uploads/p/l/102570_12-lays-potato-chips-classic-salted.jpg" alt="Snack" className="w-full h-full object-contain" />
            </div>
          </div>
        )}

        {/* Product Grid / Sections */}
        <div className="space-y-8">
          {loading ? (
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => <ProductSkeleton key={i} />)}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-4 bg-white rounded-[32px] border border-slate-100 shadow-sm">
              <div className="p-4 bg-slate-50 rounded-full">
                <PackageSearch className="h-12 w-12 text-slate-300" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tighter">No Products Found</h3>
                <p className="text-xs text-slate-500 font-medium max-w-[200px] mx-auto">Abhi iss category mein koi product available nahi hai.</p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => { setActiveCategory(null); setSearchQuery(''); }}
                className="rounded-xl border-slate-200 text-slate-600 font-bold text-[11px]"
              >
                Clear Filters
              </Button>
            </div>
          ) : (
            <>
              {(activeCategory || searchQuery ? [{ title: 'Search Results', icon: <Search className="h-4 w-4 text-primary" /> }] : sections).map((section, idx) => {
                const sectionProducts = (activeCategory || searchQuery) ? filteredProducts : (idx === 0 ? filteredProducts.slice(0, 4) : filteredProducts.slice(4));
                if (sectionProducts.length === 0) return null;
                
                return (
                  <div key={idx} className="space-y-4">
                    <div className="flex items-center gap-2">
                      {section.icon}
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-tighter">{section.title}</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {sectionProducts.map((product) => {
                        const qty = cartQuantities[product.id] || 0;
                        const discount = product.originalPrice ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100) : 0;
                        const shop = shops[product.shopId];
                        
                        return (
                          <motion.div 
                            whileHover={{ y: -4 }}
                            whileTap={{ scale: 0.98 }}
                            layout
                            key={product.id}
                            className="bg-white rounded-[24px] overflow-hidden border border-slate-100 shadow-sm hover:shadow-md transition-all group flex flex-col cursor-pointer"
                            onClick={() => navigate(`/product/${product.id}`)}
                          >
                            <div className="relative aspect-square p-4 bg-slate-50/30">
                              <img
                                src={product.imageUrl}
                                alt={product.title}
                                className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
                                onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1506484381205-f7945653044d?w=400'; }}
                              />
                              {discount > 0 && (
                                <div className="absolute top-2 left-2 bg-[#0C831F] text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-sm uppercase">
                                  {discount}% OFF
                                </div>
                              )}
                              {shop && (
                                <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded-full border border-slate-100 flex items-center gap-1 shadow-sm">
                                  <MapPin className="h-2 w-2 text-primary" />
                                  <span className="text-[7px] font-black text-slate-600 truncate max-w-[50px] uppercase">{shop.name}</span>
                                </div>
                              )}
                              <button className="absolute top-2 right-2 p-1.5 bg-white/80 backdrop-blur rounded-full opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                <Heart className="h-3 w-3 text-slate-400 hover:text-red-500" />
                              </button>
                            </div>

                            <div className="p-3 flex flex-col flex-1 gap-1">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-slate-400" />
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Fast Delivery</span>
                              </div>
                              <h4 className="font-bold text-[11px] text-slate-900 line-clamp-2 leading-tight h-8">
                                {product.title}
                              </h4>
                              <p className="text-[10px] text-slate-400 font-bold">Unit: 1 Pack</p>
                              
                              {/* Price + Cart row */}
                              <div className="flex items-center justify-between gap-2 mt-1">
                                <div className="flex flex-col">
                                  <span className="text-xs font-black text-slate-900">₹{product.price}</span>
                                  {product.originalPrice && (
                                    <span className="text-[9px] text-slate-400 line-through">₹{product.originalPrice}</span>
                                  )}
                                </div>

                                {qty > 0 ? (
                                  <div 
                                    className="flex items-center bg-primary text-white rounded-lg h-8 px-1 shadow-md shadow-primary/20"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button 
                                      onClick={(e) => handleUpdateQuantity(product.id, -1, e)}
                                      className="p-1 hover:bg-white/10 rounded-md transition-colors"
                                    >
                                      <Minus className="h-3 w-3" />
                                    </button>
                                    <span className="px-2 text-xs font-black min-w-[20px] text-center">{qty}</span>
                                    <button 
                                      onClick={(e) => handleUpdateQuantity(product.id, 1, e)}
                                      className="p-1 hover:bg-white/10 rounded-md transition-colors"
                                    >
                                      <Plus className="h-3 w-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <button 
                                    onClick={(e) => handleUpdateQuantity(product.id, 1, e)}
                                    className="flex items-center justify-center w-8 h-8 bg-slate-100 hover:bg-primary/10 border border-slate-200 rounded-lg transition-all"
                                  >
                                    <ShoppingCart className="h-3.5 w-3.5 text-primary" />
                                  </button>
                                )}
                              </div>

                              {/* Order Now button */}
                              <button
                                onClick={(e) => handleOrderNow(product.id, e)}
                                className="mt-2 w-full h-8 bg-red-500 hover:bg-red-600 active:scale-95 text-white text-[10px] font-black rounded-xl transition-all shadow-sm shadow-red-200 flex items-center justify-center gap-1.5"
                              >
                                <Zap className="h-3 w-3 fill-white" />
                                Order Now
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
