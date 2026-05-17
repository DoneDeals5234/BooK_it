import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Save, Globe, Eye, Trash2, Move, Type, Image as ImageIcon, Minus, Square, Upload, BarChart2, Smartphone, Monitor, Settings, Crown, Star, List, Copy, Share2, Download, Package, Layout } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { uploadWebsiteImage } from '@/lib/supabase-storage';
import { getShopById } from '@/lib/shops-storage';
import { getReviewsForShop } from '@/lib/supabase-reviews';
import { getLatestPlanForEmail, type PlanName } from '@/lib/supabase-shop-owner-plans';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { toast } from 'react-hot-toast';
import {
  saveWebsiteDraft,
  publishWebsite,
  getWebsiteByShopId,
  updateVercelDetails,
  type WebsiteComponent
} from '@/lib/supabase-shop-websites';
import { supabase } from '@/lib/supabase';

interface WebsiteBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  shopId: string;
  shopName: string;
}

const BASIC_COMPONENTS = [
  {
    id: 'text',
    name: 'Text',
    icon: <Type className="w-4 h-4" />,
    default: {
      type: 'text' as const,
      content: 'Click to edit text',
      styles: { fontSize: 16, alignment: 'left' as const, color: '#333333' }
    }
  },
  {
    id: 'image',
    name: 'Image',
    icon: <ImageIcon className="w-4 h-4" />,
    default: {
      type: 'image' as const,
      content: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&auto=format&fit=crop',
      styles: { width: '100%', borderRadius: 8 }
    }
  },
  {
    id: 'button',
    name: 'Button',
    icon: <Square className="w-4 h-4" />,
    default: {
      type: 'button' as const,
      content: 'Book Now',
      styles: { backgroundColor: '#ef4444', color: '#ffffff', borderRadius: 4, padding: 12, alignment: 'center' as const }
    }
  },
  {
    id: 'divider',
    name: 'Divider',
    icon: <Minus className="w-4 h-4" />,
    default: {
      type: 'divider' as const,
      content: '',
      styles: { height: '1px', backgroundColor: '#e2e8f0', padding: 20 }
    }
  },
];

const ADVANCED_COMPONENTS = [
  {
    id: 'gallery',
    name: 'Gallery',
    icon: <ImageIcon className="w-4 h-4 text-purple-500" />,
    default: {
      type: 'gallery' as const,
      content: [
        'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=400',
        'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400'
      ],
      styles: { padding: 10 }
    }
  },
  {
    id: 'services',
    name: 'Services',
    icon: <List className="w-4 h-4 text-purple-500" />,
    default: {
      type: 'services' as const,
      content: 'shop_data',
      styles: { backgroundColor: '#f9fafb', padding: 20, color: '#333333' }
    }
  },
  {
    id: 'reviews',
    name: 'Reviews',
    icon: <Star className="w-4 h-4 text-purple-500" />,
    default: {
      type: 'reviews' as const,
      content: 'shop_reviews',
      styles: { padding: 20 }
    }
  },
  {
    id: 'products',
    name: 'Products',
    icon: <Package className="w-4 h-4 text-purple-500" />,
    default: {
      type: 'products' as const,
      content: 'featured_products',
      styles: { padding: 20, backgroundColor: '#ffffff' }
    }
  },
  {
    id: 'navbar',
    name: 'Navigation',
    icon: <Layout className="w-4 h-4 text-purple-500" />,
    default: {
      type: 'navbar' as const,
      content: 'Navigation Bar',
      styles: { backgroundColor: '#ffffff', color: '#000000', padding: 15 }
    }
  }
];

interface WebsitePage {
  id: string;
  name: string;
  slug: string;
  components: WebsiteComponent[];
}

