import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tag, Shop, ArrowRight, Gift, Clock, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getActiveOffersByShopId } from '@/lib/supabase-offers';
import { getShops } from '@/lib/shops-storage';
import type { ShopOffer } from '@/types';
import type { Shop as ShopType } from '@/lib/shops-storage';

interface OffersTabProps {
  onShopClick: (shopId: string) => void;
}

interface OfferWithShop extends ShopOffer {
  shopName?: string;
  shopImage?: string;
}

export const OffersTab = ({ onShopClick }: OffersTabProps) => {
  const [offers, setOffers] = useState<OfferWithShop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAllOffers = async () => {
      setLoading(true);
      try {
        const shops = await getShops();
        const allOffers: OfferWithShop[] = [];

        for (const shop of shops) {
          const shopOffers = await getActiveOffersByShopId(shop.id);
          const offersWithShop = shopOffers.map(offer => ({
            ...offer,
            shopName: shop.name,
            shopImage: shop.shopImageUrl
          }));
          allOffers.push(...offersWithShop);
        }

        // Sort by creation date (newest first)
        setOffers(allOffers.sort((a, b) => 
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        ));
      } catch (error) {
        console.error('Error loading all offers:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAllOffers();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-red-500/30 border-t-red-600" />
        <p className="text-muted-foreground font-medium">Hunting for the best deals...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 pt-24 pb-32">
      {/* Offers Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-red-600 to-red-800 rounded-3xl p-6 shadow-xl">
        <div className="relative z-10">
          <h2 className="text-2xl font-black text-white mb-1 uppercase tracking-tight">Active Offers</h2>
          <p className="text-red-100 text-sm opacity-90">Grab exclusive deals from your favorite shops</p>
        </div>
        <Tag className="absolute right-[-10px] bottom-[-10px] h-32 w-32 text-white/10 -rotate-12" />
      </div>

      {offers.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
          <Gift className="h-16 w-16 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">No Offers Right Now</h3>
          <p className="text-slate-500 max-w-[200px] mx-auto text-sm">Check back later for new discounts and deals.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {offers.map((offer, index) => (
            <motion.div
              key={offer.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card 
                className="overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all group cursor-pointer bg-white dark:bg-slate-800"
                onClick={() => onShopClick(offer.shop_id)}
              >
                <div className="flex h-32 sm:h-40">
                  {/* Shop/Offer Image */}
                  <div className="w-1/3 relative bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    {offer.image_url || offer.shopImage ? (
                      <img 
                        src={offer.image_url || offer.shopImage} 
                        alt={offer.title} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Tag className="h-8 w-8 text-red-300" />
                      </div>
                    )}
                    <div className="absolute top-0 left-0 bg-red-600 text-white text-[10px] font-black px-2 py-1 uppercase rounded-br-lg">
                      NEW
                    </div>
                  </div>

                  {/* Offer Details */}
                  <CardContent className="flex-1 p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded">
                          {offer.shopName}
                        </span>
                      </div>
                      <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white line-clamp-1">
                        {offer.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                        {offer.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                        <Clock className="h-3 w-3" />
                        <span>Valid until {new Date(offer.end_date).toLocaleDateString()}</span>
                      </div>
                      <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white text-[10px] h-7 px-3 rounded-full font-black">
                        VIEW SHOP
                      </Button>
                    </div>
                  </CardContent>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
