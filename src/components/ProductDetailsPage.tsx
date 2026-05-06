import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Star, ShoppingBag, Store, Navigation, MessageCircle, Heart, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { getProductById, getSimilarProducts, getProductReviews, addProductReview, addToCart } from '@/lib/supabase-marketplace';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { FeaturedProduct } from '@/types';
import type { ProductReview } from '@/lib/supabase-marketplace';
import { getShopById } from '@/lib/shops-storage';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { OrderAmountModal } from '@/components/OrderAmountModal';
import { StarRating } from '@/components/StarRating';
import { formatIST } from '@/lib/utils';
import { toast } from 'react-hot-toast';

export function ProductDetailsPage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useUserProfile();

  const [product, setProduct] = useState<FeaturedProduct | null>(null);
  const [shopName, setShopName] = useState<string>('Loading Shop...');
  const [similarProducts, setSimilarProducts] = useState<FeaturedProduct[]>([]);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  
  // Order Modal state
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

  // Review State
  const [reviewText, setReviewText] = useState('');
  const [rating, setRating] = useState(5);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  useEffect(() => {
    if (!productId) return;

    const loadData = async () => {
      // 1. Instant Load from Cache
      const cached = localStorage.getItem('bazar_products_cache');
      let foundInCache = false;
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as FeaturedProduct[];
          const cachedProduct = parsed.find(p => p.id === productId);
          if (cachedProduct && cachedProduct.imageUrl) {
            setProduct(cachedProduct);
            if (cachedProduct.shopId) {
              getShopById(cachedProduct.shopId).then(shopInfo => {
                if (shopInfo) setShopName(shopInfo.name);
              });
            }
            setLoading(false); // Stop spinner immediately
            foundInCache = true;
          }
        } catch (e) {}
      }

      if (!foundInCache) setLoading(true);

      // 2. Background Fetch for Reviews, Similar Products, and fresh data
      try {
        const fetchedProduct = await getProductById(productId);
        if (fetchedProduct) {
          if (!foundInCache) setProduct(fetchedProduct);
          
          // Load shop info
          const shopInfo = await getShopById(fetchedProduct.shopId);
          if (shopInfo) setShopName(shopInfo.name);

          // Load similar products
          getSimilarProducts(fetchedProduct.shopId, productId).then(setSimilarProducts);

          // Load reviews
          getProductReviews(productId).then(setReviews);
        }
      } catch (error) {
        console.error('Error loading product details:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [productId]);

  const averageRating = reviews.length > 0 
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
    : 4.5; // Default random if no reviews for demo purposes if needed

  const handleSubmitReview = async () => {
    if (!user) {
      toast.error('Please sign in to leave a review.');
      return;
    }
    if (!reviewText.trim()) {
      toast.error('Please enter a review comment.');
      return;
    }

    setIsSubmittingReview(true);
    try {
      const newReview = await addProductReview(
        productId!,
        user.uid,
        profile?.name || user.displayName || 'Anonymous',
        rating,
        reviewText.trim()
      );

      if (newReview) {
        setReviews([newReview, ...reviews]);
        setReviewText('');
        setRating(5);
        toast.success('Review added successfully!');
      } else {
        toast.error('Failed to add review.');
      }
    } catch (error) {
      toast.error('Error adding review.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleAddToCart = async () => {
    if (!user) {
      toast.error('Please sign in to add items to cart.');
      return;
    }
    
    const success = await addToCart(user.uid, productId!, 1);
    if (success) {
      toast.success('Added to Cart!');
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              title: "Added to Cart 🛒",
              body: `${product?.title} has been added to your cart!`,
              id: new Date().getTime(),
              schedule: { at: new Date(Date.now() + 500) },
              smallIcon: "ic_stat_name",
              largeIcon: "res://drawable/notification_large_icon"
            }
          ]
        });
      } catch (err) {
        console.error('Local notification error:', err);
      }
    } else {
      toast.error('Failed to add to cart');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-red-500/30 border-t-red-600" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h2 className="text-xl font-bold mb-4">Product Not Found</h2>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  const originalPrice = product.originalPrice || product.price + Math.floor(product.price * 0.2);
  const discount = product.discountPercentage || (product.originalPrice ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100) : 0);
  const discountStr = discount > 0 ? `${discount}%` : '';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 font-sans">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center justify-between p-4 max-w-2xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" className="rounded-full">
              <Share2 className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Heart className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto pt-16">
        {/* Product Image */}
        <div className="relative w-full bg-white dark:bg-slate-800">
          <div className="aspect-square relative">
            <img 
              src={product.images && product.images.length > 0 ? product.images[activeImageIndex] : product.imageUrl} 
              alt={product.title} 
              className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal p-4 transition-all duration-300" 
              onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400'; }}
            />
          </div>
          
          {/* Thumbnails if multiple images exist */}
          {product.images && product.images.length > 1 && (
            <div className="flex gap-2 p-4 overflow-x-auto no-scrollbar">
              {product.images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImageIndex(idx)}
                  className={`relative h-16 w-16 rounded-xl border-2 overflow-hidden shrink-0 transition-all ${activeImageIndex === idx ? 'border-red-500 shadow-md scale-105' : 'border-slate-200 opacity-70 hover:opacity-100'}`}
                >
                  <img 
                    src={img} 
                    alt="thumbnail" 
                    className="w-full h-full object-contain" 
                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=150'; }}
                  />
                </button>
              ))}
            </div>
          )}

          {discountStr && (
            <div className="absolute top-4 left-4 bg-[#318616] text-white font-black px-3 py-1 rounded-lg shadow-md text-sm z-10">
              {discountStr} OFF
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-t-3xl -mt-6 relative z-10 shadow-lg">
          <h1 className="text-2xl sm:text-3xl font-black capitalize leading-tight mb-2 text-slate-900 dark:text-white">
            {product.title}
          </h1>
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 dark:text-white">₹{product.price}</span>
              {product.originalPrice && (
                <span className="text-lg text-slate-400 line-through">₹{product.originalPrice}</span>
              )}
            </div>
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-1 rounded-full border border-yellow-100 dark:border-yellow-900/50">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="font-bold text-yellow-700 dark:text-yellow-500 text-sm">{averageRating.toFixed(1)}</span>
              </div>
              <span className="text-xs font-medium text-slate-500 mt-1">{reviews.length} Reviews</span>
            </div>
          </div>

          <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base leading-relaxed mb-6">
            {product.description || "Premium quality product available for immediate order. Contact shop for more details."}
          </p>

          {/* Shop Info Card */}
          <Card className="p-4 mb-6 bg-red-50/50 dark:bg-red-900/10 border-0 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <Store className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sold By</p>
                <p className="font-bold text-slate-900 dark:text-white">{shopName}</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate(`/shop/${product.shopId}`)}
              className="rounded-xl font-bold border-slate-200 text-slate-700 hover:bg-slate-100"
            >
              View Shop
            </Button>
          </Card>

          {/* Reviews Section */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-6 mt-6">
            <h3 className="text-xl font-black mb-4 flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-red-600" />
              Customer Reviews ({reviews.length})
            </h3>

            {/* Add Review */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 mb-6">
              <p className="text-sm font-bold mb-2">Write a Review</p>
              <div className="flex items-center gap-2 mb-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} onClick={() => setRating(star)}>
                    <Star className={`h-6 w-6 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'}`} />
                  </button>
                ))}
              </div>
              <Textarea 
                placeholder="Share your experience..."
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                className="mb-3 rounded-xl bg-white dark:bg-slate-900 border-slate-200"
              />
              <Button 
                onClick={handleSubmitReview}
                disabled={isSubmittingReview}
                className="w-full bg-red-600 hover:bg-red-700 rounded-xl text-white font-bold shadow-md shadow-red-500/20"
              >
                {isSubmittingReview ? 'Submitting...' : 'Submit Review'}
              </Button>
            </div>

            {/* Review List */}
            <div className="space-y-4">
              {reviews.map(review => (
                <div key={review.id} className="border-b border-slate-100 dark:border-slate-800 pb-4 last:border-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">{review.userName}</span>
                    <span className="text-xs text-slate-400">{formatIST(review.createdAt, false)}</span>
                  </div>
                  <div className="flex items-center mb-2">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`h-3 w-3 ${i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-200'}`} />
                    ))}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{review.comment}</p>
                </div>
              ))}
              {reviews.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">No reviews yet. Be the first to review!</p>
              )}
            </div>
          </div>

          {/* Similar Products */}
          {similarProducts.length > 0 && (
            <div className="border-t border-slate-100 dark:border-slate-800 pt-6 mt-6">
              <h3 className="text-xl font-black mb-4">Similar Products</h3>
              <div className="flex overflow-x-auto gap-4 pb-4 snap-x custom-scrollbar">
                {similarProducts.map((simProd) => (
                  <div 
                    key={simProd.id}
                    onClick={() => {
                      window.scrollTo(0,0);
                      navigate(`/product/${simProd.id}`);
                    }}
                    className="w-[140px] bg-white rounded-2xl overflow-hidden border border-slate-200/60 shadow-sm hover:shadow-md transition-all flex flex-col cursor-pointer snap-start shrink-0 h-full"
                  >
                    <div className="relative aspect-square p-2 bg-[#F4F6F9]">
                      <img src={simProd.images && simProd.images.length > 0 ? simProd.images[0] : simProd.imageUrl} alt={simProd.title} className="w-full h-full object-contain mix-blend-multiply" />
                    </div>
                    <div className="p-2 flex flex-col flex-1 gap-1">
                      <div className="flex items-center gap-1 bg-slate-100 w-max px-1.5 py-0.5 rounded-md mb-1">
                        <span className="text-[7px] font-black text-slate-700 uppercase tracking-tight">8 MINS</span>
                      </div>
                      <h4 className="font-bold text-[10px] text-slate-800 line-clamp-2 leading-tight h-7 mb-1">
                        {simProd.title}
                      </h4>
                      <p className="text-[9px] text-slate-500 font-semibold mb-1">1 Pack</p>
                      <div className="flex items-center justify-between gap-1 mt-auto">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-slate-900 leading-none">₹{simProd.price}</span>
                        </div>
                        <button className="flex items-center justify-center px-2 h-6 bg-green-50 border border-[#318616] hover:bg-green-100 rounded text-[9px] font-black text-[#318616]">
                          ADD
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fixed Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-slate-900 border-t border-border/50 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] z-40 flex gap-3">
        <Button 
          variant="outline" 
          onClick={handleAddToCart}
          className="flex-1 h-14 rounded-2xl border-2 border-slate-200 text-slate-700 font-black text-sm uppercase tracking-wide"
        >
          <ShoppingBag className="h-5 w-5 mr-2" />
          Add to Cart
        </Button>
        <Button 
          onClick={() => setIsOrderModalOpen(true)}
          className="flex-1 h-14 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black text-sm uppercase tracking-wide shadow-lg shadow-red-500/30 transition-all active:scale-95"
        >
          <Navigation className="h-5 w-5 mr-2" />
          Order Now
        </Button>
      </div>

      {/* Order Modal using existing component */}
      <OrderAmountModal 
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        shopId={product.shopId}
        shopName={shopName}
        productName={product.title}
        productPrice={product.price}
        productImage={product.imageUrl}
        shopLat={product.latitude || undefined}
        shopLng={product.longitude || undefined}
        shopMapLink={product.shopMapLink || undefined}
      />
    </div>
  );
}
