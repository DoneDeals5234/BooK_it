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
  
  // Order Modal state
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

  // Review State
  const [reviewText, setReviewText] = useState('');
  const [rating, setRating] = useState(5);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  useEffect(() => {
    if (!productId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const fetchedProduct = await getProductById(productId);
        if (fetchedProduct) {
          setProduct(fetchedProduct);
          
          // Load shop info
          const shopInfo = await getShopById(fetchedProduct.shopId);
          if (shopInfo) setShopName(shopInfo.name);

          // Load similar products
          const similar = await getSimilarProducts(fetchedProduct.shopId, productId);
          setSimilarProducts(similar);

          // Load reviews
          const fetchedReviews = await getProductReviews(productId);
          setReviews(fetchedReviews);
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

  const originalPrice = product.price + Math.floor(product.price * 0.2);
  const discountStr = "-20%";

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
        <div className="relative aspect-square w-full bg-white dark:bg-slate-800">
          <img 
            src={product.imageUrl} 
            alt={product.title} 
            className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal p-4" 
          />
          <div className="absolute top-4 left-4 bg-red-600 text-white font-black px-3 py-1 rounded-lg shadow-md text-sm">
            {discountStr} OFF
          </div>
        </div>

        {/* Product Info */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-t-3xl -mt-6 relative z-10 shadow-lg">
          <h1 className="text-2xl sm:text-3xl font-black capitalize leading-tight mb-2 text-slate-900 dark:text-white">
            {product.title}
          </h1>
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-red-600">₹{product.price}</span>
              <span className="text-sm font-bold text-slate-400 line-through">₹{originalPrice}</span>
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
                    className="min-w-[140px] border border-border rounded-xl overflow-hidden hover:shadow-md transition-all bg-white cursor-pointer snap-start flex-shrink-0"
                  >
                    <div className="aspect-square bg-slate-100">
                      <img src={simProd.imageUrl} alt={simProd.title} className="w-full h-full object-cover mix-blend-multiply" />
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-bold truncate">{simProd.title}</p>
                      <p className="text-sm font-black text-red-600">₹{simProd.price}</p>
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
