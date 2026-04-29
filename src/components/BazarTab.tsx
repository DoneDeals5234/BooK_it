import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingBag, Star, Heart, Search, MessageCircle, User, ShoppingCart, Filter, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { getAllActiveProducts } from '@/lib/supabase-marketplace';
import type { FeaturedProduct } from '@/types';
import type { TabType } from '@/components/HomePage';

interface BazarTabProps {
  setCurrentTab: (tab: TabType) => void;
  onShowLogin?: () => void;
}

export default function BazarTab({ setCurrentTab, onShowLogin }: BazarTabProps) {
  const navigate = useNavigate();
  const [products, setProducts] = useState<FeaturedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const loadProducts = async () => {
      setLoading(true);
      try {
        const data = await getAllActiveProducts();
        setProducts(data);
      } catch (error) {
        console.error('Error loading bazar products:', error);
      } finally {
        setLoading(false);
      }
    };
    loadProducts();
  }, []);

  const filteredProducts = products.filter(p => 
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="relative h-screen bg-slate-50 dark:bg-slate-950 flex flex-col overflow-hidden">
      {/* Header Section - Modern Sticky Header */}
      <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shadow-sm px-4 pt-10 pb-4">
        <div className="max-w-2xl mx-auto flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setCurrentTab('explore')} className="rounded-full h-9 w-9">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Bazar</h1>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full text-slate-600">
                <ShoppingCart className="h-5 w-5" />
                <span className="absolute top-1 right-1 h-3.5 w-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center border-2 border-white">2</span>
              </Button>
              <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                <User className="h-5 w-5 text-slate-600" />
              </div>
            </div>
          </div>

          {/* Search Bar Area */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search products, brands..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-red-500/10 focus:border-red-500 transition-all font-medium placeholder:text-slate-400"
              />
            </div>
            <Button variant="outline" size="icon" className="rounded-xl border-slate-200 h-10 w-10 shrink-0">
              <Filter className="h-4 w-4 text-slate-600" />
            </Button>
          </div>
        </div>
      </div>

      <div className="relative z-10 container mx-auto px-4 max-w-2xl flex-1 overflow-y-auto pt-4 pb-32 no-scrollbar">

        {/* Loading State */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-red-500/30 border-t-red-600" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <h2 className="text-xl font-bold mb-2">No products found</h2>
            <p className="text-muted-foreground">Try adjusting your search or check back later.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {filteredProducts.map((product) => {
              const originalPrice = product.originalPrice;
              const discount = product.discountPercentage;

              return (
                <div
                  key={product.id}
                  onClick={() => navigate(`/product/${product.id}`)}
                  className="rounded-2xl overflow-hidden hover:shadow-xl transition-all bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 cursor-pointer group flex flex-col h-full"
                >
                  <div className="relative aspect-square bg-slate-50 dark:bg-slate-800 overflow-hidden shrink-0">
                    <img
                      src={product.imageUrl}
                      alt={product.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    {discount && (
                      <div className="absolute top-3 left-3 bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-lg uppercase tracking-wider">
                        -{discount}%
                      </div>
                    )}
                    <button className="absolute top-3 right-3 bg-white/90 backdrop-blur-md dark:bg-slate-900/90 rounded-full p-2 shadow-md text-slate-400 hover:text-red-500 transition-all z-10 hover:scale-110"
                      onClick={(e) => { e.stopPropagation(); /* handle fav */ }}
                    >
                      <Heart className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="p-4 flex flex-col flex-1">
                    <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white capitalize line-clamp-2 leading-tight mb-1">{product.title}</h4>
                    
                    <div className="flex items-center gap-1.5 mb-2 h-4">
                      {/* Fake reviews removed */}
                    </div>

                    <div className="mt-auto">
                      <div className="flex flex-col mb-4">
                        <span className="font-black text-red-600 text-lg">₹{product.price}</span>
                        {originalPrice && (
                          <span className="text-[10px] text-slate-400 line-through font-bold uppercase tracking-widest">₹{originalPrice}</span>
                        )}
                      </div>
                      
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/product/${product.id}`);
                        }}
                        className="w-full text-xs font-black bg-red-500 hover:bg-red-600 text-white h-10 rounded-xl shadow-lg shadow-red-500/10 transition-all uppercase tracking-widest active:scale-95"
                      >
                        Add to Cart
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
