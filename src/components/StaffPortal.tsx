import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Plus, Trash2, Pin, ArrowUp, ArrowDown, MessageSquare, Send, CheckCircle2, Clock, Globe as GlobeIcon, Download, Upload, Mail, List, Package, MessageCircle, MapPin, Phone, ExternalLink, Loader2, Store, User, Truck } from 'lucide-react';
import { getShops, deleteShop, updateShop, getShopById } from '@/lib/shops-storage';
import { getAllMessages, replyToMessage, markMessageAsRead } from '@/lib/supabase-user-messages';
import type { UserMessage } from '@/lib/supabase-user-messages';
import { AddShopPage } from '@/components/AddShopPage';
import { useAuth } from '@/contexts/AuthContext';
import type { Shop } from '@/lib/shops-storage';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import type { AppUpdateData } from '@/contexts/AppUpdateContext';
import { type Order, getStatusColor, getStatusDisplayName, formatOrderDate, getOrderById, updateBookItStatus } from '@/lib/supabase-orders';
import { getUserProfile } from '@/lib/supabase-user-profiles';

import { useNavigate } from 'react-router-dom';

interface StaffPortalProps {
  onClose: () => void;
}

const DeliveryRequestItem = ({ noti, onHandled }: { noti: any, onHandled: () => void }) => {
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<Order | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [customerProfile, setCustomerProfile] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!noti.order_id) return;
        const orderData = await getOrderById(noti.order_id);
        setOrder(orderData);

        if (orderData.shop_id) {
          const shopData = await getShopById(orderData.shop_id);
          setShop(shopData);
        }

        if (orderData.customer_id) {
          const profileData = await getUserProfile(orderData.customer_id);
          setCustomerProfile(profileData);
        }
      } catch (error) {
        console.error('Error fetching delivery request details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [noti.order_id]);

  if (loading) {
    return (
      <div className="p-5 border-2 rounded-2xl bg-muted/10 animate-pulse flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={`p-5 border-2 rounded-2xl transition-all duration-300 ${noti.is_read ? 'bg-muted/20 opacity-60 border-transparent' : 'bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-900/50 shadow-md transform hover:scale-[1.01]'}`}>
      <div className="flex justify-between items-start mb-4">
        <div className="space-y-1">
          <h4 className={`font-black text-lg leading-tight ${noti.is_read ? 'text-muted-foreground' : 'text-blue-900 dark:text-blue-100'}`}>
            {noti.message}
          </h4>
          <div className="flex items-center gap-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(noti.created_at).toLocaleTimeString()}
            </span>
            <span>•</span>
            <span>Order ID: {noti.order_id?.slice(0, 8)}...</span>
          </div>
        </div>
        {!noti.is_read && <span className="h-3 w-3 rounded-full bg-blue-500 shadow-lg shadow-blue-200 animate-pulse" />}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Shop Details */}
        <div className="space-y-3">
          <h5 className="text-xs font-black text-amber-600 uppercase tracking-wider flex items-center gap-2">
            <Store className="h-3 w-3" />
            Pick-up From (Shop)
          </h5>
          <div className="bg-amber-50/50 dark:bg-amber-950/10 p-3 rounded-xl border border-amber-100 dark:border-amber-900/30">
            <p className="font-bold text-sm mb-1">{shop?.name || 'Loading shop...'}</p>
            <p className="text-xs text-muted-foreground mb-3">{shop?.location || shop?.address || 'No address provided'}</p>
            <div className="flex flex-wrap gap-2">
              {shop?.locationMapLink && (
                <Button size="sm" variant="outline" className="h-8 text-[10px] font-bold gap-1.5" onClick={() => window.open(shop.locationMapLink, '_blank')}>
                  <MapPin className="h-3 w-3" /> MAP LINK
                </Button>
              )}
              {shop?.ownerPhone && (
                <>
                  <Button size="sm" variant="outline" className="h-8 text-[10px] font-bold gap-1.5" onClick={() => window.open(`tel:${shop.ownerPhone}`, '_self')}>
                    <Phone className="h-3 w-3" /> CALL
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-[10px] font-bold gap-1.5 bg-green-500 hover:bg-green-600 text-white border-0" onClick={() => window.open(`https://wa.me/${shop.ownerPhone.replace(/\D/g, '')}`, '_blank')}>
                    <MessageCircle className="h-3 w-3" /> WHATSAPP
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Customer Details */}
        <div className="space-y-3">
          <h5 className="text-xs font-black text-blue-600 uppercase tracking-wider flex items-center gap-2">
            <User className="h-3 w-3" />
            Deliver To (Customer)
          </h5>
          <div className="bg-blue-50/50 dark:bg-blue-950/10 p-3 rounded-xl border border-blue-100 dark:border-blue-900/30">
            <p className="font-bold text-sm mb-1">{customerProfile?.name || order?.customer_name || 'Loading customer...'}</p>
            <p className="text-xs text-muted-foreground mb-1">{customerProfile?.email || 'No email'}</p>
            <p className="text-xs text-muted-foreground mb-3">{order?.customer_address || customerProfile?.address || 'No address provided'}</p>
            <div className="flex flex-wrap gap-2">
              {(order?.location_link || customerProfile?.google_map_link) && (
                <Button size="sm" variant="outline" className="h-8 text-[10px] font-bold gap-1.5" onClick={() => window.open(order?.location_link || customerProfile?.google_map_link, '_blank')}>
                  <MapPin className="h-3 w-3" /> MAP LINK
                </Button>
              )}
              {(order?.customer_phone || customerProfile?.phone) && (
                <Button size="sm" variant="outline" className="h-8 text-[10px] font-bold gap-1.5" onClick={() => window.open(`tel:${order?.customer_phone || customerProfile?.phone}`, '_self')}>
                  <Phone className="h-3 w-3" /> CALL
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Order Details */}
      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-4">
        <div className="flex items-center gap-4">
          {order?.product_image ? (
            <img src={order.product_image} alt={order.product_name} className="h-16 w-16 rounded-lg object-cover border shadow-sm" />
          ) : (
            <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center">
              <Package className="h-8 w-8 text-muted-foreground/30" />
            </div>
          )}
          <div>
            <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-0.5">Order Item</p>
            <p className="font-black text-base">{order?.product_name || 'Multiple items'}</p>
            <p className="text-xs font-bold text-blue-600">Qty: {order?.quantity || 1} • Total: ₹{order?.order_amount}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
        <h5 className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2 mb-2">
          <Truck className="h-3 w-3" />
          Update Book It Status
        </h5>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Button 
            size="sm" 
            variant={order?.book_it_status === 'accepted' ? 'default' : 'outline'} 
            className={`text-[9px] font-black h-9 rounded-lg ${order?.book_it_status === 'accepted' ? 'bg-blue-600' : ''}`}
            onClick={async () => {
              if (!order) return;
              try {
                console.log('🔄 Updating status to accepted for order:', order.id);
                await updateBookItStatus(order.id, 'accepted');
                const updated = await getOrderById(order.id);
                setOrder(updated);
                toast.success('✅ Status: Accepted');
              } catch (err) {
                console.error('❌ Failed to update status:', err);
                toast.error('Failed to update: ' + (err instanceof Error ? err.message : 'Unknown error'));
              }
            }}
          >
            ACCEPTED
          </Button>
          <Button 
            size="sm" 
            variant={order?.book_it_status === 'picking_up' ? 'default' : 'outline'} 
            className={`text-[9px] font-black h-9 rounded-lg ${order?.book_it_status === 'picking_up' ? 'bg-blue-600' : ''}`}
            onClick={async () => {
              if (!order) return;
              try {
                console.log('🔄 Updating status to picking_up for order:', order.id);
                await updateBookItStatus(order.id, 'picking_up');
                const updated = await getOrderById(order.id);
                setOrder(updated);
                toast.success('✅ Status: Picking Up');
              } catch (err) {
                console.error('❌ Failed to update status:', err);
                toast.error('Failed to update: ' + (err instanceof Error ? err.message : 'Unknown error'));
              }
            }}
          >
            PICKING UP
          </Button>
          <Button 
            size="sm" 
            variant={order?.book_it_status === 'delivering' ? 'default' : 'outline'} 
            className={`text-[9px] font-black h-9 rounded-lg ${order?.book_it_status === 'delivering' ? 'bg-blue-600' : ''}`}
            onClick={async () => {
              if (!order) return;
              try {
                console.log('🔄 Updating status to delivering for order:', order.id);
                await updateBookItStatus(order.id, 'delivering');
                const updated = await getOrderById(order.id);
                setOrder(updated);
                toast.success('✅ Status: Delivering');
              } catch (err) {
                console.error('❌ Failed to update status:', err);
                toast.error('Failed to update: ' + (err instanceof Error ? err.message : 'Unknown error'));
              }
            }}
          >
            DELIVERING
          </Button>
          <Button 
            size="sm" 
            variant={order?.book_it_status === 'delivered' ? 'default' : 'outline'} 
            className={`text-[9px] font-black h-9 rounded-lg ${order?.book_it_status === 'delivered' ? 'bg-blue-600' : ''}`}
            onClick={async () => {
              if (!order) return;
              try {
                console.log('🔄 Updating status to delivered for order:', order.id);
                await updateBookItStatus(order.id, 'delivered');
                const updated = await getOrderById(order.id);
                setOrder(updated);
                toast.success('✅ Status: Delivered');
              } catch (err) {
                console.error('❌ Failed to update status:', err);
                toast.error('Failed to update: ' + (err instanceof Error ? err.message : 'Unknown error'));
              }
            }}
          >
            DELIVERED
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button 
            size="sm" 
            variant="secondary" 
            className="text-[10px] font-black h-9 rounded-lg bg-white dark:bg-slate-800 shadow-sm border px-4" 
            onClick={() => window.open(`https://database.donedeals.shop/orders/${noti.order_id}`, '_blank')}
          >
            <ExternalLink className="mr-2 h-3 w-3" />
            DATABASE VIEW
          </Button>
          {!noti.is_read && (
            <Button 
              size="sm" 
              className="text-[10px] font-black h-9 px-6 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-100 dark:shadow-none" 
              onClick={onHandled}
            >
              MARK AS HANDLED
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export const StaffPortal = ({ onClose }: StaffPortalProps) => {
  const navigate = useNavigate();
  const [shops, setShops] = useState<Shop[]>([]);
  const [messages, setMessages] = useState<UserMessage[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [adminNotifications, setAdminNotifications] = useState<any[]>([]);
  const [currentTab, setCurrentTab] = useState<'manage' | 'orders' | 'mail' | 'ordering' | 'inbox' | 'updates'>('manage');
  const [updating, setUpdating] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [updateData, setUpdateData] = useState<AppUpdateData | null>(null);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');
  const [uploadingApk, setUploadingApk] = useState(false);

  const { user } = useAuth();

  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const tabOrder: ('manage' | 'orders' | 'mail' | 'ordering' | 'inbox' | 'updates')[] = ['manage', 'orders', 'mail', 'ordering', 'inbox', 'updates'];

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartXRef.current || !touchStartYRef.current) return;

    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    const deltaX = touchStartXRef.current - touchX;
    const deltaY = touchStartYRef.current - touchY;

    // If horizontal swipe is dominant
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (Math.abs(deltaX) > 50) {
        const currentIndex = tabOrder.indexOf(currentTab);
        if (deltaX > 0 && currentIndex < tabOrder.length - 1) {
          // Swipe left -> Next tab
          setCurrentTab(tabOrder[currentIndex + 1]);
          touchStartXRef.current = null;
          touchStartYRef.current = null;
        } else if (deltaX < 0 && currentIndex > 0) {
          // Swipe right -> Previous tab
          setCurrentTab(tabOrder[currentIndex - 1]);
          touchStartXRef.current = null;
          touchStartYRef.current = null;
        }
      }
    }
  };

  const handleTouchEnd = () => {
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  // Load shops, messages, and update data from storage/DB
  useEffect(() => {
    const loadData = async () => {
      const [shopsData, messagesData, updateInfo, ordersInfo, notificationsInfo] = await Promise.all([
        getShops(),
        getAllMessages(),
        supabase.from('app_updates').select('*').single(),
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
        supabase.from('admin_notifications').select('*').order('created_at', { ascending: false })
      ]);
      setShops(shopsData);
      setMessages(messagesData);
      if (ordersInfo.data) setAllOrders(ordersInfo.data);
      if (notificationsInfo.data) setAdminNotifications(notificationsInfo.data);
      if (updateInfo.data) {
        setUpdateData(updateInfo.data);
        setUpdateMessage(updateInfo.data.update_message || '');
      }
    };
    loadData();
  }, [currentTab]);

  const handleReply = async (messageId: string) => {
    const text = replyText[messageId];
    if (!text?.trim() || !user?.uid) return;

    setReplyingTo(messageId);
    try {
      await replyToMessage(messageId, text.trim(), user.uid);
      toast.success('Reply sent successfully');
      setReplyText(prev => ({ ...prev, [messageId]: '' }));

      // Refresh messages
      const updatedMessages = await getAllMessages();
      setMessages(updatedMessages);
    } catch (error) {
      console.error('Error sending reply:', error);
      toast.error('Failed to send reply');
    } finally {
      setReplyingTo(null);
    }
  };

  const handleMarkAsRead = async (messageId: string) => {
    try {
      await markMessageAsRead(messageId);
      const updatedMessages = await getAllMessages();
      setMessages(updatedMessages);
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleDeleteShop = async (id: string) => {
    if (!confirm('Are you sure you want to delete this shop?')) return;

    await deleteShop(id);
    const shopsData = await getShops();
    setShops(shopsData);
    toast.success('Shop deleted');
  };

  const handleToggleWebsiteBuilder = async (id: string, currentValue: boolean | undefined) => {
    setUpdating(id);
    const shop = shops.find((s) => s.id === id);
    if (!shop) return;

    const newValue = currentValue !== false ? false : true;
    await updateShop(id, { isWebsiteBuilderEnabled: newValue });
    const shopsData = await getShops();
    setShops(shopsData);
    toast.success(newValue ? 'Website builder enabled' : 'Website builder disabled');
    setUpdating(null);
  };

  const handleTogglePin = async (id: string) => {
    setUpdating(id);
    const shop = shops.find((s) => s.id === id);
    if (!shop) return;

    await updateShop(id, { isPinned: !shop.isPinned });
    const shopsData = await getShops();
    setShops(shopsData);
    toast.success(shop.isPinned ? 'Shop unpinned' : 'Shop pinned');
    setUpdating(null);
  };

  const handleUpdatePinOrder = async (id: string, newOrder: number) => {
    setUpdating(id);
    await updateShop(id, { pinOrder: newOrder });
    const shopsData = await getShops();
    setShops(shopsData);
    setUpdating(null);
  };

  const handleToggleUpdateEnabled = async () => {
    if (!updateData) return;
    setUpdateLoading(true);
    try {
      const newEnabled = !updateData.update_enabled;
      const { error } = await supabase
        .from('app_updates')
        .update({ update_enabled: newEnabled })
        .eq('id', updateData.id);

      if (error) throw error;

      setUpdateData(prev => prev ? { ...prev, update_enabled: newEnabled } : null);
      toast.success(newEnabled ? 'Update notifications enabled' : 'Update notifications disabled');
    } catch (error) {
      console.error('Error toggling update:', error);
      toast.error('Failed to update settings');
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleUpdateMessage = async () => {
    if (!updateData) return;
    setUpdateLoading(true);
    try {
      const { error } = await supabase
        .from('app_updates')
        .update({
          update_message: updateMessage
        })
        .eq('id', updateData.id);

      if (error) throw error;

      setUpdateData(prev => prev ? { ...prev, update_message: updateMessage } : null);
      toast.success('Update settings saved');
    } catch (error) {
      console.error('Error updating message:', error);
      toast.error('Failed to save settings');
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleApkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !updateData) return;

    setUploadingApk(true);
    try {
      // Upload file to Supabase storage
      const timestamp = Date.now();
      const fileName = `apk_${timestamp}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('app-updates')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase
        .storage
        .from('app-updates')
        .getPublicUrl(fileName);

      // Update database with APK URL
      const { error: updateError } = await supabase
        .from('app_updates')
        .update({ apk_url: publicUrl })
        .eq('id', updateData.id);

      if (updateError) throw updateError;

      setUpdateData(prev => prev ? { ...prev, apk_url: publicUrl } : null);
      toast.success('APK uploaded successfully');
    } catch (error) {
      console.error('Error uploading APK:', error);
      toast.error('Failed to upload APK');
    } finally {
      setUploadingApk(false);
    }
  };

  // Group shops by category for the ordering tab
  const shopsByCategory = shops.reduce(
    (acc, shop) => {
      if (!acc[shop.category]) {
        acc[shop.category] = [];
      }
      acc[shop.category].push(shop);
      return acc;
    },
    {} as Record<string, Shop[]>
  );

  // Sort pinned shops by pinOrder
  const sortedShopsByCategory = Object.entries(shopsByCategory).reduce(
    (acc, [category, categoryShops]) => {
      const pinned = categoryShops.filter((s) => s.isPinned).sort((a, b) => (a.pinOrder || 999) - (b.pinOrder || 999));
      const unpinned = categoryShops.filter((s) => !s.isPinned);
      acc[category] = [...pinned, ...unpinned];
      return acc;
    },
    {} as Record<string, Shop[]>
  );



  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col overflow-hidden">
      {/* Sticky Header - Always visible */}
      <div className="shrink-0 bg-background border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-4 py-3">
            <Button variant="ghost" size="icon" onClick={onClose}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold leading-tight">Staff Portal</h1>
              <p className="text-xs text-muted-foreground">Manage shops &amp; orders</p>
            </div>
          </div>

          {/* Tab Navigation - inside sticky header */}
          <div
            className="flex gap-1 overflow-x-auto pb-0 scroll-smooth no-scrollbar"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <Button
              variant={currentTab === 'manage' ? 'default' : 'ghost'}
              onClick={() => setCurrentTab('manage')}
              size="sm"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary whitespace-nowrap text-xs"
            >
              Manage Shops
            </Button>
            <Button
              variant={currentTab === 'orders' ? 'default' : 'ghost'}
              onClick={() => setCurrentTab('orders')}
              size="sm"
              className="rounded-none border-b-2 whitespace-nowrap text-xs"
            >
              <List className="h-3 w-3 mr-1" />
              All Orders
            </Button>
            <Button
              variant={currentTab === 'mail' ? 'default' : 'ghost'}
              onClick={() => setCurrentTab('mail')}
              size="sm"
              className="rounded-none border-b-2 relative whitespace-nowrap text-xs"
            >
              <Mail className="h-3 w-3 mr-1" />
              Fulfillment Mail
              {adminNotifications.filter(n => !n.is_read).length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white font-bold">
                  {adminNotifications.filter(n => !n.is_read).length}
                </span>
              )}
            </Button>
            <Button
              variant={currentTab === 'ordering' ? 'default' : 'ghost'}
              onClick={() => setCurrentTab('ordering')}
              size="sm"
              className="rounded-none border-b-2 whitespace-nowrap text-xs"
            >
              Shop Ordering
            </Button>
            <Button
              variant={currentTab === 'inbox' ? 'default' : 'ghost'}
              onClick={() => setCurrentTab('inbox')}
              size="sm"
              className="rounded-none border-b-2 relative whitespace-nowrap text-xs"
            >
              Inbox
              {messages.filter(m => !m.isRead).length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white font-bold">
                  {messages.filter(m => !m.isRead).length}
                </span>
              )}
            </Button>
            <Button
              variant={currentTab === 'updates' ? 'default' : 'ghost'}
              onClick={() => setCurrentTab('updates')}
              size="sm"
              className="rounded-none border-b-2 whitespace-nowrap text-xs"
            >
              <Download className="h-3 w-3 mr-1" />
              App Updates
            </Button>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div
        className="flex-1 overflow-y-auto scroll-smooth"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="max-w-6xl mx-auto p-4 sm:p-6 pb-24 space-y-6">


        <div className="grid md:grid-cols-2 gap-6">
          {/* Add Shop Button */}
          <Card>
            <CardHeader>
              <CardTitle>Add New Shop</CardTitle>
              <CardDescription>Create a comprehensive shop listing</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Add a new shop with detailed information including owner contact, members, services, images, and location.
              </p>
              <Button onClick={() => navigate('/create-shop?source=staff')} className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Add New Shop
              </Button>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
              <CardDescription>Shop management summary</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">Total Shops</span>
                  <span className="text-2xl font-bold text-primary">{shops.length}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  All changes are automatically saved. Shops you add will instantly appear on the website.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Tab Content */}
        <div className="mt-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 30
                }}
              >
                {/* All Orders Tab */}
                {currentTab === 'orders' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <List className="h-5 w-5" />
                        Global Order Monitoring
                      </CardTitle>
                      <CardDescription>View all orders across all shops</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {allOrders.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">No orders yet</div>
                      ) : (
                        <div className="space-y-4">
                          {allOrders.map((order) => (
                            <div key={order.id} className="p-4 border rounded-xl bg-muted/20">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <h4 className="font-bold">{order.customer_name}</h4>
                                  <p className="text-xs text-muted-foreground">{formatOrderDate(order.created_at)}</p>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getStatusColor(order.status)}`}>
                                  {getStatusDisplayName(order.status)}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <span>{order.product_name || 'Items'} x{order.quantity}</span>
                                <span className="font-bold text-orange-600">₹{order.order_amount}</span>
                              </div>
                              {order.delivery_type === 'delivery' && (
                                <div className="mt-2 text-[10px] font-black uppercase text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded inline-block">
                                  Home Delivery {order.delivery_choice ? `(${order.delivery_choice})` : '(Pending Choice)'}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Fulfillment Mail Tab */}
                {currentTab === 'mail' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-blue-600">
                        <Mail className="h-5 w-5" />
                        Delivery Control Center
                      </CardTitle>
                      <CardDescription>Live 'Book It' delivery requests from shop owners</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {adminNotifications.filter(n => n.type === 'delivery_request').length === 0 ? (
                        <div className="text-center py-16 bg-muted/10 rounded-2xl border-2 border-dashed">
                          <Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                          <p className="text-muted-foreground font-medium">No active delivery requests</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {adminNotifications.filter(n => n.type === 'delivery_request').map((noti) => (
                            <DeliveryRequestItem 
                              key={noti.id} 
                              noti={noti} 
                              onHandled={async () => {
                                const { error } = await supabase.from('admin_notifications').update({ is_read: true }).eq('id', noti.id);
                                if (!error) {
                                  setAdminNotifications(prev => prev.map(n => n.id === noti.id ? { ...n, is_read: true } : n));
                                  toast.success('Fulfillment record handled');
                                } else {
                                  toast.error('Failed to update record');
                                }
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Manage Shops Tab */}
                {currentTab === 'manage' && (
                  <Card>
                    <CardHeader>
                      <CardTitle>All Shops ({shops.length})</CardTitle>
                      <CardDescription>Manage your shops</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {shops.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-muted-foreground">No shops added yet. Click "Add New Shop" to create one.</p>
                        </div>
                      ) : (
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {shops.map((shop) => (
                            <Card key={shop.id} className="border overflow-hidden hover:shadow-md transition-all duration-300 group">
                              {shop.shopImageUrl && (
                                <div className="overflow-hidden h-32">
                                  <img
                                    src={shop.shopImageUrl}
                                    alt={shop.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                  />
                                </div>
                              )}
                              <CardContent className="p-4 space-y-3">
                                <div>
                                  <h3 className="font-semibold text-lg">{shop.name}</h3>
                                  <p className="text-sm text-muted-foreground">{shop.location}</p>
                                  <p className="text-sm text-muted-foreground mt-1">Owner: {shop.ownerName}</p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {shop.barberMembers.length} member(s) • {shop.services.length} service(s)
                                  </p>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-muted rounded">
                                  <div className="flex items-center gap-2">
                                    <GlobeIcon className="h-4 w-4 text-blue-600" />
                                    <span className="text-sm font-medium">Website Builder</span>
                                  </div>
                                  <Switch
                                    checked={shop.isWebsiteBuilderEnabled !== false}
                                    onCheckedChange={() => handleToggleWebsiteBuilder(shop.id, shop.isWebsiteBuilderEnabled)}
                                    disabled={updating === shop.id}
                                  />
                                </div>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="w-full"
                                  onClick={() => handleDeleteShop(shop.id)}
                                >
                                  <Trash2 className="mr-2 h-3 w-3" />
                                  Delete
                                </Button>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Shop Ordering Tab */}
                {currentTab === 'ordering' && (
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Shop Ordering & Sequencing</CardTitle>
                        <CardDescription>
                          Pin shops to always appear at the top. Non-pinned shops will be randomized on refresh.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {shops.length === 0 ? (
                          <div className="text-center py-8">
                            <p className="text-muted-foreground">No shops added yet.</p>
                          </div>
                        ) : (
                          Object.entries(sortedShopsByCategory).map(([category, categoryShops]) => (
                            <div key={category} className="space-y-3">
                              <h3 className="font-semibold text-lg capitalize">{category}</h3>
                              <div className="space-y-2">
                                {categoryShops.map((shop, index) => (
                                  <div
                                    key={shop.id}
                                    className="flex items-center gap-3 p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                                  >
                                    <span className="text-sm font-medium text-muted-foreground min-w-6">{index + 1}.</span>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium truncate">{shop.name}</p>
                                      <p className="text-sm text-muted-foreground truncate">{shop.location}</p>
                                    </div>

                                    {shop.isPinned && (
                                      <div className="flex items-center gap-1">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleUpdatePinOrder(shop.id, Math.max(1, (shop.pinOrder || 999) - 1))}
                                          disabled={updating === shop.id || (shop.pinOrder || 999) <= 1}
                                        >
                                          <ArrowUp className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleUpdatePinOrder(shop.id, (shop.pinOrder || 999) + 1)}
                                          disabled={updating === shop.id}
                                        >
                                          <ArrowDown className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    )}

                                    <Button
                                      variant={shop.isPinned ? 'default' : 'outline'}
                                      size="sm"
                                      onClick={() => handleTogglePin(shop.id)}
                                      disabled={updating === shop.id}
                                    >
                                      <Pin className="h-4 w-4 mr-1" />
                                      {shop.isPinned ? 'Pinned' : 'Pin'}
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>

                    <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                      <CardHeader>
                        <CardTitle className="text-base">How It Works</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <p>
                          <strong>Pinned Shops:</strong> Shops you pin will always appear at the top of the app homepage in the
                          order you set here.
                        </p>
                        <p>
                          <strong>Non-Pinned Shops:</strong> These shops appear below pinned shops and are randomized each time
                          a user opens or refreshes the app, giving each shop equal visibility.
                        </p>
                        <p>
                          <strong>Categories:</strong> Ordering is managed per category. Each category can have its own set of
                          pinned shops.
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Inbox Tab */}
                {currentTab === 'inbox' && (
                  <div className="space-y-6 pb-20">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <MessageSquare className="h-5 w-5" />
                          User Thoughts & Support
                        </CardTitle>
                        <CardDescription>
                          View and reply to messages from users
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {messages.length === 0 ? (
                          <div className="text-center py-12">
                            <MessageSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                            <p className="text-muted-foreground">No messages yet.</p>
                          </div>
                        ) : (
                          <div className="space-y-6">
                            {messages.map((msg) => (
                              <div
                                key={msg.id}
                                className={`p-4 rounded-xl border transition-all duration-200 ${
                                  msg.isRead
                                    ? 'bg-muted/30 border-border/50'
                                    : 'bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background border-blue-200 dark:border-blue-900/50 shadow-sm'
                                }`}
                              >
                                <div className="flex flex-col sm:flex-row justify-between gap-2 mb-3">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h4 className="font-bold text-lg">{msg.senderName}</h4>
                                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                                        msg.messageType === 'support'
                                          ? 'bg-red-100 text-red-600 dark:bg-red-900/30'
                                          : msg.messageType === 'feedback'
                                            ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30'
                                            : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30'
                                      }`}>
                                        {msg.messageType}
                                      </span>
                                      {!msg.isRead && (
                                        <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {new Date(msg.createdAt).toLocaleString()}
                                      </span>
                                      <span>{msg.senderEmail}</span>
                                      {msg.senderPhone && <span>• {msg.senderPhone}</span>}
                                    </div>
                                  </div>
                                  {!msg.isRead && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-xs h-7"
                                      onClick={() => handleMarkAsRead(msg.id)}
                                    >
                                      Mark as read
                                    </Button>
                                  )}
                                </div>

                                <div className="bg-white/50 dark:bg-black/20 p-4 rounded-lg border border-border/50 mb-4">
                                  <p className="text-foreground whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                                </div>

                                {msg.adminReply ? (
                                  <div className="bg-green-50/50 dark:bg-green-950/10 p-4 rounded-lg border border-green-200/50 dark:border-green-900/30 ml-4 sm:ml-8">
                                    <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-green-700 dark:text-green-400">
                                      <CheckCircle2 className="h-3 w-3" />
                                      Staff Reply
                                      {msg.replyDate && (
                                        <span className="font-normal text-muted-foreground ml-auto">
                                          {new Date(msg.replyDate).toLocaleString()}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-foreground/90 italic">"{msg.adminReply}"</p>
                                  </div>
                                ) : (
                                  <div className="mt-4 flex flex-col gap-2">
                                    <div className="flex gap-2">
                                      <textarea
                                        placeholder="Type your reply here..."
                                        className="flex-1 min-h-[80px] p-3 text-sm rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none resize-none transition-all"
                                        value={replyText[msg.id] || ''}
                                        onChange={(e) => setReplyText(prev => ({ ...prev, [msg.id]: e.target.value }))}
                                      />
                                    </div>
                                    <div className="flex justify-end">
                                      <Button
                                        size="sm"
                                        className="bg-primary hover:bg-primary/90"
                                        disabled={!replyText[msg.id]?.trim() || replyingTo === msg.id}
                                        onClick={() => handleReply(msg.id)}
                                      >
                                        {replyingTo === msg.id ? (
                                          <Clock className="h-4 w-4 animate-spin mr-2" />
                                        ) : (
                                          <Send className="h-4 w-4 mr-2" />
                                        )}
                                        Send Reply
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Staff Tip</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-muted-foreground">
                          Replying to thoughts and feedback helps build trust with your users. Only the sender will be able to see your reply in their personal inbox.
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* App Updates Tab */}
                {currentTab === 'updates' && (
                  <div className="space-y-6 pb-20">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Download className="h-5 w-5" />
                          App Updates Management
                        </CardTitle>
                        <CardDescription>
                          Control app update notifications and upload new APK versions
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {updateData ? (
                          <>
                            {/* Update Toggle */}
                            <div className="p-4 border rounded-lg bg-muted/30">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h3 className="font-semibold mb-2">Enable Update Notifications</h3>
                                  <p className="text-sm text-muted-foreground">
                                    When enabled, users will see an update popup every time they open the app
                                    {updateData.update_enabled && updateData.latest_version !== updateData.current_version && (
                                      <span className="block mt-2 text-amber-600 dark:text-amber-400">
                                        ✓ Update notifications are currently active
                                      </span>
                                    )}
                                  </p>
                                </div>
                                <Switch
                                  checked={updateData.update_enabled}
                                  onCheckedChange={handleToggleUpdateEnabled}
                                  disabled={updateLoading}
                                />
                              </div>
                            </div>

                            {/* Version Info */}
                            <div className="grid sm:grid-cols-2 gap-4">
                              <div className="p-4 bg-muted rounded-lg">
                                <p className="text-sm text-muted-foreground mb-1">Current Version (Auto-sync)</p>
                                <p className="text-xl font-bold">{updateData.current_version}</p>
                              </div>
                              <div className="p-4 bg-muted rounded-lg">
                                <p className="text-sm text-muted-foreground mb-1">Latest Version (Target - Auto-sync)</p>
                                <p className="text-xl font-bold">{updateData.latest_version}</p>
                              </div>
                            </div>

                            {/* Update Message */}
                            <div className="space-y-3">
                              <label className="block font-semibold text-sm">
                                Update Message
                              </label>
                              <p className="text-xs text-muted-foreground">
                                This message will be shown to users in the update popup
                              </p>
                              <textarea
                                value={updateMessage}
                                onChange={(e) => setUpdateMessage(e.target.value)}
                                placeholder="New version available. Please update to get the latest features..."
                                className="w-full min-h-[100px] p-3 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                              />
                              <Button
                                onClick={handleUpdateMessage}
                                disabled={updateLoading}
                                className="w-full"
                              >
                                {updateLoading ? (
                                  <Clock className="h-4 w-4 animate-spin mr-2" />
                                ) : null}
                                Save Settings
                              </Button>
                            </div>

                            {/* APK Upload */}
                            <div className="space-y-3 p-4 border-2 border-dashed rounded-lg">
                              <label className="block font-semibold text-sm">
                                Upload New APK
                              </label>
                              <p className="text-xs text-muted-foreground">
                                Upload the new APK file. Users will download this version when they click "Update Now"
                              </p>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="file"
                                  accept=".apk"
                                  onChange={handleApkUpload}
                                  disabled={uploadingApk}
                                  className="flex-1"
                                />
                                <Button
                                  disabled={uploadingApk}
                                  variant="outline"
                                >
                                  {uploadingApk ? (
                                    <>
                                      <Clock className="h-4 w-4 animate-spin mr-2" />
                                      Uploading...
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="h-4 w-4 mr-2" />
                                      Upload
                                    </>
                                  )}
                                </Button>
                              </div>
                              {updateData.apk_url && (
                                <div className="mt-3 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/30 rounded">
                                  <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-1">
                                    ✓ APK Available
                                  </p>
                                  <a
                                    href={updateData.apk_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-green-600 dark:text-green-500 break-all hover:underline"
                                  >
                                    {updateData.apk_url}
                                  </a>
                                </div>
                              )}
                            </div>

                            {/* How It Works */}
                            <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                              <CardHeader>
                                <CardTitle className="text-base">How It Works</CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-3 text-sm">
                                <div>
                                  <p className="font-semibold text-blue-900 dark:text-blue-100">1. Toggle Update Notifications</p>
                                  <p className="text-blue-800 dark:text-blue-200">
                                    Enable the toggle to start showing update notifications to users.
                                    <span className="block mt-1 font-bold">Note: Popup will show immediately for testing in web preview when enabled.</span>
                                  </p>
                                </div>
                                <div>
                                  <p className="font-semibold text-blue-900 dark:text-blue-100">2. Set Version Numbers</p>
                                  <p className="text-blue-800 dark:text-blue-200">
                                    Make sure current and latest version numbers are set correctly (auto-sync from build process)
                                  </p>
                                </div>
                                <div>
                                  <p className="font-semibold text-blue-900 dark:text-blue-100">3. Upload APK</p>
                                  <p className="text-blue-800 dark:text-blue-200">
                                    Upload the new APK file that users will download when they click "Update Now"
                                  </p>
                                </div>
                                <div>
                                  <p className="font-semibold text-blue-900 dark:text-blue-100">4. Set Custom Message</p>
                                  <p className="text-blue-800 dark:text-blue-200">
                                    Customize the message shown in the update popup to inform users about new features
                                  </p>
                                </div>
                              </CardContent>
                            </Card>
                          </>
                        ) : (
                          <div className="text-center py-8">
                            <p className="text-muted-foreground">Loading update settings...</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};
