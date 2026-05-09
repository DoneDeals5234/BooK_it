import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MapPin, Phone, Mail, User, Briefcase, Clock, MessageCircle, Calendar, Star, Palette, Video, Heart, ShoppingCart, ChevronRight } from 'lucide-react';
import { getShopById } from '@/lib/shops-storage';
import { getAllBookingsFromSupabase } from '@/lib/supabase-bookings';
import { getUserProfile, getUserProfileByEmail, type UserProfile } from '@/lib/supabase-user-profiles';
import { getReviewsForShop, hasUserReviewedShop, type Review } from '@/lib/supabase-reviews';
import { getFeaturedProductsByShopId, type FeaturedProduct } from '@/lib/supabase-featured-products';
import { getActiveOffersByShopId } from '@/lib/supabase-offers';
import { formatIST } from '@/lib/utils';
import { ReviewForm } from '@/components/ReviewForm';
import { ReviewsList } from '@/components/ReviewsList';
import { ReviewReplyForm } from '@/components/ReviewReplyForm';
import { TemporaryChatSection } from '@/components/TemporaryChatSection';
import { ShopCustomizer } from '@/components/ShopCustomizer';
import { DocumentPrintingSection } from './DocumentPrintingSection';
import { BookingModalNew } from '@/components/BookingModalNew';
import { OrderAmountModal } from '@/components/OrderAmountModal';
import { ReminderAlertDialog } from '@/components/ReminderAlertDialog';
import { useBookingReminder } from '@/hooks/useBookingReminder';
import { getShopCustomization, customizationToCssVariables, getDefaultCustomization, type ShopCustomization } from '@/lib/shop-customization-db';
import type { Shop } from '@/lib/shops-storage';
import type { Booking } from '@/lib/bookings-storage';
import type { ShopOffer } from '@/types';
import { useNavigate } from 'react-router-dom';

interface ShopDetailsPageProps {
  shopId: string;
  onClose?: () => void;
  currentUserId?: string;
  currentUserEmail?: string;
  currentUserName?: string;
  shopOwnerEmail?: string;
  isBarberPortal?: boolean; // Only show customizer in barber portal
  onShowLogin?: () => void; // Callback to show login popup
}

interface BookingWithCustomer extends Booking {
  customerProfile?: UserProfile;
}

