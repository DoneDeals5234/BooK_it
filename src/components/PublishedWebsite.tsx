import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getWebsiteBySubdomainOrDomain, incrementViews, type WebsiteComponent } from '@/lib/supabase-shop-websites';
import { getShopById } from '@/lib/shops-storage';
import { getReviewsForShop } from '@/lib/supabase-reviews';
import { getFeaturedProductsByShopId } from '@/lib/supabase-featured-products';
import { Button } from '@/components/ui/button';
import { Scissors, Star, ShoppingBag } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface WebsitePage {
  id: string;
  name: string;
  slug: string;
  components: WebsiteComponent[];
}

export function PublishedWebsite({ subdomainProp }: { subdomainProp?: string }) {
  const { shopSlug } = useParams<{ shopSlug: string }>();
  const activeSubdomain = subdomainProp || shopSlug;
  const [website, setWebsite] = useState<any>(null);
  const [shopData, setShopData] = useState<any>(null);
  const [reviewsData, setReviewsData] = useState<any[]>([]);
  const [productsData, setProductsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<WebsitePage[]>([]);
  const [activePageId, setActivePageId] = useState<string>('home');

  useEffect(() => {
    if (activeSubdomain) {
      loadWebsite();
    } else {
      setError('No shop identifier provided');
      setLoading(false);
    }
  }, [activeSubdomain]);

  const loadWebsite = async () => {
    try {
      setLoading(true);
      const data = await getWebsiteBySubdomainOrDomain(activeSubdomain!);

      if (data) {
        setWebsite(data);
        await incrementViews(data.id).catch(() => {});

        // Parse layout
        let layoutData: any = data.layout_json;
        if (typeof layoutData === 'string') {
          try { layoutData = JSON.parse(layoutData); } catch {}
        }

        // Support both multi-page and legacy single-page
        if (layoutData?.pages) {
          setPages(layoutData.pages);
        } else if (layoutData?.components) {
          setPages([{ id: 'home', name: 'Home', slug: '/', components: layoutData.components }]);
        }

        // Load shop data
        try {
          const shop = await getShopById(data.shop_id);
          setShopData(shop);
        } catch {}

        try {
          const reviews = await getReviewsForShop(data.shop_id);
          setReviewsData(reviews);
        } catch {}

        try {
          const products = await getFeaturedProductsByShopId(data.shop_id);
          setProductsData(products);
        } catch {}
      } else {
        setError(`Website not found for: ${activeSubdomain}`);
      }
    } catch (err) {
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
        <div className="bg-gray-100 rounded-lg p-4 text-left max-w-md mb-6 text-xs font-mono">
          <p className="text-gray-700 mb-2"><strong>Debug Info:</strong></p>
          <p>shopSlug: {shopSlug}</p>
          <p>Error: {error}</p>
        </div>
        <Button onClick={() => window.location.href = '/'}>Go Home</Button>
      </div>
    );
  }

  const activePage = pages.find(p => p.id === activePageId) || pages[0];
  const hasNavbar = pages.length > 1 || activePage?.components.some(c => c.type === 'navbar');

  const handleButtonClick = (comp: WebsiteComponent) => {
    if (!comp.linkTo) {
      toast.success('Booking functionality coming soon!');
      return;
    }
    if (comp.linkTo === '__whatsapp') {
      const phone = shopData?.phone || '';
      window.open(`https://wa.me/${phone}`, '_blank');
    } else if (comp.linkTo === '__call') {
      window.location.href = `tel:${shopData?.phone || ''}`;
    } else if (comp.linkTo === '__booking') {
      toast.success('Booking coming soon!');
    } else {
      // Navigate to a page
      setActivePageId(comp.linkTo);
    }
  };

  const renderComponent = (comp: WebsiteComponent) => {
    switch (comp.type) {
      case 'text':
        return (
          <div style={{
            fontSize: `${comp.styles.fontSize}px`,
            color: comp.styles.color,
            fontWeight: comp.styles.fontWeight,
            fontFamily: comp.styles.fontFamily || 'inherit',
            backgroundColor: comp.styles.backgroundColor,
            padding: `${comp.styles.padding || 0}px 16px`,
            textAlign: comp.styles.alignment,
          }}>
            {comp.content}
          </div>
        );

      case 'image':
        return (
          <img
            src={comp.content}
            alt="Website content"
            className="max-w-full mx-auto"
            style={{
              borderRadius: `${comp.styles.borderRadius}px`,
              width: comp.styles.width || '100%',
            }}
          />
        );

      case 'button':
        return (
          <div style={{ textAlign: comp.styles.alignment || 'center', padding: `${comp.styles.padding || 12}px 16px` }}>
            <button
              className="font-semibold transition-transform active:scale-95 shadow-sm"
              style={{
                backgroundColor: comp.styles.backgroundColor,
                color: comp.styles.color,
                borderRadius: `${comp.styles.borderRadius}px`,
                padding: `${comp.styles.padding || 12}px 28px`,
              }}
              onClick={() => handleButtonClick(comp)}
            >
              {comp.content}
            </button>
          </div>
        );

      case 'divider':
        return (
          <div style={{
            height: comp.styles.height || '1px',
            backgroundColor: comp.styles.backgroundColor || '#e2e8f0',
            margin: `${comp.styles.padding || 20}px 16px`,
          }} />
        );

      case 'gallery':
        return (
          <div className="grid grid-cols-2 gap-3 px-4" style={{ padding: `${comp.styles.padding || 10}px 16px` }}>
            {(comp.content as string[]).map((url, i) => (
              <img key={i} src={url} alt="Gallery" className="w-full h-48 object-cover rounded-xl shadow-md" />
            ))}
          </div>
        );

      case 'services':
        return (
          <div className="rounded-2xl overflow-hidden border shadow-sm mx-4" style={{ backgroundColor: comp.styles.backgroundColor, padding: `${comp.styles.padding || 20}px` }}>
            <h4 className="font-bold mb-4 text-xl" style={{ color: comp.styles.color }}>Price List</h4>
            <div className="space-y-3">
              {shopData?.services?.map((s: any) => (
                <div key={s.id} className="flex justify-between py-2 border-b border-gray-100 last:border-0 text-sm">
                  <span className="font-medium">{s.name}</span>
                  <span className="font-bold text-red-500">{s.price}</span>
                </div>
              )) || <p className="text-sm text-gray-400">No services listed</p>}
            </div>
          </div>
        );

      case 'reviews':
        return (
          <div className="space-y-4 px-4" style={{ padding: `${comp.styles.padding || 0}px 16px` }}>
            <h4 className="font-bold text-xl flex items-center gap-2">
              <Star className="w-6 h-6 text-amber-500 fill-amber-500" /> What Customers Say
            </h4>
            <div className="grid gap-3">
              {reviewsData?.slice(0, 3).map((r: any) => (
                <div key={r.id} className="bg-gray-50 p-4 rounded-xl border border-gray-100 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-sm text-gray-900">{r.userName}</span>
                    <div className="flex text-amber-400">
                      {Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="w-3 h-3 fill-amber-400" />)}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 italic leading-relaxed">"{r.reviewText}"</p>
                </div>
              )) || <p className="text-sm text-gray-400">No reviews yet</p>}
            </div>
          </div>
        );

      case 'products':
        return (
          <div style={{ backgroundColor: comp.styles.backgroundColor, padding: `${comp.styles.padding || 20}px 16px` }}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-xl flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-orange-500" /> Our Products
              </h4>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(productsData.length > 0 ? productsData : []).slice(0, 6).map((p: any) => (
                <div key={p.id} className="bg-white rounded-xl border shadow-sm overflow-hidden active:scale-95 transition-transform cursor-pointer">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.title} className="w-full h-32 object-cover" />
                  ) : (
                    <div className="w-full h-32 bg-gray-100 flex items-center justify-center">
                      <ShoppingBag className="w-8 h-8 text-gray-300" />
                    </div>
                  )}
                  <div className="p-2">
                    <p className="text-xs font-bold text-gray-800 truncate">{p.title}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-sm font-black text-orange-600">₹{p.price}</span>
                      {p.originalPrice && (
                        <span className="text-[10px] text-gray-400 line-through">₹{p.originalPrice}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {productsData.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-4">No products available</p>
            )}
          </div>
        );

      case 'navbar':
        return (
          <div
            className="flex items-center justify-between px-4 shadow-sm sticky top-0 z-10"
            style={{
              backgroundColor: comp.styles.backgroundColor || '#ffffff',
              color: comp.styles.color || '#000000',
              padding: `${comp.styles.padding || 15}px 16px`,
            }}
          >
            <span className="font-black text-base" style={{ color: comp.styles.color }}>{shopData?.name || ''}</span>
            <div className="flex gap-4">
              {pages.map(p => (
                <button
                  key={p.id}
                  onClick={() => setActivePageId(p.id)}
                  className="text-xs font-semibold transition-opacity"
                  style={{
                    color: comp.styles.color,
                    opacity: activePageId === p.id ? 1 : 0.6,
                    textDecoration: activePageId === p.id ? 'underline' : 'none',
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-md mx-auto min-h-screen bg-white shadow-sm flex flex-col">

        {/* Multi-page navbar (if multiple pages and no navbar component) */}
        {pages.length > 1 && !activePage?.components.some(c => c.type === 'navbar') && (
          <div className="bg-white border-b sticky top-0 z-10 flex overflow-x-auto gap-1 px-3 py-2 shadow-sm no-scrollbar">
            {pages.map(p => (
              <button
                key={p.id}
                onClick={() => setActivePageId(p.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                  activePageId === p.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}

        {/* Page components */}
        {activePage ? (
          activePage.components.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <p>This page has no content yet.</p>
            </div>
          ) : (
            <div className="space-y-0">
              {activePage.components.map((comp) => (
                <div key={comp.id}>
                  {renderComponent(comp)}
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <p>No pages found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
