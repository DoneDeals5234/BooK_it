import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MapPin, Heart, Scissors, Calendar } from 'lucide-react';
import { getShops, isShopCurrentlyOpen } from '@/lib/shops-storage';
import { getOrderedShops } from '@/lib/shop-ordering';
import { getFavoriteShops, toggleFavoriteShop } from '@/lib/favorite-shops-storage';
import { getReviewsForShop } from '@/lib/supabase-reviews';
import { StarRating } from '@/components/StarRating';
import type { Shop } from '@/lib/shops-storage';
import type { Category } from '@/types/index';
import { useNavigate, useParams } from 'react-router-dom';
import { getAllCategories as getCategories } from '@/lib/supabase-categories';
import { getCachedShops, getCachedCategories } from '@/lib/shops-cache';
import { useDeviceBackButton } from '@/lib/use-device-back-button';

export const CategoryShopsPage = () => {
  const navigate = useNavigate();
  const { categoryId } = useParams();
  
  // Handle device back button
  useDeviceBackButton({
    onBackPressed: () => {
      navigate('/', { replace: true });
    },
    priority: 15
  });
  const [shops, setShops] = useState<Shop[]>(() => {
    const cachedShops = getCachedShops();
    return cachedShops ? getOrderedShops(cachedShops).filter(s => s.category === categoryId) : [];
  });
  const [category, setCategory] = useState<Category | null>(() => {
    const cachedCategories = getCachedCategories();
    return cachedCategories ? cachedCategories.find((c: any) => c.id === categoryId) || null : null;
  });
  const [loading, setLoading] = useState(() => {
    const cachedShops = getCachedShops();
    const cachedCategories = getCachedCategories();
    return !(cachedShops && cachedCategories);
  });
  const [favoriteRefresh, setFavoriteRefresh] = useState(0);
  const [shopReviews, setShopReviews] = useState<{ [shopId: string]: any[] }>({});

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const categories = await getCategories();
        const currentCategory = categories.find((c: any) => c.id === categoryId);
        setCategory(currentCategory || null);

        const allShops = await getShops();
        const filteredShops = getOrderedShops(allShops).filter(
          (shop) => shop.category === categoryId
        );
        setShops(filteredShops);

        // Load reviews for each shop
        const reviewsMap: { [shopId: string]: any[] } = {};
        for (const shop of filteredShops) {
          try {
            const reviews = await getReviewsForShop(shop.id);
            reviewsMap[shop.id] = reviews;
          } catch (error) {
            console.error(`Error loading reviews for shop ${shop.id}:`, error);
            reviewsMap[shop.id] = [];
          }
        }
        setShopReviews(reviewsMap);
      } catch (error) {
        console.error('Error loading category shops:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [categoryId]);

  const getBackgroundColor = (letter: string) => {
    const colors = [
      'bg-red-500',
      'bg-blue-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-orange-500',
    ];
    const index = letter.charCodeAt(0) % colors.length;
    return colors[index];
  };

  if (loading) {
    return (
      <div className="h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-red-500/30 border-t-red-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col">
      {/* Dark Red & White Mashup Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden bg-white dark:bg-slate-950">
        <div className="absolute top-0 left-0 right-0 h-[25%] bg-gradient-to-br from-red-800 via-red-700 to-red-600 dark:from-red-950 dark:via-red-900 dark:to-red-800 rounded-b-[40px] shadow-2xl"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.02] dark:opacity-[0.01]"></div>
      </div>

      {/* Header */}
      <div className="relative p-6 sm:p-8 flex items-center justify-between flex-shrink-0 z-10">
        <div className="flex items-center gap-4 w-full">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/', { replace: true })}
            className="text-white hover:bg-white/10 rounded-full h-10 w-10 flex-shrink-0"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-black text-white truncate leading-tight tracking-tight uppercase">
              {category?.name || 'Category'}
            </h1>
            <p className="text-xs sm:text-sm text-red-100 truncate opacity-80">Explore top shops in this category</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative flex-1 overflow-y-auto overflow-x-hidden">
        <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-4 max-w-2xl relative z-10">
          {shops.length === 0 ? (
            <div className="text-center py-8 sm:py-16">
              <div className="mb-4 flex justify-center opacity-60">
                <Scissors className="h-16 w-16 text-primary/50" />
              </div>
              <h2 className="text-lg sm:text-2xl font-semibold mb-2">No Shops Available</h2>
              <p className="text-sm sm:text-base text-muted-foreground">
                No shops in this category yet. Check back soon!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {shops.map((shop) => {
                const reviews = shopReviews[shop.id] || [];
                const averageRating = reviews.length > 0
                  ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
                  : 0;
                const isOpen = isShopCurrentlyOpen(shop.openingTime, shop.closingTime);

                return (
                  <Card
                    key={shop.id}
                    onClick={() => navigate(`/shop/${shop.id}`)}
                    className="overflow-hidden hover:shadow-xl transition-all duration-300 group flex flex-col bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-md hover:bg-white dark:hover:bg-slate-800 relative cursor-pointer"
                  >
                    {/* Image Section */}
                    <div className="relative w-full h-32 sm:h-40 bg-gradient-to-br from-red-100/50 to-white flex items-center justify-center overflow-hidden flex-shrink-0">
                      {shop.shopImageUrl ? (
                        <img
                          src={shop.shopImageUrl}
                          alt={shop.name}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <Scissors className="h-12 sm:h-16 w-12 sm:w-16 text-red-300 group-hover:scale-110 transition-transform duration-300" />
                      )}

                      {/* Heart Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavoriteShop(shop.id);
                          setFavoriteRefresh(prev => prev + 1);
                        }}
                        className="absolute top-2 left-2 p-2 rounded-full bg-white/90 dark:bg-slate-800/90 hover:bg-white dark:hover:bg-slate-700 transition-colors shadow-lg z-20"
                        title={getFavoriteShops().includes(shop.id) ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        <Heart
                          className={`h-5 w-5 sm:h-6 sm:w-6 transition-colors ${
                            getFavoriteShops().includes(shop.id)
                              ? 'fill-red-500 text-red-500'
                              : 'text-red-400 hover:text-red-500'
                          }`}
                        />
                      </button>

                      {/* Open/Closed Status Badge - Top right of image */}
                      <div className="absolute right-2 top-2 z-20">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                            isOpen
                              ? 'bg-green-500 text-white shadow-lg shadow-green-500/50'
                              : 'bg-red-500 text-white shadow-lg shadow-red-500/50'
                          }`}
                        >
                          {isOpen ? 'Open' : 'Closed'}
                        </span>
                      </div>
                    </div>

                    {/* Details Section */}
                    <CardContent className="p-3 sm:p-4 flex-1 flex flex-col justify-between">
                      <div className="space-y-2 sm:space-y-3">
                        {/* Shop name */}
                        <h3 className="font-semibold text-sm sm:text-base truncate">{shop.name}</h3>

                        {/* Location */}
                        <div className="flex items-center gap-1 sm:gap-2 text-muted-foreground">
                          <MapPin className="h-3 sm:h-4 w-3 sm:w-4 flex-shrink-0" />
                          <p className="text-xs sm:text-sm truncate">{shop.location}</p>
                        </div>

                        {/* Star Rating */}
                        {averageRating > 0 && (
                          <div className="flex items-center gap-2">
                            <StarRating
                              rating={averageRating}
                              reviewCount={reviews.length}
                              size="sm"
                              showText={true}
                            />
                          </div>
                        )}
                      </div>

                      {/* Book Button - Full Width */}
                      <Button
                        size="sm"
                        className="bg-red-500 hover:bg-red-600 text-white text-xs h-9 w-full mt-3 sm:mt-4 shadow-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/shop/${shop.id}`);
                        }}
                      >
                        <Calendar className="h-3 w-3" />
                        <span className="ml-1">Book</span>
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