export const ShopDetailsPage = ({
  shopId,
  onClose,
  currentUserId = '',
  currentUserEmail = '',
  currentUserName = '',
  shopOwnerEmail = '',
  isBarberPortal = false,
  onShowLogin = () => { },
}: ShopDetailsPageProps) => {
  const [shop, setShop] = useState<Shop | null>(null);
  const [bookings, setBookings] = useState<BookingWithCustomer[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<FeaturedProduct[]>([]);
  const [shopOffers, setShopOffers] = useState<ShopOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [featuredProductsLoading, setFeaturedProductsLoading] = useState(false);
  const [offersLoading, setOffersLoading] = useState(false);
  const [ownerProfile, setOwnerProfile] = useState<UserProfile | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [selectedReviewForReply, setSelectedReviewForReply] = useState<Review | null>(null);
  const [userHasReviewed, setUserHasReviewed] = useState(false);
  const [customization, setCustomization] = useState<ShopCustomization | null>(null);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [cssVars, setCssVars] = useState<Record<string, string>>({});
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<FeaturedProduct | null>(null);
  const { activeReminder, confirmReminder, cancelReminder } = useBookingReminder();

  // Load customization
  useEffect(() => {
    const loadCustomization = async () => {
      try {
        let customData = await getShopCustomization(shopId);
        // Use default customization if none exists
        if (!customData) {
          customData = getDefaultCustomization(shopId);
        }
        setCustomization(customData);
        const vars = customizationToCssVariables(customData);
        setCssVars(vars);
      } catch (error) {
        console.error('Error loading customization:', error);
        // Set default customization on error
        const defaultCustom = getDefaultCustomization(shopId);
        setCustomization(defaultCustom);
      }
    };

    loadCustomization();
  }, [shopId]);

  useEffect(() => {
    const loadShopAndBookings = async () => {
      try {
        const [shopData, allBookings] = await Promise.all([
          getShopById(shopId),
          getAllBookingsFromSupabase(),
        ]);

        setShop(shopData);

        // Fetch owner profile to get social links
        if (shopData?.ownerEmail) {
          // Since we might not have ownerId directly, we search by email
          // Or if we can find ownerId from somewhere. 
          // Let's check if Shop has owner_id. 
          // Actually Shop has ownerEmail.
          const { data: profileData } = await getUserProfileByEmail(shopData.ownerEmail);
          if (profileData) {
            setOwnerProfile(profileData);
          }
        }

        // Filter bookings for this shop and fetch customer profiles
        const shopBookings = allBookings.filter((b) => b.shopId === shopId);
        const bookingsWithProfiles = await Promise.all(
          shopBookings.map(async (booking) => {
            // Extract userId from the booking's userId field if available
            // For now, we'll try to get profile by looking up from Supabase
            let profile: UserProfile | undefined;

            if (booking.userId) {
              const userProfile = await getUserProfile(booking.userId);
              profile = userProfile || undefined;
            }

            return {
              ...booking,
              customerProfile: profile,
            };
          })
        );

        setBookings(bookingsWithProfiles);
      } catch (error) {
        console.error('Error loading shop and bookings:', error);
      } finally {
        setLoading(false);
      }
    };

    loadShopAndBookings();
  }, [shopId]);

  // Load reviews
  useEffect(() => {
    const loadReviews = async () => {
      setReviewsLoading(true);
      try {
        const reviewsData = await getReviewsForShop(shopId);
        setReviews(reviewsData);

        // Check if current user has already reviewed
        if (currentUserId) {
          const hasReviewed = await hasUserReviewedShop(shopId, currentUserId);
          setUserHasReviewed(hasReviewed);
        }
      } catch (error) {
        console.error('Error loading reviews:', error);
      } finally {
        setReviewsLoading(false);
      }
    };

    loadReviews();
  }, [shopId, currentUserId]);

  // Load featured products
  useEffect(() => {
    const loadFeaturedProducts = async () => {
      setFeaturedProductsLoading(true);
      try {
        const products = await getFeaturedProductsByShopId(shopId);
        setFeaturedProducts(products);
      } catch (error) {
        console.error('Error loading featured products:', error);
        setFeaturedProducts([]);
      } finally {
        setFeaturedProductsLoading(false);
      }
    };

    loadFeaturedProducts();
  }, [shopId]);

  // Load shop offers
  useEffect(() => {
    const loadOffers = async () => {
      setOffersLoading(true);
      try {
        const offers = await getActiveOffersByShopId(shopId);
        setShopOffers(offers);
      } catch (error) {
        console.error('Error loading shop offers:', error);
        setShopOffers([]);
      } finally {
        setOffersLoading(false);
      }
    };

    loadOffers();
  }, [shopId]);

  const handleReviewSubmitted = async (review: Review) => {
    // Add or update the review in the list
    const existingIndex = reviews.findIndex((r) => r.id === review.id);
    if (existingIndex >= 0) {
      const updatedReviews = [...reviews];
      updatedReviews[existingIndex] = review;
      setReviews(updatedReviews);
    } else {
      setReviews([review, ...reviews]);
    }

    setShowReviewForm(false);
    setEditingReview(null);
    setUserHasReviewed(true);

    // Reload shop to get updated rating
    const updatedShop = await getShopById(shopId);
    if (updatedShop) {
      setShop(updatedShop);
    }
  };

  const handleDeleteReview = (reviewId: string) => {
    setReviews(reviews.filter((r) => r.id !== reviewId));
    setUserHasReviewed(false);
  };

  const handleReplySubmitted = () => {
    setSelectedReviewForReply(null);
    // Reload reviews to show the new reply
    getReviewsForShop(shopId).then(setReviews);
  };

  if (loading) {
    return (
      <div className="relative h-screen bg-white dark:bg-slate-950 flex items-center justify-center overflow-hidden">
        {/* Decorative 3D Background Elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-10 -right-40 w-80 h-80 bg-gradient-to-br from-red-100 to-white dark:from-red-900/10 dark:to-slate-900/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-red-50 to-white dark:from-red-950/5 dark:to-slate-900/5 rounded-full blur-3xl"></div>
        </div>
        <p className="relative z-10 text-muted-foreground flex items-center gap-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-red-500/30 border-t-red-600" />
          Loading shop details...
        </p>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="relative min-h-screen bg-white dark:bg-slate-950 p-6 flex flex-col">
        {/* Decorative 3D Background Elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-10 -right-40 w-80 h-80 bg-gradient-to-br from-red-100 to-white dark:from-red-900/10 dark:to-slate-900/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-red-50 to-white dark:from-red-950/5 dark:to-slate-900/5 rounded-full blur-3xl"></div>
        </div>
        <div className="relative z-10 max-w-4xl mx-auto w-full">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="text-center py-16">
            <h2 className="text-2xl font-semibold mb-2">Shop Not Found</h2>
            <p className="text-muted-foreground">The shop you're looking for doesn't exist.</p>
          </div>
        </div>
      </div>
    );
  }

  const getCategoryName = () => {
    const category = shop.category || 'shop';
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  const containerStyle: React.CSSProperties & Record<string, string> =
    customization && cssVars ? (cssVars as any) : {};

  return (
    <div
      className="relative min-h-screen flex flex-col transition-colors duration-300 bg-white dark:bg-slate-950"
      style={{
        ...containerStyle,
        backgroundColor: customization?.backgroundColor || 'var(--background)',
        color: customization?.textColor || 'inherit',
      } as React.CSSProperties & Record<string, string>}
    >
      {/* Decorative 3D Background Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-10 -right-40 w-80 h-80 bg-gradient-to-br from-red-100 to-white dark:from-red-900/10 dark:to-slate-900/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-red-50 to-white dark:from-red-950/5 dark:to-slate-900/5 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto w-full">
        {/* Shop Image Header (3:4) */}
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
          {shop.shopImageUrl ? (
            <img
              src={shop.shopImageUrl}
              alt={shop.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-200 dark:bg-slate-800">
              <Clock className="h-12 w-12 text-slate-400" />
            </div>
          )}

          {/* Overlay Buttons */}
          <div className="absolute top-4 left-4 z-20">
            <Button
              variant="secondary"
              size="icon"
              onClick={() => navigate(-1)}
              className="rounded-full bg-white/80 backdrop-blur-sm shadow-md hover:bg-white border-none h-8 w-8 sm:h-10 sm:w-10"
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </div>

          {isBarberPortal && shopOwnerEmail === shop.ownerEmail && (
            <div className="absolute top-4 right-4 z-20">
              <Button
                onClick={() => setShowCustomizer(!showCustomizer)}
                variant="secondary"
                size="sm"
                className="gap-2 rounded-full bg-white/80 backdrop-blur-sm shadow-md hover:bg-white border-none h-8 px-3 sm:h-10 sm:px-4 text-[10px] sm:text-xs"
              >
                <Palette className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Customize</span>
              </Button>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          {/* Shop Customizer Modal/Section (Only in Barber Portal) */}
          {isBarberPortal && showCustomizer && shopOwnerEmail === shop.ownerEmail && (
            <ShopCustomizer shopId={shopId} shopOwnerEmail={shopOwnerEmail} />
          )}

          {/* Shop Identity Section */}
          <div className="space-y-2">
            <h1 className="text-xl sm:text-3xl font-bold tracking-tight">{shop.name}</h1>

            {/* Rating Display */}
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-3 w-3 sm:h-4 sm:w-4 ${star <= (reviews.length > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length) : 5)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-slate-300'
                    }`}
                />
              ))}
              <span className="text-[10px] sm:text-xs font-medium text-muted-foreground ml-1">
                {reviews.length > 0
                  ? `${(reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)} (${reviews.length} reviews)`
                  : '5.0 (Branded Quality)'}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-2">
              <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-primary shrink-0" />
              <span className="truncate">{shop.location}</span>
            </p>
          </div>

          {/* About Section */}
          {shop.about && customization?.enabledFeatures.showAbout && (
            <div className="space-y-3">
              <div className="space-y-2">
                <h2 className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-muted-foreground">About</h2>
                <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">{shop.about}</p>
              </div>

              {/* Action Buttons - Circular Icons Below About */}
              <div className="flex gap-4 justify-start pt-2">
                {/* Call Button */}
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full h-12 w-12 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all"
                  asChild
                >
                  <a href={`tel:${shop.ownerPhone}`}>
                    <Phone className="h-5 w-5" />
                  </a>
                </Button>

                {/* WhatsApp Button */}
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full h-12 w-12 hover:bg-green-500 hover:text-white hover:border-green-500 transition-all"
                  asChild
                >
                  <a
                    href={`https://wa.me/${shop.ownerPhone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle className="h-5 w-5" />
                  </a>
                </Button>

                {/* Instagram Button */}
                {(ownerProfile?.instagram_url || shop.instagramId) && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full h-12 w-12 hover:bg-slate-50 transition-all group overflow-hidden"
                    onClick={() => {
                      const url = ownerProfile?.instagram_url || `https://instagram.com/${shop.instagramId?.replace('@', '')}`;
                      window.open(url, '_blank');
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 transition-transform group-hover:scale-110" style={{ fill: 'url(#ig-gradient-shop)' }}>
                      <defs>
                        <linearGradient id="ig-gradient-shop" x1="0%" y1="100%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#f09433" />
                          <stop offset="25%" stopColor="#e6683c" />
                          <stop offset="50%" stopColor="#dc2743" />
                          <stop offset="75%" stopColor="#cc2366" />
                          <stop offset="100%" stopColor="#bc1888" />
                        </linearGradient>
                      </defs>
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm3.98-10.98a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                    </svg>
                  </Button>
                )}

                {/* Book Appointment Button */}
                {shop.isTokenBookingEnabled !== false && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full h-12 w-12 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all"
                    onClick={() => setShowBookingModal(true)}
                  >
                    <Calendar className="h-5 w-5" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Shop Interior Video (if any) */}
          {shop.shopInteriorVideoUrl && (
            <div className="rounded-xl overflow-hidden bg-black aspect-video shadow-lg">
              <video
                src={shop.shopInteriorVideoUrl}
                className="w-full h-full object-contain"
                controls
                poster={shop.shopImageUrl}
              />
            </div>
          )}

          {/* Consolidated Contact Section */}
          <div className="space-y-4">
            <h2 className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Phone className="h-3 w-3" />
              Contact Information
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Primary Contact */}
              <div className="group bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center text-red-600">
                    <Phone className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Primary Number</p>
                    <p className="text-sm font-black text-slate-900 dark:text-white">{shop.ownerPhone}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-10 w-10 rounded-full hover:bg-red-50 hover:text-red-600"
                    asChild
                  >
                    <a href={`tel:${shop.ownerPhone}`}>
                      <Phone className="h-5 w-5" />
                    </a>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-10 w-10 rounded-full hover:bg-green-50 hover:text-green-500"
                    asChild
                  >
                    <a
                      href={`https://wa.me/${shop.ownerPhone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="h-5 w-5" />
                    </a>
                  </Button>
                </div>
              </div>

              {/* Alternative Contact (if exists) */}
              {(shop as any).alternativePhone && (
                <div className="group bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center text-blue-600">
                      <Phone className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Alternative Number</p>
                      <p className="text-sm font-black text-slate-900 dark:text-white">{(shop as any).alternativePhone}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-10 w-10 rounded-full hover:bg-blue-50 hover:text-blue-600"
                      asChild
                    >
                      <a href={`tel:${(shop as any).alternativePhone}`}>
                        <Phone className="h-5 w-5" />
                      </a>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-10 w-10 rounded-full hover:bg-green-50 hover:text-green-500"
                      asChild
                    >
                      <a
                        href={`https://wa.me/${(shop as any).alternativePhone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessageCircle className="h-5 w-5" />
                      </a>
                    </Button>
                  </div>
                </div>
              )}

              {/* Booking Button (Full Width on Mobile) */}
              {shop.isTokenBookingEnabled !== false && (
                <Button
                  onClick={() => setShowBookingModal(true)}
                  className="sm:col-span-2 h-14 bg-red-600 hover:bg-red-700 font-black text-lg rounded-2xl shadow-xl shadow-red-500/20 group"
                >
                  <Calendar className="mr-2 h-6 w-6 group-hover:scale-110 transition-transform" />
                  BOOK AN APPOINTMENT NOW
                </Button>
              )}
            </div>
          </div>

          {/* Host Info */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-primary font-bold text-xs sm:text-sm shrink-0">
              {shop.ownerName[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase font-semibold">Hosted by</p>
              <p className="text-xs sm:text-sm font-bold truncate">{shop.ownerName}</p>
            </div>
            {shop.locationMapLink && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => window.open(shop.locationMapLink, '_blank')}
                className="text-primary hover:text-primary hover:bg-primary/5 h-8 w-8 sm:h-10 sm:w-10"
              >
                <MapPin className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            )}
          </div>


          {/* Document Printing Section */}
          {customization?.enabledFeatures.showPrinting && (
            <DocumentPrintingSection 
              shopId={shopId} 
              shopName={shop.name} 
              shopLat={shop.latitude}
              shopLng={shop.longitude}
              shopMapLink={shop.locationMapLink}
            />
          )}

          {/* Barber Members / Location Section */}
          {shop.barberMembers.length > 0 && customization?.enabledFeatures.showTeam && (
            <div className="space-y-3">
              <h2 className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-muted-foreground">Our Team</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {shop.barberMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex flex-col items-center p-3 rounded-xl bg-white dark:bg-gray-800/50 shadow-sm border border-slate-100 dark:border-slate-800"
                  >
                    <div className="relative mb-2">
                      {member.imageUrl ? (
                        <img
                          src={member.imageUrl}
                          alt={member.name}
                          className="h-16 w-16 sm:h-20 sm:w-20 rounded-full object-cover border-2 border-primary/20 shadow-md"
                        />
                      ) : (
                        <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-primary font-bold text-lg shadow-inner">
                          {member.name[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                    </div>
                    <h3 className="font-bold text-[10px] sm:text-xs text-center truncate w-full">{member.name}</h3>
                    <p className="text-[9px] sm:text-[10px] text-center text-muted-foreground truncate w-full">{member.experience}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Booked Tokens Section */}
          {shop.isTokenBookingEnabled !== false && (
            <div className="space-y-3">
              <h2 className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-muted-foreground">Recent Activity</h2>
              <Card className="border-0 shadow-sm bg-slate-50 dark:bg-slate-900/30">
                <CardContent className="p-3">
                  {bookings.length === 0 ? (
                    <p className="text-center text-[10px] sm:text-xs text-muted-foreground py-4">
                      No active bookings at the moment
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {bookings
                        .sort((a, b) => a.tokenNumber - b.tokenNumber)
                        .slice(0, 5) // Branded hotels only show top activity
                        .map((booking) => {
                          return (
                            <div
                              key={booking.id}
                              className="bg-white dark:bg-slate-800 p-2 rounded-lg flex items-center gap-3 border border-slate-100 dark:border-slate-700 shadow-sm"
                            >
                              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center text-[10px] sm:text-xs font-bold shrink-0">
                                #{booking.tokenNumber}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] sm:text-sm font-bold truncate">
                                  {booking.customerProfile?.name || booking.userName}
                                </p>
                                <p className="text-[9px] sm:text-[10px] text-muted-foreground">
                                  {booking.timeSlot}
                                </p>
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-[8px] sm:text-[9px] font-bold uppercase ${booking.status === 'in-progress' ? 'bg-red-100 text-red-600' :
                                  booking.status === 'completed' ? 'bg-green-100 text-green-600' :
                                    'bg-amber-100 text-amber-600'
                                }`}>
                                {booking.status}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Services Section */}
          {shop.services.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Services & Pricing</CardTitle>
                <CardDescription>Services we offer</CardDescription>
              </CardHeader>
              <CardContent className="p-0 sm:p-6">
                <div className="overflow-hidden sm:rounded-xl border border-red-100 dark:border-red-900/30">
                  <table className="w-full">
                    <thead className="bg-red-50 dark:bg-red-900/20">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">Service</th>
                        <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {shop.services.map((service) => (
                        <tr key={service.id} className="hover:bg-red-50/30 dark:hover:bg-red-900/10 transition-colors">
                          <td className="px-4 py-4 text-sm font-medium">{service.name}</td>
                          <td className="px-4 py-4 text-right text-sm font-bold text-red-600">₹{service.price}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Featured Products Section */}
          {!featuredProductsLoading && featuredProducts.length > 0 && customization?.enabledFeatures.showFeaturedProducts && (
            <Card className="border-0 shadow-sm bg-white dark:bg-slate-900/30">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <div className="bg-red-600 text-white rounded-full p-1 h-8 w-8 flex items-center justify-center">
                      <Star className="h-5 w-5 fill-white" />
                    </div>
                    Featured Products
                  </CardTitle>
                  <CardDescription>Check out our popular products</CardDescription>
                </div>
                <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 hidden sm:flex">
                  View All Products <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                  {featuredProducts.map((product) => {
                    const originalPrice = product.originalPrice;
                    const discount = product.discountPercentage;

                    return (
                      <div
                        key={product.id}
                        className="border border-border rounded-xl overflow-hidden hover:shadow-lg transition-all bg-white dark:bg-slate-800 flex flex-col h-full"
                      >
                        {/* Product Image */}
                        {product.imageUrl && (
                          <div className="relative aspect-square bg-slate-100 dark:bg-slate-700 overflow-hidden group">
                            <img
                              src={product.imageUrl}
                              alt={product.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 mix-blend-multiply dark:mix-blend-normal"
                            />
                            {discount && (
                              <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
                                -{discount}%
                              </div>
                            )}
                            <button className="absolute top-2 right-2 bg-white dark:bg-slate-800 rounded-full p-1.5 shadow-sm text-slate-400 hover:text-red-500 transition-colors">
                              <Heart className="h-4 w-4" />
                            </button>
                          </div>
                        )}

                        {/* Product Details */}
                        <div className="p-2 sm:p-3 flex-1 flex flex-col justify-between">
                          <div>
                            <h4 className="font-bold text-[10px] sm:text-sm capitalize line-clamp-1 mb-1">{product.title}</h4>

                            <div className="flex items-center gap-1 h-3">
                              {/* Fake reviews removed */}
                            </div>
                          </div>

                          <div className="mt-2">
                            <div className="flex items-baseline gap-1 sm:gap-2">
                              <span className="font-black text-red-600 text-xs sm:text-base">₹{product.price}</span>
                              {originalPrice && (
                                <span className="text-[8px] sm:text-[10px] text-muted-foreground line-through">₹{originalPrice}</span>
                              )}
                            </div>

                            <div className="flex items-center gap-1 sm:gap-2 mt-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 sm:h-8 sm:w-8 border-red-100 text-red-600 hover:bg-red-50 shrink-0"
                              >
                                <ShoppingCart className="h-3 w-3 sm:h-4 sm:w-4" />
                              </Button>
                              <Button
                                onClick={() => {
                                  setSelectedProduct(product);
                                  setShowOrderModal(true);
                                }}
                                className="flex-1 text-[9px] sm:text-[11px] font-bold bg-red-600 hover:bg-red-700 text-white h-7 sm:h-8 px-1 shadow-sm"
                              >
                                Order Now
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <Button variant="outline" className="w-full mt-4 text-red-600 border-red-200 hover:bg-red-50 sm:hidden">
                  View All Products <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Shop Offers Section */}
          {!offersLoading && shopOffers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  🎉 Active Offers
                </CardTitle>
                <CardDescription>Limited time promotions and discounts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {shopOffers.map((offer) => (
                    <div
                      key={offer.id}
                      className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-yellow-50 rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
                    >
                      {/* Offer Image */}
                      {offer.imageUrl && (
                        <div className="relative aspect-video bg-muted overflow-hidden">
                          <img
                            src={offer.imageUrl}
                            alt={offer.title}
                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                      )}

                      {/* Offer Details */}
                      <div className="p-4 space-y-3">
                        <div>
                          <h4 className="font-bold text-sm sm:text-base line-clamp-2 text-orange-900">{offer.title}</h4>
                          {offer.description && (
                            <p className="text-xs sm:text-sm text-orange-800 mt-1 line-clamp-2">
                              {offer.description}
                            </p>
                          )}
                        </div>

                        {/* Discount Badge */}
                        <div className="flex items-center justify-between">
                          <div className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                            {offer.discountPercentage ? `${offer.discountPercentage}% OFF` : `₹${offer.discountAmount?.toFixed(0)} OFF`}
                          </div>
                          <div className="text-xs text-orange-600 font-medium">
                            Expires: {formatIST(offer.validUntil, false)}
                          </div>
                        </div>

                        {/* Contact Button */}
                        <Button
                          onClick={() => {
                            const message = `Hi! I'm interested in the offer: ${offer.title}${offer.discountPercentage ? ` (${offer.discountPercentage}% off)` : ` (₹${offer.discountAmount} off)`}`;
                            window.open(`https://wa.me/${shopId}?text=${encodeURIComponent(message)}`, '_blank');
                          }}
                          className="w-full bg-green-500 hover:bg-green-600 text-white"
                          size="sm"
                        >
                          <MessageCircle className="h-4 w-4 mr-2" />
                          Ask About This Offer
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Temporary Chat Section */}
          {customization?.enabledFeatures.showChats && (
            <TemporaryChatSection shopId={shopId} onLoginRequired={onShowLogin} />
          )}

          {/* Reviews Section */}
          <div className="space-y-6">
            {/* Show Review Form or Button */}
            {currentUserId && !editingReview && !selectedReviewForReply && customization?.enabledFeatures.showReviews && (
              <>
                {!showReviewForm && !userHasReviewed ? (
                  <Button
                    onClick={() => setShowReviewForm(true)}
                    className="w-full bg-red-600 hover:bg-red-700 h-12 shadow-md shadow-red-500/20"
                  >
                    <Star className="mr-2 h-5 w-5" />
                    Share Your Review
                  </Button>
                ) : null}

                {showReviewForm && !userHasReviewed && (
                  <ReviewForm
                    shopId={shopId}
                    userId={currentUserId}
                    userEmail={currentUserEmail}
                    userName={currentUserName}
                    onReviewSubmitted={handleReviewSubmitted}
                    onCancel={() => setShowReviewForm(false)}
                  />
                )}
              </>
            )}

            {/* Edit Review Form */}
            {editingReview && customization?.enabledFeatures.showReviews && (
              <ReviewForm
                shopId={shopId}
                userId={currentUserId}
                userEmail={currentUserEmail}
                userName={currentUserName}
                existingReview={editingReview}
                onReviewSubmitted={handleReviewSubmitted}
                onCancel={() => setEditingReview(null)}
              />
            )}

            {/* Reply Form */}
            {selectedReviewForReply && currentUserId && (
              <ReviewReplyForm
                review={selectedReviewForReply}
                shopId={shopId}
                ownerId={currentUserId}
                onReplySubmitted={handleReplySubmitted}
                onCancel={() => setSelectedReviewForReply(null)}
              />
            )}

            {/* Reviews List */}
            {!reviewsLoading && customization?.enabledFeatures.showReviews && (
              <ReviewsList
                reviews={reviews}
                currentUserId={currentUserId}
                shopOwnerId={shopOwnerEmail === shop?.ownerEmail ? shopOwnerEmail : undefined}
                onDeleteReview={handleDeleteReview}
                onEditReview={setEditingReview}
                onReplyClick={setSelectedReviewForReply}
                averageRating={shop?.averageRating}
                totalReviews={shop?.totalReviews}
              />
            )}
          </div>

          {/* Contact Information */}
          <Card className="border-0 shadow-sm bg-slate-50 dark:bg-slate-900/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm sm:text-base">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground">Owner</p>
                  <p className="text-xs font-semibold">{shop.ownerName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground">Phone</p>
                  <a href={`tel:${shop.ownerPhone}`} className="text-xs font-semibold hover:underline">
                    {shop.ownerPhone}
                  </a>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground">Email</p>
                  <a href={`mailto:${shop.ownerEmail}`} className="text-xs font-semibold hover:underline">
                    {shop.ownerEmail}
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Close Button */}
          <div className="flex gap-3 pb-6">
            <Button onClick={onClose} variant="outline" className="w-full text-xs">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Shops
            </Button>
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      {showBookingModal && (
        <BookingModalNew
          shop={shop}
          onClose={() => setShowBookingModal(false)}
          onBookingCreated={() => {
            setShowBookingModal(false);
          }}
        />
      )}

      {/* Order Amount Modal */}
      {shop && (
        <OrderAmountModal
          isOpen={showOrderModal}
          onClose={() => {
            setShowOrderModal(false);
            setSelectedProduct(null);
          }}
          shopId={shop.id}
          shopName={shop.name}
          productName={selectedProduct?.title || 'Product'}
          productImage={selectedProduct?.imageUrl}
          productPrice={selectedProduct?.price ? parseFloat(String(selectedProduct.price)) : undefined}
          shopLat={shop.latitude ?? undefined}
          shopLng={shop.longitude ?? undefined}
          shopMapLink={shop.locationMapLink}
          initialAmount={selectedProduct?.price ? parseFloat(String(selectedProduct.price)) : 0}
        />
      )}

      {/* Reminder Alert Dialog */}
      {activeReminder && (
        <ReminderAlertDialog
          isOpen={true}
          shopName={activeReminder.shopName}
          serviceName={activeReminder.serviceName}
          bookingId={activeReminder.bookingId}
          onConfirm={() => confirmReminder(activeReminder)}
          onCancel={() => cancelReminder(activeReminder)}
        />
      )}
    </div>
  );
};