export function WebsiteBuilder({ isOpen, onClose, shopId, shopName }: WebsiteBuilderProps) {
  const [pages, setPages] = useState<WebsitePage[]>([{ id: 'home', name: 'Home', slug: '/', components: [] }]);
  const [activePageId, setActivePageId] = useState<string>('home');
  
  const activePage = pages.find(p => p.id === activePageId) || pages[0];
  const components = activePage.components;
  
  const setComponents = (newComponents: WebsiteComponent[] | ((prev: WebsiteComponent[]) => WebsiteComponent[])) => {
    setPages(prevPages => {
      const active = prevPages.find(p => p.id === activePageId) || prevPages[0];
      const resolved = typeof newComponents === 'function' ? newComponents(active.components) : newComponents;
      return prevPages.map(p => p.id === active.id ? { ...p, components: resolved } : p);
    });
  };
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [activeTab, setActiveTab] = useState('editor');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fullWebsiteUrl, setFullWebsiteUrl] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [websiteStats, setWebsiteStats] = useState<{ views: number; publishedAt?: string } | null>(null);
  const [viewMode, setViewMode] = useState<'mobile' | 'desktop'>('mobile');
  const [customDomain, setCustomDomain] = useState('');
  const [vercelSubdomain, setVercelSubdomain] = useState('');
  const [vercelUrl, setVercelUrl] = useState<string | null>(null);
  const [vercelDeploymentId, setVercelDeploymentId] = useState<string | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [shopData, setShopData] = useState<any>(null);
  const [reviewsData, setReviewsData] = useState<any[]>([]);
  const [userPlan, setUserPlan] = useState<PlanName>('basic');
  const [showShareModal, setShowShareModal] = useState(false);
  const { user } = useAuth();

  // Helper function to copy to clipboard with fallback
  const copyToClipboard = (text: string, label: string = 'URL') => {
    try {
      // Try modern Clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          toast.success(`${label} copied to clipboard!`);
        }).catch(() => {
          // Fallback to old method
          copyToClipboardFallback(text, label);
        });
      } else {
        // Fallback for older browsers
        copyToClipboardFallback(text, label);
      }
    } catch (error) {
      console.error('Failed to copy:', error);
      copyToClipboardFallback(text, label);
    }
  };

  // Fallback method using textarea and execCommand
  const copyToClipboardFallback = (text: string, label: string = 'URL') => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      toast.success(`${label} copied to clipboard!`);
    } catch (error) {
      console.error('Fallback copy failed:', error);
      toast.error('Failed to copy - please copy manually from the URL field');
    }
  };

  // Generate QR code URL using online service
  const generateQRCode = (url: string) => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;
    return qrUrl;
  };

  // Share function for social and messaging apps
  const handleShare = async () => {
    if (!fullWebsiteUrl) return;

    const shareData = {
      title: `Visit ${shopName}'s Website`,
      text: `Check out the amazing website of ${shopName}! Built with our website builder.`,
      url: fullWebsiteUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback: copy to clipboard
        copyToClipboard(fullWebsiteUrl, 'Website URL');
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Error sharing:', error);
      }
    }
  };

  // Download QR code
  const downloadQRCode = () => {
    if (!qrCodeUrl) return;
    const link = document.createElement('a');
    link.href = qrCodeUrl;
    link.download = `${shopName}-qr-code.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const TEMPLATES = [
    {
      name: 'Modern Barber',
      components: [
        { id: '1', type: 'text', content: 'Welcome to ' + shopName, styles: { fontSize: 32, alignment: 'center', fontWeight: 'bold' }, position: { x: 0, y: 0, order: 0 } },
        { id: '2', type: 'image', content: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800', styles: { borderRadius: 12, width: '100%' }, position: { x: 0, y: 0, order: 1 } },
        { id: '3', type: 'text', content: 'The best grooming experience in town.', styles: { fontSize: 18, alignment: 'center' }, position: { x: 0, y: 0, order: 2 } },
        { id: '4', type: 'button', content: 'Book an Appointment', styles: { backgroundColor: '#ef4444', color: '#ffffff', borderRadius: 8, padding: 14, alignment: 'center' }, position: { x: 0, y: 0, order: 3 } },
      ]
    },
    {
      name: 'Classic Style',
      components: [
        { id: '1', type: 'text', content: shopName, styles: { fontSize: 40, alignment: 'center', color: '#1a1a1a', fontWeight: 'bolder' }, position: { x: 0, y: 0, order: 0 } },
        { id: '2', type: 'divider', content: '', styles: { height: '2px', backgroundColor: '#1a1a1a', padding: 10 }, position: { x: 0, y: 0, order: 1 } },
        { id: '3', type: 'text', content: 'EST. 2024', styles: { fontSize: 14, alignment: 'center' }, position: { x: 0, y: 0, order: 2 } },
        { id: '4', type: 'image', content: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800', styles: { borderRadius: 0, width: '100%' }, position: { x: 0, y: 0, order: 3 } },
        { id: '5', type: 'button', content: 'View Services', styles: { backgroundColor: '#000000', color: '#ffffff', borderRadius: 0, padding: 12, alignment: 'center' }, position: { x: 0, y: 0, order: 4 } },
      ]
    },
    {
      name: 'Minimalist',
      components: [
        { id: '1', type: 'text', content: shopName, styles: { fontSize: 24, alignment: 'left', color: '#333333', fontWeight: 'bold' }, position: { x: 0, y: 0, order: 0 } },
        { id: '2', type: 'divider', content: '', styles: { height: '1px', backgroundColor: '#eeeeee', padding: 10 }, position: { x: 0, y: 0, order: 1 } },
        { id: '3', type: 'text', content: 'Clean cuts for a clean life.', styles: { fontSize: 16, alignment: 'left', color: '#666666' }, position: { x: 0, y: 0, order: 2 } },
        { id: '4', type: 'button', content: 'Book Now', styles: { backgroundColor: '#333333', color: '#ffffff', borderRadius: 4, padding: 10, alignment: 'left' }, position: { x: 0, y: 0, order: 3 } },
      ]
    },
    {
      name: 'Dark Mode',
      components: [
        { id: '1', type: 'text', content: shopName, styles: { fontSize: 36, alignment: 'center', color: '#ffffff', fontWeight: 'bold', backgroundColor: '#121212', padding: 20 }, position: { x: 0, y: 0, order: 0 } },
        { id: '2', type: 'image', content: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=800', styles: { borderRadius: 0, width: '100%' }, position: { x: 0, y: 0, order: 1 } },
        { id: '3', type: 'text', content: 'Premium Grooming After Dark.', styles: { fontSize: 20, alignment: 'center', color: '#ffffff', backgroundColor: '#121212', padding: 15 }, position: { x: 0, y: 0, order: 2 } },
        { id: '4', type: 'button', content: 'Secure Slot', styles: { backgroundColor: '#ffcc00', color: '#000000', borderRadius: 0, padding: 15, alignment: 'center' }, position: { x: 0, y: 0, order: 3 } },
      ]
    },
    {
      name: 'Vibrant Salon',
      components: [
        { id: '1', type: 'text', content: 'Welcome to ' + shopName, styles: { fontSize: 32, alignment: 'center', color: '#ffffff', backgroundColor: '#ec4899', padding: 30, fontWeight: 'bold' }, position: { x: 0, y: 0, order: 0 } },
        { id: '2', type: 'text', content: 'Style • Beauty • Confidence', styles: { fontSize: 18, alignment: 'center', color: '#ec4899', padding: 10 }, position: { x: 0, y: 0, order: 1 } },
        { id: '3', type: 'image', content: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800', styles: { borderRadius: 24, width: '100%' }, position: { x: 0, y: 0, order: 2 } },
        { id: '4', type: 'button', content: 'Book Session', styles: { backgroundColor: '#ec4899', color: '#ffffff', borderRadius: 20, padding: 15, alignment: 'center' }, position: { x: 0, y: 0, order: 3 } },
      ]
    }
  ];

  const FONTS = [
    { label: 'Sans (Modern)', value: 'sans-serif' },
    { label: 'Serif (Classic)', value: 'serif' },
    { label: 'Mono (Clean)', value: 'monospace' },
    { label: 'Inter (UI)', value: 'Inter, sans-serif' },
    { label: 'Display (Bold)', value: 'system-ui' },
  ];

  const loadTemplate = (template: any) => {
    setComponents(template.components.map((c: any) => ({ ...c, id: Math.random().toString(36).substr(2, 9) })));
    toast.success(`${template.name} template applied!`);
  };

  useEffect(() => {
    if (isOpen) {
      loadWebsite();
    }
  }, [isOpen]);

  const loadWebsite = async () => {
    try {
      const data = await getWebsiteByShopId(shopId);
      if (data) {
        if (data.layout_json) {
          if (data.layout_json.pages) {
            setPages(data.layout_json.pages);
          } else if (data.layout_json.components) {
            setPages([{ id: 'home', name: 'Home', slug: '/', components: data.layout_json.components }]);
          }
        }
        setCustomDomain(data.custom_domain || '');
        setVercelSubdomain(data.custom_subdomain || '');
        setVercelUrl(data.vercel_url || null);
        setVercelDeploymentId(data.vercel_deployment_id || null);

        if (data.is_published) {
          setPreviewUrl(`/shop/${data.shop_name}`);
          setFullWebsiteUrl(data.vercel_url || `${window.location.origin}/shop/${data.shop_name}`);
          setWebsiteStats({
            views: data.views_count,
            publishedAt: data.published_at
          });
        }
      }

      // Load shop context
      const shop = await getShopById(shopId);
      setShopData(shop);

      const reviews = await getReviewsForShop(shopId);
      setReviewsData(reviews);

      if (user?.email) {
        const plan = await getLatestPlanForEmail(user.email);
        setUserPlan(plan?.plan_name || 'basic');
      }
    } catch (error) {
      console.error('Error loading website:', error);
    }
  };

  const handleUpgrade = async () => {
    toast.loading('Redirecting to payment...');
    // In a real app, this would trigger Razorpay
    setTimeout(() => {
      setUserPlan('premium');
      toast.dismiss();
      toast.success('Successfully upgraded to PREMIUM!');
    }, 2000);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, componentId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const toastId = toast.loading('Uploading image...');
    try {
      const publicUrl = await uploadWebsiteImage(shopId, file);
      updateComponent(componentId, { content: publicUrl });
      toast.success('Image uploaded successfully!', { id: toastId });
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload image', { id: toastId });
    }
  };

  const addComponent = (type: any) => {
    const isAdvanced = ADVANCED_COMPONENTS.some(c => c.id === type);
    if (isAdvanced && userPlan !== 'premium') {
      toast.error('Premium components require a PREMIUM plan!');
      return;
    }

    const componentType = [...BASIC_COMPONENTS, ...ADVANCED_COMPONENTS].find(c => c.id === type);
    if (!componentType) return;

    const newComponent: WebsiteComponent = {
      id: Math.random().toString(36).substr(2, 9),
      type: type as any,
      content: componentType.default.content,
      styles: { ...componentType.default.styles },
      position: { x: 0, y: 0, order: components.length }
    };

    setComponents([...components, newComponent]);
    setSelectedId(newComponent.id);
  };

  const removeComponent = (id: string) => {
    setComponents(components.filter(c => c.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const updateComponent = (id: string, updates: Partial<WebsiteComponent>) => {
    setComponents(components.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save both new `pages` format AND legacy `components` (home page) for backward compat
      const homeComponents = pages.find(p => p.id === 'home')?.components || components;
      await saveWebsiteDraft(shopId, shopName, { pages, defaultPage: 'home', components: homeComponents });
      toast.success('Draft saved successfully!');
    } catch (error) {
      console.error('Save error:', error);
      let errorMessage = 'Failed to save draft';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        errorMessage = JSON.stringify(error);
      }

      console.error('Error details:', errorMessage);
      toast.error(errorMessage || 'Failed to save draft');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (customDomain && userPlan !== 'premium') {
      toast.error('Custom domains require a PREMIUM plan!');
      return;
    }

    setIsPublishing(true);
    try {
      // Save both new `pages` format AND legacy `components` for backward compat with old builds
      const homeComponents = pages.find(p => p.id === 'home')?.components || components;
      const data = await publishWebsite(shopId, shopName, { pages, defaultPage: 'home', components: homeComponents }, customDomain);
      const slug = data.shop_name;
      const relativePath = `/shop/${slug}`;

      // Generate full URL: prefer claimed subdomain, custom domain, or fallback to relative path
      const subdomainToUse = vercelSubdomain || data.custom_subdomain;
      const fullUrl = subdomainToUse
        ? `https://${subdomainToUse}.donedeals.shop`
        : (customDomain ? `https://${customDomain}` : `${window.location.origin}/shop/${slug}`);

      setPreviewUrl(relativePath);
      setFullWebsiteUrl(fullUrl);

      // Generate QR code
      const qrUrl = generateQRCode(fullUrl);
      setQrCodeUrl(qrUrl);

      // Show success notification with URL
      toast.success(`Website published successfully!`, { duration: 4 });

      // Open share modal automatically
      setTimeout(() => setShowShareModal(true), 500);
    } catch (error) {
      console.error('Publish error:', error);
      let errorMessage = 'Failed to publish website';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        errorMessage = JSON.stringify(error);
      }

      console.error('Error details:', errorMessage);
      toast.error(errorMessage || 'Failed to publish website');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleVercelDeploy = async (isSilent = false) => {
    if (!vercelSubdomain) {
      toast.error('Please enter a subdomain!');
      return;
    }

    if (!isSilent) setIsDeploying(true);
    const toastId = !isSilent ? toast.loading('Claiming subdomain under donedeals.shop...') : null;

    try {
      // 1. Check if the subdomain is already taken by another shop
      const { data: existing, error: checkError } = await supabase
        .from('shop_websites')
        .select('shop_id, shop_name')
        .eq('custom_subdomain', vercelSubdomain)
        .neq('shop_id', shopId)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existing) {
        if (!isSilent) toast.error('This subdomain is already taken by another shop!', { id: toastId! });
        setIsDeploying(false);
        return;
      }

      // 2. Update subdomain and vercel_url in the database
      const finalUrl = `https://${vercelSubdomain}.donedeals.shop`;
      const { error: updateError } = await supabase
        .from('shop_websites')
        .update({
          custom_subdomain: vercelSubdomain,
          vercel_url: finalUrl,
          is_published: true, // Auto publish on claim!
          updated_at: new Date().toISOString(),
        })
        .eq('shop_id', shopId);

      if (updateError) throw updateError;

      setVercelUrl(finalUrl);
      setFullWebsiteUrl(finalUrl);
      
      // Generate QR code
      const qrUrl = generateQRCode(finalUrl);
      setQrCodeUrl(qrUrl);

      if (!isSilent) {
        toast.success('Congratulations! Your website is instantly LIVE under donedeals.shop!', { id: toastId! });
      }
    } catch (error: any) {
      console.error('Subdomain claim error:', error);
      if (!isSilent) toast.error(error.message || 'Failed to claim subdomain', { id: toastId! });
    } finally {
      if (!isSilent) setIsDeploying(false);
    }
  };

  const selectedComponent = components.find(c => c.id === selectedId);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="p-4 border-b flex flex-row items-center justify-between">
          <div>
            <DialogTitle>Website Builder - {shopName}</DialogTitle>
            <p className="text-sm text-gray-500">Customize your shop's public profile</p>
          </div>
          <div className="flex gap-2">
            <div className="flex border rounded-lg overflow-hidden mr-4">
              <Button
                variant={viewMode === 'mobile' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none px-3"
                onClick={() => setViewMode('mobile')}
              >
                <Smartphone className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'desktop' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none px-3"
                onClick={() => setViewMode('desktop')}
              >
                <Monitor className="w-4 h-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving}>
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Draft'}
            </Button>
            <Button size="sm" onClick={handlePublish} disabled={isPublishing || isDeploying}>
              <Globe className="w-4 h-4 mr-2" />
              {isPublishing || isDeploying ? 'Publishing...' : vercelUrl ? 'Update Live Site' : 'Publish Live'}
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - Add Components */}
          <div className="w-64 border-r bg-gray-50 p-4 overflow-y-auto">
            <Tabs defaultValue="add">
              <TabsList className="grid w-full grid-cols-5 mb-4">
                <TabsTrigger value="add">Add</TabsTrigger>
                <TabsTrigger value="pages">Pages</TabsTrigger>
                <TabsTrigger value="templates">Tmpl</TabsTrigger>
                <TabsTrigger value="stats">Stats</TabsTrigger>
                <TabsTrigger value="settings"><Settings className="w-3 h-3" /></TabsTrigger>
              </TabsList>

              <TabsContent value="add">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Add Component
                </h3>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {BASIC_COMPONENTS.map((comp) => (
                    <button
                      key={comp.id}
                      onClick={() => addComponent(comp.id as any)}
                      className="flex flex-col items-center justify-center p-3 bg-white border rounded-lg hover:border-red-500 hover:text-red-500 transition-colors"
                    >
                      {comp.icon}
                      <span className="text-xs mt-1">{comp.name}</span>
                    </button>
                  ))}
                </div>

                <div className="relative mt-6">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-gray-50 px-2 text-gray-500 font-bold flex items-center gap-1">
                      <Crown className="w-3 h-3 text-amber-500" /> Premium
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4">
                  {ADVANCED_COMPONENTS.map((comp) => (
                    <button
                      key={comp.id}
                      onClick={() => addComponent(comp.id as any)}
                      className={`flex flex-col items-center justify-center p-3 bg-white border rounded-lg hover:border-purple-500 hover:text-purple-500 transition-colors ${userPlan !== 'premium' ? 'opacity-60' : ''}`}
                    >
                      {comp.icon}
                      <span className="text-xs mt-1">{comp.name}</span>
                    </button>
                  ))}
                </div>

                {userPlan !== 'premium' && (
                  <Button
                    className="w-full mt-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white"
                    size="sm"
                    onClick={handleUpgrade}
                  >
                    Upgrade for Advanced Features
                  </Button>
                )}
              </TabsContent>

              {/* ===== PAGES TAB ===== */}
              <TabsContent value="pages">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Layout className="w-4 h-4" /> Pages
                </h3>
                <div className="space-y-2 mb-4">
                  {pages.map((page) => (
                    <div
                      key={page.id}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                        activePageId === page.id
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                      onClick={() => { setActivePageId(page.id); setSelectedId(null); }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Globe className="w-3 h-3 shrink-0" />
                        <span className="text-xs font-semibold truncate">{page.name}</span>
                        {page.id === 'home' && (
                          <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">HOME</span>
                        )}
                      </div>
                      {page.id !== 'home' && (
                        <button
                          className="text-red-400 hover:text-red-600 transition-colors shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete page "${page.name}"?`)) {
                              const remaining = pages.filter(p => p.id !== page.id);
                              setPages(remaining);
                              setActivePageId('home');
                            }
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <Button
                  size="sm"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                  onClick={() => {
                    const name = prompt('New page name (e.g. About, Products, Contact):');
                    if (!name?.trim()) return;
                    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                    const id = `page_${Date.now()}`;
                    setPages(prev => [...prev, { id, name: name.trim(), slug, components: [] }]);
                    setActivePageId(id);
                    setSelectedId(null);
                  }}
                >
                  <Plus className="w-3 h-3 mr-1" /> Add New Page
                </Button>

                <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-[10px] text-amber-700 font-medium">💡 Tip: Connect buttons to pages using the <strong>Link To</strong> property in the button panel.</p>
                </div>
              </TabsContent>

              <TabsContent value="templates">
                <h3 className="font-semibold mb-4">Quick Templates</h3>
                <div className="space-y-3">
                  {TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.name}
                      onClick={() => loadTemplate(tmpl)}
                      className="w-full p-4 bg-white border rounded-lg hover:border-blue-500 transition-all text-left group shadow-sm"
                    >
                      <span className="font-medium group-hover:text-blue-600 transition-colors">{tmpl.name}</span>
                      <p className="text-[10px] text-gray-500 mt-1">Click to apply this layout</p>
                    </button>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="stats">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-indigo-500" /> Website Stats
                </h3>
                {websiteStats ? (
                  <div className="space-y-4">
                    <div className="bg-white p-4 rounded-xl border shadow-sm">
                      <p className="text-sm text-gray-500">Total Views</p>
                      <p className="text-3xl font-bold text-indigo-600">{websiteStats.views}</p>
                    </div>
                    {websiteStats.publishedAt && (
                      <p className="text-xs text-gray-400">
                        Published on {new Date(websiteStats.publishedAt).toLocaleDateString()}
                      </p>
                    )}
                    <div className="p-3 bg-indigo-50 rounded-lg text-xs text-indigo-700">
                      Share your URL to get more views!
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <p className="text-sm">Publish your website to see analytics.</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="settings">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Settings className="w-4 h-4" /> Website Settings
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      Custom Domain {userPlan !== 'premium' && <Crown className="w-3 h-3 text-amber-500" />}
                    </Label>
                    <Input
                      placeholder="www.yourbarbershop.com"
                      value={customDomain}
                      onChange={(e) => setCustomDomain(e.target.value)}
                      disabled={userPlan !== 'premium'}
                    />
                    {userPlan !== 'premium' && (
                      <p className="text-[10px] text-amber-600">Upgrade to PREMIUM to use custom domains.</p>
                    )}
                  </div>

                  <div className="p-3 bg-gray-100 rounded-lg">
                    <p className="text-xs font-bold text-gray-700 mb-1">Branding</p>
                    <p className="text-[10px] text-gray-500">Your logo and colors will be automatically applied from your shop settings.</p>
                  </div>

                  <div className="space-y-2 pt-4 border-t">
                    <Label className="flex items-center gap-2 text-indigo-700 font-bold">
                      <Globe className="w-3 h-3" /> Shop Subdomain
                    </Label>
                    <div className="flex gap-1">
                      <Input
                        placeholder="shop-name"
                        value={vercelSubdomain}
                        onChange={(e) => setVercelSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        className="flex-1"
                        disabled={!!vercelUrl}
                      />
                      <span className="flex items-center text-xs text-gray-400">.donedeals.shop</span>
                    </div>
                    {vercelUrl ? (
                      <p className="text-[10px] text-green-600 font-medium">✓ Subdomain Active & Live!</p>
                    ) : (
                      <p className="text-[10px] text-gray-500">Choose your unique subdomain name under donedeals.shop.</p>
                    )}

                    <Button
                      className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                      onClick={() => handleVercelDeploy()}
                      disabled={isDeploying}
                    >
                      {isDeploying ? 'Claiming...' : vercelUrl ? 'Update Subdomain' : 'Claim & Launch Site'}
                    </Button>

                    {vercelUrl && (
                      <div className="mt-2 p-2 bg-indigo-50 border border-indigo-100 rounded text-[10px] text-indigo-700 break-all font-mono">
                        {vercelUrl}
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {selectedComponent && (
              <div className="space-y-4">
                <h3 className="font-semibold border-t pt-4">Styles: {selectedComponent.type}</h3>

                {selectedComponent.type !== 'divider' && (
                  <div className="space-y-2">
                    <Label>Content</Label>
                    <Input
                      value={selectedComponent.content}
                      onChange={(e) => updateComponent(selectedComponent.id, { content: e.target.value })}
                    />
                    {selectedComponent.type === 'image' && (
                      <div className="mt-2">
                        <Label htmlFor="image-upload" className="cursor-pointer">
                          <div className="flex items-center gap-2 text-sm text-red-500 hover:text-red-600">
                            <Upload className="w-4 h-4" />
                            <span>Upload Image</span>
                          </div>
                        </Label>
                        <Input
                          id="image-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageUpload(e, selectedComponent.id)}
                        />
                      </div>
                    )}
                  </div>
                )}

                {selectedComponent.type === 'text' && (
                  <>
                    <div className="space-y-2">
                      <Label>Font Family</Label>
                      <select
                        className="w-full p-2 border rounded-md text-sm"
                        value={selectedComponent.styles.fontFamily || 'sans-serif'}
                        onChange={(e) => updateComponent(selectedComponent.id, {
                          styles: { ...selectedComponent.styles, fontFamily: e.target.value }
                        })}
                      >
                        {FONTS.map(f => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Font Size ({selectedComponent.styles.fontSize}px)</Label>
                      <Slider
                        value={[selectedComponent.styles.fontSize || 16]}
                        min={12} max={72} step={1}
                        onValueChange={([val]) => updateComponent(selectedComponent.id, {
                          styles: { ...selectedComponent.styles, fontSize: val }
                        })}
                      />
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label>Padding ({selectedComponent.styles.padding}px)</Label>
                  <Slider
                    value={[selectedComponent.styles.padding || 0]}
                    min={0} max={100} step={4}
                    onValueChange={([val]) => updateComponent(selectedComponent.id, {
                      styles: { ...selectedComponent.styles, padding: val }
                    })}
                  />
                </div>

                {(selectedComponent.type === 'text' || selectedComponent.type === 'button' || selectedComponent.type === 'divider') && (
                  <div className="space-y-2">
                    <Label>Color</Label>
                    <Input 
                      type="color"
                      value={selectedComponent.styles.color || '#000000'}
                      onChange={(e) => updateComponent(selectedComponent.id, { 
                        styles: { ...selectedComponent.styles, color: e.target.value } 
                      })}
                    />
                  </div>
                )}

                {selectedComponent.type === 'button' && (
                  <>
                    <div className="space-y-2">
                      <Label>Button Color</Label>
                      <Input 
                        type="color"
                        value={selectedComponent.styles.backgroundColor || '#ef4444'}
                        onChange={(e) => updateComponent(selectedComponent.id, { 
                          styles: { ...selectedComponent.styles, backgroundColor: e.target.value } 
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Border Radius ({selectedComponent.styles.borderRadius || 0}px)</Label>
                      <Slider
                        value={[selectedComponent.styles.borderRadius || 0]}
                        min={0} max={50} step={2}
                        onValueChange={([val]) => updateComponent(selectedComponent.id, {
                          styles: { ...selectedComponent.styles, borderRadius: val }
                        })}
                      />
                    </div>
                    {/* Link To Page */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        <Layout className="w-3 h-3" /> Link To Page
                      </Label>
                      <select
                        className="w-full p-2 border rounded-md text-sm"
                        value={selectedComponent.linkTo || ''}
                        onChange={(e) => updateComponent(selectedComponent.id, { linkTo: e.target.value || undefined })}
                      >
                        <option value="">— None (opens booking) —</option>
                        {pages.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                        <option value="__whatsapp">📲 WhatsApp Chat</option>
                        <option value="__call">📞 Call Shop</option>
                        <option value="__booking">📅 Book Appointment</option>
                      </select>
                      {selectedComponent.linkTo && (
                        <p className="text-[10px] text-indigo-600">✓ Button linked to: <strong>{pages.find(p=>p.id===selectedComponent.linkTo)?.name || selectedComponent.linkTo}</strong></p>
                      )}
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label>Alignment</Label>
                  <div className="flex gap-1">
                    {['left', 'center', 'right'].map((align) => (
                      <Button
                        key={align}
                        variant={selectedComponent.styles.alignment === align ? 'default' : 'outline'}
                        size="sm"
                        className="flex-1 capitalize"
                        onClick={() => updateComponent(selectedComponent.id, { 
                          styles: { ...selectedComponent.styles, alignment: align as any } 
                        })}
                      >
                        {align}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Background Color for all types */}
                <div className="space-y-2">
                  <Label>Background</Label>
                  <Input
                    type="color"
                    value={selectedComponent.styles.backgroundColor || '#ffffff'}
                    onChange={(e) => updateComponent(selectedComponent.id, {
                      styles: { ...selectedComponent.styles, backgroundColor: e.target.value }
                    })}
                  />
                </div>

                <div className="flex gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      const idx = components.findIndex(c => c.id === selectedComponent.id);
                      if (idx > 0) {
                        const arr = [...components];
                        [arr[idx-1], arr[idx]] = [arr[idx], arr[idx-1]];
                        setComponents(arr);
                      }
                    }}
                  >
                    ↑ Up
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      const idx = components.findIndex(c => c.id === selectedComponent.id);
                      if (idx < components.length - 1) {
                        const arr = [...components];
                        [arr[idx], arr[idx+1]] = [arr[idx+1], arr[idx]];
                        setComponents(arr);
                      }
                    }}
                  >
                    ↓ Down
                  </Button>
                </div>

                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="w-full mt-2"
                  onClick={() => removeComponent(selectedComponent.id)}
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Remove Component
                </Button>
              </div>
            )}
          </div>

          {/* Canvas */}
          <div className="flex-1 bg-gray-100 overflow-y-auto">
            {/* Page Tabs Bar */}
            <div className="bg-white border-b px-4 py-2 flex items-center gap-2 overflow-x-auto sticky top-0 z-10 shadow-sm">
              {pages.map(page => (
                <button
                  key={page.id}
                  onClick={() => { setActivePageId(page.id); setSelectedId(null); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                    activePageId === page.id
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {page.id === 'home' ? '🏠' : '📄'} {page.name}
                </button>
              ))}
              <button
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
                onClick={() => {
                  const name = prompt('New page name:');
                  if (!name?.trim()) return;
                  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                  const id = `page_${Date.now()}`;
                  setPages(prev => [...prev, { id, name: name.trim(), slug, components: [] }]);
                  setActivePageId(id);
                }}
              >
                <Plus className="w-3 h-3" /> Add Page
              </button>
            </div>

            <div className="p-6">
            {previewUrl && (
              <div className="mb-4 p-4 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Globe className="w-5 h-5 text-green-600" />
                    <span className="text-sm text-green-700 font-bold">Your website is live!</span>
                  </div>
                </div>

                {fullWebsiteUrl && (
                  <div className="space-y-3">
                    <div className="bg-white rounded p-3 flex items-center justify-between border border-gray-200">
                      <code className="text-xs text-gray-700 truncate">{fullWebsiteUrl}</code>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-2"
                        onClick={() => copyToClipboard(fullWebsiteUrl, 'Website URL')}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => window.open(previewUrl, '_blank')}
                      >
                        <Eye className="w-3 h-3 mr-1" /> View Site
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => setShowShareModal(true)}
                      >
                        <Share2 className="w-3 h-3 mr-1" /> Share
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className={`mx-auto bg-white min-h-[600px] shadow-xl rounded-xl p-0 relative transition-all duration-300 ${viewMode === 'mobile' ? 'max-w-[375px]' : 'max-w-full'}`}>
              {components.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                  <Plus className="w-12 h-12 mb-2 opacity-20" />
                  <p>Add your first component</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {components.map((comp) => (
                    <motion.div
                      key={comp.id}
                      layout
                      onClick={() => setSelectedId(comp.id)}
                      className={`relative group cursor-pointer border-2 border-transparent hover:border-red-400 p-2 rounded transition-all ${selectedId === comp.id ? 'border-red-500 bg-red-50/10' : ''}`}
                    >
                      <div className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Move className="w-4 h-4 text-gray-400" />
                      </div>
                      
                      <div style={{ textAlign: comp.styles.alignment, padding: `${comp.styles.padding}px 0` }}>
                        {comp.type === 'text' && (
                          <div style={{
                            fontSize: `${comp.styles.fontSize}px`,
                            color: comp.styles.color,
                            fontWeight: comp.styles.fontWeight,
                            fontFamily: comp.styles.fontFamily,
                            backgroundColor: comp.styles.backgroundColor
                          }}>
                            {comp.content}
                          </div>
                        )}

                        {comp.type === 'image' && (
                          <img 
                            src={comp.content} 
                            alt="Website content" 
                            className="max-w-full"
                            style={{ 
                              borderRadius: `${comp.styles.borderRadius}px`,
                              width: comp.styles.width
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
                          >
                            {comp.content}
                          </button>
                        )}

                        {comp.type === 'divider' && (
                          <div
                            style={{
                              height: comp.styles.height,
                              backgroundColor: comp.styles.backgroundColor,
                              margin: `${comp.styles.padding}px 0`
                            }}
                          />
                        )}

                        {comp.type === 'gallery' && (
                          <div className="grid grid-cols-2 gap-2" style={{ padding: `${comp.styles.padding}px 0` }}>
                            {(comp.content as string[]).map((url, i) => (
                              <img key={i} src={url} alt="Gallery" className="w-full h-24 object-cover rounded-md" />
                            ))}
                          </div>
                        )}

                        {comp.type === 'services' && (
                          <div className="rounded-lg overflow-hidden border" style={{ backgroundColor: comp.styles.backgroundColor, padding: `${comp.styles.padding}px` }}>
                            <h4 className="font-bold mb-2 text-sm" style={{ color: comp.styles.color }}>Our Services</h4>
                            {shopData?.services?.slice(0, 3).map((s: any) => (
                              <div key={s.id} className="flex justify-between py-1 border-b last:border-0 text-xs">
                                <span>{s.name}</span>
                                <span className="font-bold">{s.price}</span>
                              </div>
                            )) || <p className="text-xs text-gray-400">No services added yet</p>}
                          </div>
                        )}

                        {comp.type === 'reviews' && (
                          <div className="space-y-2" style={{ padding: `${comp.styles.padding}px 0` }}>
                            <h4 className="font-bold text-sm">Customer Reviews</h4>
                            {reviewsData?.slice(0, 2).map((r: any) => (
                              <div key={r.id} className="bg-gray-50 p-2 rounded text-[10px] border">
                                <div className="flex justify-between mb-1">
                                  <span className="font-bold">{r.userName}</span>
                                  <div className="flex text-amber-400">{'★'.repeat(r.rating)}</div>
                                </div>
                                <p className="italic">"{r.reviewText}"</p>
                              </div>
                            )) || <p className="text-xs text-gray-400">No reviews yet</p>}
                          </div>
                        )}

                        {comp.type === 'products' && (
                          <div style={{ backgroundColor: comp.styles.backgroundColor, padding: `${comp.styles.padding}px` }}>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-bold text-sm flex items-center gap-1">
                                <Package className="w-4 h-4 text-orange-500" /> Featured Products
                              </h4>
                              <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-bold">SHOP</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {[1,2,3,4].map(i => (
                                <div key={i} className="bg-white rounded-lg border p-2 shadow-sm">
                                  <div className="w-full h-16 bg-gray-100 rounded mb-2 flex items-center justify-center">
                                    <Package className="w-5 h-5 text-gray-300" />
                                  </div>
                                  <p className="text-[10px] font-bold text-gray-800">Product {i}</p>
                                  <p className="text-[10px] text-orange-600 font-black">₹0.00</p>
                                </div>
                              ))}
                            </div>
                            <p className="text-[9px] text-center text-gray-400 mt-2">Live products from your store will appear here</p>
                          </div>
                        )}

                        {comp.type === 'navbar' && (
                          <div
                            className="flex items-center justify-between px-4 shadow-sm"
                            style={{
                              backgroundColor: comp.styles.backgroundColor,
                              color: comp.styles.color,
                              padding: `${comp.styles.padding || 15}px 16px`,
                            }}
                          >
                            <span className="font-black text-sm" style={{ color: comp.styles.color }}>{shopName}</span>
                            <div className="flex gap-3">
                              {pages.map(p => (
                                <span key={p.id} className="text-xs font-semibold opacity-80" style={{ color: comp.styles.color }}>{p.name}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
            </div>
          </div>
        </div>

        {/* Share Modal */}
        {showShareModal && fullWebsiteUrl && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Share Your Website</h3>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* QR Code Section */}
                <div className="flex flex-col items-center">
                  <p className="text-sm text-gray-600 mb-3 font-medium">Scan to Visit</p>
                  {qrCodeUrl && (
                    <div className="bg-white p-3 rounded-lg border border-gray-200">
                      <img
                        src={qrCodeUrl}
                        alt="Website QR Code"
                        className="w-48 h-48"
                      />
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 w-full"
                    onClick={downloadQRCode}
                  >
                    <Download className="w-4 h-4 mr-2" /> Download QR Code
                  </Button>
                </div>

                <div className="border-t pt-4">
                  {/* Website URL */}
                  <p className="text-sm text-gray-600 mb-2 font-medium">Website URL</p>
                  <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between border border-gray-200 mb-3">
                    <code className="text-xs text-gray-700 truncate flex-1">{fullWebsiteUrl}</code>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-2"
                      onClick={() => copyToClipboard(fullWebsiteUrl, 'Website URL')}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Share Buttons */}
                  <p className="text-sm text-gray-600 mb-2 font-medium">Share On</p>
                  <div className="grid grid-cols-3 gap-2">
                    {/* WhatsApp */}
                    <button
                      onClick={() => {
                        const text = `Check out ${shopName}'s website: ${fullWebsiteUrl}`;
                        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                      }}
                      className="p-3 bg-green-100 hover:bg-green-200 rounded-lg transition-colors text-center"
                    >
                      <span className="text-xl">💬</span>
                      <p className="text-xs text-green-700 font-medium mt-1">WhatsApp</p>
                    </button>

                    {/* Facebook */}
                    <button
                      onClick={() => {
                        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fullWebsiteUrl)}`, '_blank');
                      }}
                      className="p-3 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors text-center"
                    >
                      <span className="text-xl">f</span>
                      <p className="text-xs text-blue-700 font-medium mt-1">Facebook</p>
                    </button>

                    {/* Twitter */}
                    <button
                      onClick={() => {
                        const text = `Check out ${shopName}'s website: ${fullWebsiteUrl}`;
                        window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(fullWebsiteUrl)}&text=${encodeURIComponent(text)}`, '_blank');
                      }}
                      className="p-3 bg-sky-100 hover:bg-sky-200 rounded-lg transition-colors text-center"
                    >
                      <span className="text-xl">𝕏</span>
                      <p className="text-xs text-sky-700 font-medium mt-1">Twitter</p>
                    </button>
                  </div>

                  {/* Generic Share */}
                  <Button
                    size="sm"
                    className="w-full mt-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                    onClick={handleShare}
                  >
                    <Share2 className="w-4 h-4 mr-2" /> Share Website
                  </Button>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full mt-4"
                onClick={() => setShowShareModal(false)}
              >
                Close
              </Button>
            </motion.div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
