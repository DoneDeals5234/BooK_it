import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, ShoppingCart, Heart, Plus, Minus, Clock, Star, Zap, ArrowRight, PackageSearch, MapPin, ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
// OrderAmountModal removed in favor of CheckoutPage
import { 
  getAllActiveProducts, getCartItems, updateCartQuantity,
  getProductsPhase1, getProductsPhase2, getProductsPhase3
} from '@/lib/supabase-marketplace';
import { getShopByIdFromSupabase } from '@/lib/supabase-shops';
import { FeaturedProduct, Shop } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const CATEGORIES = [
  { id: 'dairy', name: 'Dairy & Eggs', image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&q=80&w=150' },
  { id: 'snacks', name: 'Snacks', image: 'https://images.unsplash.com/photo-1576618148400-f54bed99fcfd?auto=format&fit=crop&q=80&w=150' },
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
  initialProducts?: FeaturedProduct[];
  onProductsLoaded?: (products: FeaturedProduct[]) => void;
}

const ProductSkeleton = () => (
  <div className="bg-white rounded-2xl p-3 border border-slate-100 space-y-3">
    <div className="aspect-square w-full bg-slate-100 animate-pulse rounded-xl" />
    <div className="h-4 w-3/4 bg-slate-100 animate-pulse rounded" />
    <div className="h-4 w-1/2 bg-slate-100 animate-pulse rounded" />
    <div className="flex justify-between items-center pt-2"><div className="h-6 w-1/3 bg-slate-100 animate-pulse rounded" /><div className="h-8 w-1/3 bg-slate-100 animate-pulse rounded-lg" /></div>
  </div>
);

export default function BazarTab({ onShowLogin, initialProducts = [], onProductsLoaded }: BazarTabProps) {
  const navigate = useNavigate();
  const [products, setProducts] = useState<FeaturedProduct[]>(initialProducts.length > 0 ? initialProducts : () => {
    try {
      const cached = localStorage.getItem('bazar_products_cache');
      if (cached) return JSON.parse(cached) || [];
    } catch (e) {}
    return [];
  });
  const [shops, setShops] = useState<Record<string, Shop>>({});
  const [loading, setLoading] = useState(products.length === 0);
  const [searchQuery, setSearchQuery] = useState('');
  const { user } = useAuth();
  const [cartQuantities, setCartQuantities] = useState<Record<string, number>>({});
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  // Modal states removed

  useEffect(() => {
    if (products.length > 0) {
      if (onProductsLoaded) onProductsLoaded(products);
      try {
        localStorage.setItem('bazar_products_cache', JSON.stringify(products));
      } catch (e) {}
    }
  }, [products]);

  useEffect(() => {
    if (initialProducts.length > 0) return; // Don't re-fetch if we have initial data

    let isMounted = true;
    let offset = 0;
    const limit = 10;
    const CHUNK_DELAY = 100;

    const fetchInPhases = async () => {
      setLoading(true);
      while (isMounted) {
        const phase1 = await getProductsPhase1(offset, limit);
        if (!phase1 || phase1.length === 0) { setLoading(false); break; }

        if (isMounted) {
          setProducts(prev => {
            const current = [...prev];
            phase1.forEach(p1 => {
              if (!current.find(c => c.id === p1.id)) {
                current.push({ id: p1.id, title: p1.title, price: 0, imageUrl: '', isActive: true } as any);
              }
            });
            return current;
          });
          setLoading(false);
        }
        await new Promise(r => setTimeout(r, CHUNK_DELAY));
        const newIds = phase1.map(p => p.id);
        const phase2 = await getProductsPhase2(newIds);
        setProducts(prev => prev.map(p => {
          const p2 = phase2.find(d => d.id === p.id);
          return p2 ? { ...p, price: p2.price, originalPrice: p2.original_price, discountPercentage: p2.discount_percentage } : p;
        }));
        await new Promise(r => setTimeout(r, CHUNK_DELAY));
        const phase3 = await getProductsPhase3(newIds);
        setProducts(prev => prev.map(p => {
          const p3 = phase3.find(d => d.id === p.id);
          return p3 ? { ...p, imageUrl: p3.image_url, images: p3.images || [], description: p3.description, shopId: p3.shop_id, category: p3.category } : p;
        }));
        offset += limit;
      }
    };
    fetchInPhases();
  }, [initialProducts.length]);

  useEffect(() => {
    if (user) getCartItems(user.uid).then(items => {
      const q: any = {};
      items.forEach(i => q[i.productId] = i.quantity);
      setCartQuantities(q);
    });
  }, [user]);

  const filteredProducts = useMemo(() => {
    let f = products;
    if (searchQuery) f = f.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()));
    if (activeCategory) f = f.filter(p => (p.category || getProductCategory(p.title)) === activeCategory);
    return f;
  }, [products, searchQuery, activeCategory]);

  return (
    <div className="min-h-screen bg-[#F8F9FB] pb-24">
      <header className="relative bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input className="pl-10 h-11 bg-slate-50 border-none rounded-2xl" placeholder="Search products..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <button onClick={() => navigate('/cart')} className="relative w-11 h-11 bg-slate-50 rounded-2xl flex items-center justify-center">
            <ShoppingCart className="h-5 w-5" />
            {Object.values(cartQuantities).filter(q => q > 0).length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">{Object.values(cartQuantities).filter(q => q > 0).length}</span>}
          </button>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 pt-4 space-y-6">
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)} className={`flex flex-col items-center gap-2 shrink-0 min-w-[70px] ${activeCategory === cat.id ? 'scale-105' : 'opacity-80'}`}>
              <div className={`h-16 w-16 rounded-[22px] overflow-hidden border-2 ${activeCategory === cat.id ? 'border-primary' : 'border-white'}`}>
                <img src={cat.image} className="w-full h-full object-cover" />
              </div>
              <span className="text-[9px] font-black uppercase">{cat.name.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        {/* Promotional Banner */}
        <div className="bg-gradient-to-r from-yellow-400 to-amber-500 rounded-[32px] p-6 relative overflow-hidden shadow-sm mb-6 mt-2 border border-yellow-300/50">
          <div className="relative z-10 w-[70%]">
            <span className="bg-black text-white text-[9px] font-black uppercase px-3 py-1.5 rounded-xl tracking-wider inline-block mb-3 shadow-md">Local Shop Delivery</span>
            <h2 className="text-2xl font-black leading-tight text-black mb-2 tracking-tight">Quick Delivery from Local Stores 🛵</h2>
            <p className="text-[11px] font-bold text-black/80">Groceries, Snacks & more at your doorstep.</p>
          </div>
          {/* Decorative element */}
          <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-amber-400 rounded-full blur-2xl opacity-60"></div>
          <div className="absolute right-4 bottom-4 w-16 h-16 bg-yellow-300 rounded-full flex items-center justify-center shadow-lg border border-yellow-200">
            <ShoppingCart className="h-6 w-6 text-yellow-700" />
          </div>
        </div>

        {loading ? <div className="grid grid-cols-2 gap-4">{[1, 2, 3, 4].map(i => <ProductSkeleton key={i} />)}</div> : (
          <div className="grid grid-cols-2 gap-4">
            {filteredProducts.map(product => {
              const qty = cartQuantities[product.id] || 0;
              return (
                <div key={product.id} className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm p-3 flex flex-col" onClick={() => navigate(`/product/${product.id}`)}>
                  <div className="relative aspect-square bg-slate-50 rounded-xl overflow-hidden mb-2">
                    <img src={product.imageUrl} className="w-full h-full object-cover" />
                  </div>
                  <h4 className="font-bold text-xs line-clamp-2 h-8 mb-1">{product.title}</h4>
                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-xs font-black">₹{product.price}</span>
                    <button onClick={(e) => {
                      e.stopPropagation();
                      const newQty = qty + 1;
                      setCartQuantities(prev => ({ ...prev, [product.id]: newQty }));
                      updateCartQuantity(user?.uid || '', product.id, newQty);
                    }} className="px-3 py-1 bg-green-50 border border-green-600 text-green-600 rounded-lg text-xs font-bold">ADD</button>
                  </div>
                  <button onClick={async (e) => { 
                    e.stopPropagation(); 
                    if (product.shopId) {
                      const shopData = await getShopByIdFromSupabase(product.shopId);
                      navigate(`/checkout/${product.id}`, { state: { product, shop: shopData } });
                    } else {
                      navigate(`/checkout/${product.id}`, { state: { product } });
                    }
                  }} className="mt-2 w-full py-2 bg-red-500 text-white text-[10px] font-bold rounded-xl">Order Now</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* OrderAmountModal component removed */}
    </div>
  );
}
