import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getWebsiteBySlug, incrementViews, type WebsiteComponent } from '@/lib/supabase-shop-websites';
import { getShopById } from '@/lib/shops-storage';
import { getReviewsForShop } from '@/lib/supabase-reviews';
import { Button } from '@/components/ui/button';
import { Scissors, Star } from 'lucide-react';
import { toast } from 'react-hot-toast';

export function PublishedWebsite() {
  const { shopSlug } = useParams<{ shopSlug: string }>();
  const [website, setWebsite] = useState<any>(null);
  const [shopData, setShopData] = useState<any>(null);
  const [reviewsData, setReviewsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');

  useEffect(() => {
    console.log('🎯 PublishedWebsite component mounted with slug:', shopSlug);
    setDebugInfo(`Route matched! slug=${shopSlug}`);

    if (shopSlug) {
      loadWebsite();
    } else {
      console.error('❌ No shopSlug in params!');
      setError('No shop slug provided');
      setLoading(false);
    }
  }, [shopSlug]);

  const loadWebsite = async () => {
    try {
      setLoading(true);
      console.log('📍 Loading website for slug:', shopSlug);

      const data = await getWebsiteBySlug(shopSlug!);
      console.log('📍 Website data returned:', data);

      if (data) {
        setWebsite(data);
        console.log('✅ Website loaded successfully');

        // Increment views
        try {
          await incrementViews(data.id);
        } catch (viewErr) {
          console.warn('⚠️ Failed to increment views:', viewErr);
        }

        // Load extra data for advanced components
        try {
          const shop = await getShopById(data.shop_id);
          setShopData(shop);
          console.log('✅ Shop data loaded');
        } catch (shopErr) {
          console.warn('⚠️ Failed to load shop data:', shopErr);
        }

        try {
          const reviews = await getReviewsForShop(data.shop_id);
          setReviewsData(reviews);
          console.log('✅ Reviews loaded');
        } catch (revErr) {
          console.warn('⚠️ Failed to load reviews:', revErr);
        }
      } else {
        console.error('❌ Website not found for slug:', shopSlug);
        setError(`Website not found for slug: ${shopSlug}`);
      }
    } catch (err) {
      console.error('❌ Error loading website:', err);
      setError(`Failed to load website: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin h-8 w-8 border-4 border-red-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !website) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 text-center">
        <Scissors className="h-16 w-16 text-gray-300 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{error || 'Website Not Found'}</h1>
        <p className="text-gray-600 mb-6">The website you're looking for doesn't exist or hasn't been published yet.</p>

        {/* Debug Info */}
        <div className="bg-gray-100 rounded-lg p-4 text-left max-w-md mb-6 text-xs font-mono">
          <p className="text-gray-700 mb-2"><strong>Debug Info:</strong></p>
          <p>shopSlug: {shopSlug}</p>
          <p>Error: {error}</p>
          <p className="text-gray-500 mt-2">Check browser console (F12) for more details</p>
        </div>

        <Button onClick={() => window.location.href = '/'}>Go Home</Button>
      </div>
    );
  }

  // Parse layout_json if it's a string
  let layoutData: any = website.layout_json;
  if (typeof layoutData === 'string') {
    try {
      layoutData = JSON.parse(layoutData);
      console.log('✅ Parsed JSON string:', layoutData);
    } catch (e) {
      console.error('❌ Failed to parse layout_json:', e);
      layoutData = { components: [] };
    }
  }

  const components: WebsiteComponent[] = layoutData.components || [];

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-md mx-auto min-h-screen bg-white shadow-sm flex flex-col">
        {components.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <p>This website has no content yet.</p>
          </div>
        ) : (
          <div className="p-0 space-y-0">
            {components.map((comp) => (
              <div
                key={comp.id}
                className="p-0"
                style={{
                  textAlign: comp.styles.alignment,
                  padding: `${comp.styles.padding || 0}px 16px`
                }}
              >
                {comp.type === 'text' && (
                  <div style={{
                    fontSize: `${comp.styles.fontSize}px`,
                    color: comp.styles.color,
                    fontWeight: comp.styles.fontWeight,
                    fontFamily: comp.styles.fontFamily || 'inherit',
                    backgroundColor: comp.styles.backgroundColor
                  }}>
                    {comp.content}
                  </div>
                )}

                {comp.type === 'image' && (
                  <img 
                    src={comp.content} 
                    alt="Website content" 
                    className="max-w-full mx-auto"
                    style={{ 
                      borderRadius: `${comp.styles.borderRadius}px`,
                      width: comp.styles.width || '100%'
                    }} 
                  />
                )}

                {comp.type === 'button' && (
                  <button
                    className="px-6 py-2 font-medium transition-transform active:scale-95"
                    style={{
                      backgroundColor: comp.styles.backgroundColor,
                      color: comp.styles.color,
                      borderRadius: `${comp.styles.borderRadius}px`,
                      padding: `${comp.styles.padding}px 24px`
                    }}
                    onClick={() => {
                      // In a real app, this might open the booking modal or a link
                      toast.success('Booking functionality coming soon to this website!');
                    }}
                  >
                    {comp.content}
                  </button>
                )}

                {comp.type === 'divider' && (
                  <div
                    style={{
                      height: comp.styles.height || '1px',
                      backgroundColor: comp.styles.backgroundColor || '#e2e8f0',
                      margin: `${comp.styles.padding || 20}px 0`
                    }}
                  />
                )}

                {comp.type === 'gallery' && (
                  <div className="grid grid-cols-2 gap-3" style={{ padding: `${comp.styles.padding || 0}px 0` }}>
                    {(comp.content as string[]).map((url, i) => (
                      <img key={i} src={url} alt="Gallery" className="w-full h-48 object-cover rounded-xl shadow-md" />
                    ))}
                  </div>
                )}

                {comp.type === 'services' && (
                  <div className="rounded-2xl overflow-hidden border shadow-sm" style={{ backgroundColor: comp.styles.backgroundColor, padding: `${comp.styles.padding || 20}px` }}>
                    <h4 className="font-bold mb-4 text-xl" style={{ color: comp.styles.color }}>Price List</h4>
                    <div className="space-y-3">
                      {shopData?.services?.map((s: any) => (
                        <div key={s.id} className="flex justify-between py-2 border-b border-gray-100 last:border-0 text-sm">
                          <span className="font-medium">{s.name}</span>
                          <span className="font-bold text-red-500">{s.price}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {comp.type === 'reviews' && (
                  <div className="space-y-4" style={{ padding: `${comp.styles.padding || 0}px 0` }}>
                    <h4 className="font-bold text-xl flex items-center gap-2">
                      <Star className="w-6 h-6 text-amber-500 fill-amber-500" /> What Customers Say
                    </h4>
                    <div className="grid gap-3">
                      {reviewsData?.slice(0, 3).map((r: any) => (
                        <div key={r.id} className="bg-gray-50 p-4 rounded-xl border border-gray-100 shadow-sm">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-sm text-gray-900">{r.userName}</span>
                            <div className="flex text-amber-400">
                              {Array.from({ length: r.rating }).map((_, i) => (
                                <Star key={i} className="w-3 h-3 fill-amber-400" />
                              ))}
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 italic leading-relaxed">"{r.reviewText}"</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
