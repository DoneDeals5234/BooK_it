import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tag, Shop, ArrowRight, Gift, Clock, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getActiveOffersByShopId } from '@/lib/supabase-offers';
import { getShops } from '@/lib/shops-storage';
import { formatIST } from '@/lib/utils';
import type { ShopOffer } from '@/types';

interface OffersTabProps {
  onShopClick: (shopId: string) => void;
  initialOffers?: any[];
  onOffersLoaded?: (offers: any[]) => void;
}

export const OffersTab = ({ onShopClick, initialOffers = [], onOffersLoaded }: OffersTabProps) => {
  const [offers, setOffers] = useState<any[]>(initialOffers.length > 0 ? initialOffers : () => {
    try {
      const cached = localStorage.getItem('bazar_offers_cache');
      if (cached) return JSON.parse(cached) || [];
    } catch(e) {}
    return [];
  });
  const [loading, setLoading] = useState(offers.length === 0);

  useEffect(() => {
    if (offers.length > 0 && onOffersLoaded) onOffersLoaded(offers);
  }, [offers]);

  useEffect(() => {
    if (initialOffers.length > 0) return;
    const loadAllOffers = async () => {
      setLoading(true);
      try {
        const shops = await getShops();
        const all: any[] = [];
        for (const shop of shops) {
          const shopOffers = await getActiveOffersByShopId(shop.id);
          all.push(...shopOffers.map(o => ({ ...o, shopName: shop.name, shopImage: shop.shopImageUrl })));
        }
        const sorted = all.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        setOffers(sorted);
        localStorage.setItem('bazar_offers_cache', JSON.stringify(sorted.slice(0, 20)));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadAllOffers();
  }, [initialOffers.length]);

  if (loading) {
    return <div className="flex flex-col items-center justify-center py-20 gap-4"><div className="h-12 w-12 animate-spin rounded-full border-4 border-red-500/30 border-t-red-600" /><p className="text-muted-foreground font-medium">Hunting for deals...</p></div>;
  }

  return (
    <div className="flex flex-col gap-6 p-4 pt-24 pb-32">
      <div className="relative overflow-hidden bg-gradient-to-br from-red-600 to-red-800 rounded-3xl p-6 shadow-xl">
        <h2 className="text-2xl font-black text-white mb-1 uppercase">Active Offers</h2>
        <Tag className="absolute right-[-10px] bottom-[-10px] h-32 w-32 text-white/10 -rotate-12" />
      </div>
      <div className="grid grid-cols-1 gap-4">
        {offers.map((offer, index) => (
          <motion.div key={offer.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
            <Card className="overflow-hidden border-0 shadow-lg bg-white cursor-pointer" onClick={() => onShopClick(offer.shop_id)}>
              <div className="flex h-32">
                <div className="w-1/3 bg-slate-100 overflow-hidden">
                  <img src={offer.image_url || offer.shopImage} className="w-full h-full object-cover" />
                </div>
                <CardContent className="flex-1 p-4 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-red-600 uppercase bg-red-50 px-2 py-0.5 rounded">{offer.shopName}</span>
                    <h3 className="font-black text-base line-clamp-1">{offer.title}</h3>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-slate-400">Valid until {formatIST(offer.end_date, false)}</span>
                    <Button size="sm" className="bg-red-600 text-white text-[10px] h-7 px-3 rounded-full font-black">VIEW</Button>
                  </div>
                </CardContent>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
