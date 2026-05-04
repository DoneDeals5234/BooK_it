import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Phone, IndianRupee, AlertCircle, CheckCircle, XCircle, Package, MapPin, Navigation, ExternalLink, User, Truck, Clock, Printer, Download, ImageIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { notifySuccess } from '@/lib/notification-helper';
import { getPendingOrdersForShop, getAllOrdersForShop, acceptOrder, rejectOrder, markOrderReady, markOrderOutForDelivery, markOrderDeliveredByOwner, markOrderDeliveredWithOtp, updateDeliveryChoice, updateOrderPaymentStatus, getStatusColor, getStatusDisplayName, formatOrderDate, type Order } from '@/lib/supabase-orders';
import { getPrintingOrderForMainOrder, getBatchPrintingOrdersForOrders, type PrintingOrder } from '@/lib/supabase-printing';
import { RejectOrderModal } from './RejectOrderModal';
import { OtpVerificationModal } from './OtpVerificationModal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { isCapacitor } from '@/lib/capacitor-notifications';

interface OrderRequestsPanelProps {
  shopId: string;
}

export const OrderRequestsPanel = ({ shopId }: OrderRequestsPanelProps) => {
  const [orders, setOrders] = useState<(Order & { printing?: PrintingOrder | null })[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<(Order & { printing?: PrintingOrder | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('pickup-orders');
  const [viewingImages, setViewingImages] = useState<{urls: string[], index: number} | null>(null);
  const [verifyingOrderId, setVerifyingOrderId] = useState<string | null>(null);
  const [showOtpModal, setShowOtpModal] = useState(false);

  useEffect(() => {
    loadOrders(false); // Initial load with spinner
    const interval = setInterval(() => loadOrders(true), 5000); // Background refreshes without spinner
    return () => clearInterval(interval);
  }, [shopId]);

  useEffect(() => {
    const tabOrders = getTabOrders();
    
    if (selectedStatus === 'all') {
      setFilteredOrders(tabOrders);
    } else if (selectedStatus === 'processing') {
      setFilteredOrders(tabOrders.filter(order => 
        order.status === 'accepted' && 
        (order.delivery_type === 'pickup' || order.delivery_type === 'delivery')
      ));
    } else if (selectedStatus === 'prepared') {
      setFilteredOrders(tabOrders.filter(order => order.status === 'ready_for_collection'));
    } else if (selectedStatus === 'ready_delivery') {
      setFilteredOrders(tabOrders.filter(order => 
        (order.status === 'ready_for_delivery' || order.status === 'out_for_delivery')
      ));
    } else {
      setFilteredOrders(tabOrders.filter(order => order.status === selectedStatus));
    }
  }, [selectedStatus, orders, activeTab]);

  const loadOrders = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const allOrders = await getAllOrdersForShop(shopId);
      
      // Get all order IDs to fetch printing details in one go
      const orderIds = allOrders.map(o => o.id);
      const printingMap = await getBatchPrintingOrdersForOrders(orderIds);
      
      const ordersWithPrinting = allOrders.map(order => ({
        ...order,
        printing: printingMap[order.id] || null
      }));
      
      setOrders(ordersWithPrinting);
    } catch (error) {
      console.error('Error loading orders:', error);
      if (!isBackground) toast.error('Failed to load orders. Please refresh.');
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  const handleAccept = async (orderId: string) => {
    setActionLoading(orderId);
    try {
      await acceptOrder(orderId);
      notifySuccess('Order accepted!', 'Order Update');
      loadOrders();
    } catch (error) {
      toast.error('Failed to accept order');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectClick = (orderId: string) => {
    setRejectingOrderId(orderId);
    setShowRejectModal(true);
  };

  const handleRejectConfirm = async (reason: string, notes?: string) => {
    if (!rejectingOrderId) return;
    setActionLoading(rejectingOrderId);
    try {
      await rejectOrder(rejectingOrderId, reason, notes);
      notifySuccess('Order rejected', 'Order Update');
      setShowRejectModal(false);
      setRejectingOrderId(null);
      loadOrders();
    } catch (error) {
      toast.error('Failed to reject order');
      throw error;
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkReady = async (orderId: string) => {
    setActionLoading(orderId);
    try {
      await markOrderReady(orderId);
      notifySuccess('Order marked as ready for collection!', 'Order Update');
      loadOrders();
    } catch (error) {
      toast.error('Failed to mark order as ready');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateDeliveryChoice = async (orderId: string, choice: 'self' | 'book_it') => {
    setActionLoading(orderId);
    try {
      await updateDeliveryChoice(orderId, choice);
      const msg = choice === 'self' ? 'Self delivery selected!' : 'Book It Delivery requested!';
      notifySuccess(msg, 'Delivery Update');
      loadOrders();
    } catch (error) {
      toast.error('Failed to update delivery choice');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkOutForDelivery = async (orderId: string) => {
    setActionLoading(orderId);
    try {
      await markOrderOutForDelivery(orderId);
      notifySuccess('Order is now Out for Delivery! 🚚', 'Delivery Update');
      loadOrders();
    } catch (error) {
      toast.error('Failed to update status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkDelivered = async (orderId: string) => {
    setVerifyingOrderId(orderId);
    setShowOtpModal(true);
  };

  const handleOtpConfirm = async (otp: string) => {
    if (!verifyingOrderId) return;
    try {
      await markOrderDeliveredWithOtp(verifyingOrderId, otp);
      notifySuccess('Order delivered successfully! 🎉', 'Order Complete');
      setShowOtpModal(false);
      setVerifyingOrderId(null);
      loadOrders();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'OTP Verification failed');
      throw error;
    }
  };

  const handleVerifyPayment = async (orderId: string, status: 'paid' | 'unpaid') => {
    setActionLoading(orderId);
    try {
      await updateOrderPaymentStatus(orderId, status);
      notifySuccess(`Payment marked as ${status.toUpperCase()}!`, 'Payment Update');
      loadOrders();
    } catch (error) {
      toast.error('Failed to update payment status');
    } finally {
      setActionLoading(null);
    }
  };

  const getTabOrders = () => {
    if (activeTab === 'pickup-orders') {
      // Show orders that are pickup and haven't had a delivery choice made
      return orders.filter(o => 
        (o.delivery_type === 'pickup' || !o.delivery_type) && 
        !o.delivery_choice
      );
    }
    if (activeTab === 'self-delivery') {
      // Show orders where owner explicitly chose self delivery 
      // OR it's a delivery order that hasn't had a choice yet
      return orders.filter(o => 
        o.delivery_choice === 'self' || 
        (o.delivery_type === 'delivery' && !o.delivery_choice)
      );
    }
    if (activeTab === 'book-it') {
      // Show orders where owner explicitly chose book_it
      return orders.filter(o => o.delivery_choice === 'book_it');
    }
    return orders;
  };

  const currentTabOrders = getTabOrders();
  const counts = {
    pending: currentTabOrders.filter(o => o.status === 'pending').length,
    accepted: currentTabOrders.filter(o => o.status === 'accepted').length,
    rejected: currentTabOrders.filter(o => o.status === 'rejected').length,
    processing: currentTabOrders.filter(o => o.status === 'accepted' && (o.delivery_type === 'pickup' || o.delivery_type === 'delivery')).length,
    prepared: currentTabOrders.filter(o => o.status === 'ready_for_collection').length,
    readyDelivery: currentTabOrders.filter(o => (o.status === 'ready_for_delivery' || o.status === 'out_for_delivery')).length,
    collected: currentTabOrders.filter(o => o.status === 'collected' || o.status === 'delivered').length,
  };

  if (loading) {
    return (
      <Card><CardContent className="pt-6 text-center"><Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-2" /><p className="text-muted-foreground">Loading orders...</p></CardContent></Card>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto w-full">
      <Tabs defaultValue="pickup-orders" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="pickup-orders" className="text-xs font-bold">Shop Pick up</TabsTrigger>
          <TabsTrigger value="self-delivery" className="text-xs font-bold">Self Delivery</TabsTrigger>
          <TabsTrigger value="book-it" className="text-xs font-bold">Book It Delivery</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          <OrderList 
            orders={filteredOrders}
            actionLoading={actionLoading}
            handleAccept={handleAccept}
            handleRejectClick={handleRejectClick}
            handleMarkReady={handleMarkReady}
            handleUpdateDeliveryChoice={handleUpdateDeliveryChoice}
            handleMarkOutForDelivery={handleMarkOutForDelivery}
            handleMarkDelivered={handleMarkDelivered}
            handleVerifyPayment={handleVerifyPayment}
            selectedStatus={selectedStatus}
            setSelectedStatus={setSelectedStatus}
            counts={counts}
            isBookItTab={activeTab === 'book-it'}
            onViewImages={(urls, index) => setViewingImages({urls, index})}
          />
        </TabsContent>
      </Tabs>

      <RejectOrderModal isOpen={showRejectModal} onClose={() => setShowRejectModal(false)} onConfirm={handleRejectConfirm} customerName={orders.find(o => o.id === rejectingOrderId)?.customer_name || 'Customer'} />
      <OtpVerificationModal isOpen={showOtpModal} onClose={() => setShowOtpModal(false)} onConfirm={handleOtpConfirm} customerName={orders.find(o => o.id === verifyingOrderId)?.customer_name || 'Customer'} />
      
      <Dialog open={!!viewingImages} onOpenChange={(open) => !open && setViewingImages(null)}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] p-0 overflow-hidden bg-black/95 border-none">
          <div className="relative w-full h-full flex flex-col">
            <div className="absolute top-4 right-4 z-50">
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full" onClick={() => setViewingImages(null)}><X className="h-6 w-6" /></Button>
            </div>
            <div className="flex-1 flex items-center justify-center p-4">
              {viewingImages && <img src={viewingImages.urls[viewingImages.index]} alt="Full view" className="max-w-full max-h-[70vh] object-contain" />}
            </div>
            {viewingImages && viewingImages.urls.length > 1 && (
              <div className="flex items-center justify-between p-6 bg-gradient-to-t from-black to-transparent">
                <Button variant="outline" size="icon" className="text-white rounded-full" disabled={viewingImages.index === 0} onClick={() => setViewingImages({...viewingImages, index: viewingImages.index - 1})}><ChevronLeft className="h-6 w-6" /></Button>
                <div className="text-white text-xs font-black">{viewingImages.index + 1} / {viewingImages.urls.length}</div>
                <Button variant="outline" size="icon" className="text-white rounded-full" disabled={viewingImages.index === viewingImages.urls.length - 1} onClick={() => setViewingImages({...viewingImages, index: viewingImages.index + 1})}><ChevronRight className="h-6 w-6" /></Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface OrderListProps {
  orders: any[];
  actionLoading: string | null;
  handleAccept: (id: string) => Promise<void>;
  handleRejectClick: (id: string) => void;
  handleMarkReady: (id: string) => Promise<void>;
  handleUpdateDeliveryChoice: (id: string, choice: 'self' | 'book_it') => Promise<void>;
  handleMarkOutForDelivery?: (id: string) => Promise<void>;
  handleMarkDelivered?: (id: string) => Promise<void>;
  handleVerifyPayment: (id: string, status: 'paid' | 'unpaid') => Promise<void>;
  selectedStatus?: string;
  setSelectedStatus?: (status: string) => void;
  counts: any;
  isBookItTab?: boolean;
  onViewImages: (urls: string[], index: number) => void;
}

const OrderList = ({ orders, actionLoading, handleAccept, handleRejectClick, handleMarkReady, handleUpdateDeliveryChoice, handleMarkOutForDelivery, handleMarkDelivered, handleVerifyPayment, selectedStatus, setSelectedStatus, counts, isBookItTab, onViewImages }: OrderListProps) => {
  return (
    <div className="space-y-4">
      {!isBookItTab && setSelectedStatus && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {[
            { id: 'all', label: 'All', count: orders.length, color: 'primary' },
            { id: 'pending', label: 'Requests', count: counts.pending, color: 'yellow-500' },
            { id: 'accepted', label: 'Accepted', count: counts.accepted, color: 'green-600' },
            { id: 'rejected', label: 'Rejected', count: counts.rejected, color: 'red-600' },
            { id: 'processing', label: 'Processing', count: counts.processing, color: 'orange-600' },
            { id: 'prepared', label: 'Prepared', count: counts.prepared, color: 'blue-600' },
            { id: 'ready_delivery', label: 'Ready/Del', count: counts.readyDelivery, color: 'indigo-600' },
            { id: 'collected', label: 'Completed', count: counts.collected, color: 'gray-600' }
          ].map(s => (
            <Card key={s.id} className={`cursor-pointer transition-all ${selectedStatus === s.id ? 'ring-2 ring-primary bg-primary/5' : ''}`} onClick={() => setSelectedStatus(s.id)}>
              <CardContent className="p-2 text-center">
                <p className={`text-lg font-black text-${s.color}`}>{s.count}</p>
                <p className="text-[8px] font-bold text-muted-foreground uppercase">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {orders.length === 0 ? (
          <Card><CardContent className="pt-6 text-center text-muted-foreground text-sm">No orders found</CardContent></Card>
        ) : (
          orders.map((order) => (
            <OrderCard 
              key={order.id} 
              order={order} 
              actionLoading={actionLoading} 
              handleAccept={handleAccept} 
              handleRejectClick={handleRejectClick} 
              handleMarkReady={handleMarkReady} 
              handleUpdateDeliveryChoice={handleUpdateDeliveryChoice} 
              handleMarkOutForDelivery={handleMarkOutForDelivery} 
              handleMarkDelivered={handleMarkDelivered} 
              handleVerifyPayment={handleVerifyPayment}
              onViewImages={onViewImages} 
            />
          ))
        )}
      </div>
    </div>
  );
};

const OrderCard = ({ order, actionLoading, handleAccept, handleRejectClick, handleMarkReady, handleUpdateDeliveryChoice, handleMarkOutForDelivery, handleMarkDelivered, handleVerifyPayment, onViewImages }: any) => {
  return (
    <Card className="hover:shadow-md transition-shadow overflow-hidden border-slate-100">
      <CardContent className="p-3 sm:p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 truncate">{order.customer_name}</h3>
            <p className="text-[10px] text-muted-foreground">{formatOrderDate(order.created_at)}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${getStatusColor(order.status)}`}>
              {getStatusDisplayName(order.status)}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase whitespace-nowrap ${
              (order.delivery_type === 'delivery' || (order.customer_address && order.customer_address !== 'PICKUP FROM SHOP')) ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
            }`}>
              {(order.delivery_type === 'delivery' || (order.customer_address && order.customer_address !== 'PICKUP FROM SHOP')) ? '🚚 Delivery' : '🛍️ Pickup'}
            </span>
          </div>
        </div>

        {/* Product Info */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center gap-3">
          {order.product_image && <img src={order.product_image} alt="" className="w-12 h-12 object-cover rounded-lg border shadow-sm" />}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-slate-900 leading-tight truncate">{order.product_name || 'Generic Order'}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-black text-orange-600">₹{(order.total_amount || order.order_amount).toFixed(2)}</span>
              <span className="text-[10px] text-slate-500 font-bold">Qty: {order.quantity || 1}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <a href={`tel:${order.customer_phone}`} className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><Phone className="h-4 w-4" /></a>
          </div>
        </div>

        {/* Payment Verification Section */}
        {order.payment_status === 'pending_verification' && order.payment_screenshot_url && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl space-y-3">
            <p className="text-[10px] font-black text-amber-800 uppercase flex items-center gap-2">
              <Clock className="h-3 w-3" /> Verify Advance Payment
            </p>
            <Button 
              variant="outline"
              className="w-full h-10 rounded-xl border-dashed border-amber-300 text-amber-700 font-bold text-[10px] uppercase bg-white"
              onClick={() => window.open(order.payment_screenshot_url, '_blank')}
            >
              <ImageIcon className="h-3.5 w-3.5 mr-2" /> View Screenshot
            </Button>
            <div className="flex gap-2">
              <Button 
                className="flex-1 h-10 rounded-xl bg-green-600 hover:bg-green-700 text-white font-black text-[10px] uppercase shadow-lg shadow-green-100" 
                onClick={() => handleVerifyPayment(order.id, 'paid')} 
                disabled={!!actionLoading}
              >
                {actionLoading === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Approve'}
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 h-10 rounded-xl border-red-200 text-red-600 hover:bg-red-50 font-black text-[10px] uppercase" 
                onClick={() => handleVerifyPayment(order.id, 'unpaid')} 
                disabled={!!actionLoading}
              >
                {actionLoading === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reject'}
              </Button>
            </div>
          </div>
        )}

        {order.payment_status === 'paid' && (
          <div className="bg-green-50 border border-green-200 p-3 rounded-xl flex items-center justify-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-[10px] font-black text-green-700 uppercase tracking-widest">Payment Verified</span>
          </div>
        )}

        {/* Printing Details */}
        {(order.printing) && (
          <div className="p-3 bg-red-50 border border-red-100 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-red-600 uppercase tracking-widest flex items-center gap-1"><Printer className="h-3 w-3" /> Print Details</span>
              <Button size="sm" variant="ghost" className="h-6 text-[10px] font-black text-red-600" onClick={() => onViewImages(order.printing.documentUrls, 0)}>VIEW DOCUMENTS</Button>
            </div>
            <div className="flex gap-2">
              <span className="px-2 py-0.5 rounded-lg bg-white text-[9px] font-bold text-red-800">{order.printing.isColor ? 'Color' : 'B&W'}</span>
              <span className="px-2 py-0.5 rounded-lg bg-white text-[9px] font-bold text-red-800">{order.printing.isDoubleSided ? 'Double-sided' : 'Single-sided'}</span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="pt-2 border-t">
          {order.status === 'pending' && (
            <div className="flex gap-2">
              <Button 
                className="flex-1 bg-green-600 hover:bg-green-700 h-10 font-bold rounded-xl shadow-lg shadow-green-100" 
                onClick={() => handleAccept(order.id)} 
                disabled={actionLoading === order.id}
              >
                {actionLoading === order.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Accept
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 h-10 border-red-200 text-red-600 rounded-xl" 
                onClick={() => handleRejectClick(order.id)} 
                disabled={actionLoading === order.id}
              >
                {actionLoading === order.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                Reject
              </Button>
            </div>
          )}

          {order.status === 'accepted' && (
            <div className="space-y-3">
              {(order.delivery_type === 'delivery' || (order.customer_address && order.customer_address !== 'PICKUP FROM SHOP')) ? (
                order.delivery_choice === 'book_it' ? (
                  <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                    <Truck className="h-4 w-4 text-green-600" />
                    <p className="text-[10px] font-bold text-green-800 uppercase tracking-widest">Handed over to Book It</p>
                  </div>
                ) : order.delivery_choice === 'self' ? (
                   <Button 
                    className="w-full bg-indigo-600 h-10 font-bold rounded-xl" 
                    onClick={() => handleMarkOutForDelivery?.(order.id)} 
                    disabled={actionLoading === order.id}
                   >
                    {actionLoading === order.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Truck className="h-4 w-4 mr-2" />}
                    Mark Out for Delivery
                   </Button>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      variant="outline" 
                      className="h-10 rounded-xl text-[10px] font-black uppercase border-indigo-200" 
                      onClick={() => handleUpdateDeliveryChoice(order.id, 'self')}
                      disabled={actionLoading === order.id}
                    >
                      {actionLoading === order.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : 'Self Delivery'}
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-10 rounded-xl text-[10px] font-black uppercase border-blue-200" 
                      onClick={() => handleUpdateDeliveryChoice(order.id, 'book_it')}
                      disabled={actionLoading === order.id}
                    >
                      {actionLoading === order.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : 'Book It Delivery'}
                    </Button>
                  </div>
                )
              ) : (
                <Button 
                  className="w-full bg-blue-600 h-10 font-bold rounded-xl" 
                  onClick={() => handleMarkReady(order.id)} 
                  disabled={actionLoading === order.id}
                >
                  {actionLoading === order.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Package className="h-4 w-4 mr-2" />}
                  Mark Ready for Collection
                </Button>
              )}
            </div>
          )}

          {order.status === 'ready_for_collection' && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <p className="text-xs font-bold text-green-800">Ready for Collection</p>
            </div>
          )}

          {order.status === 'out_for_delivery' && (
            <Button 
              className="w-full bg-green-600 h-10 font-bold rounded-xl" 
              onClick={() => handleMarkDelivered?.(order.id)} 
              disabled={actionLoading === order.id}
            >
              {actionLoading === order.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Mark Delivered
            </Button>
          )}

          {order.delivery_choice === 'book_it' && (
            <div className="mt-2 p-3 bg-blue-600 text-white rounded-xl space-y-2 shadow-lg shadow-blue-100">
               <div className="flex items-center justify-between">
                 <p className="text-[9px] font-black uppercase tracking-widest opacity-80 flex items-center gap-2">
                    <Truck className="h-3 w-3" /> Book It Live Tracking
                 </p>
                 <span className="px-2 py-0.5 rounded-full bg-white/20 text-[8px] font-black uppercase">Active</span>
               </div>
               <div className="flex items-center gap-3">
                 <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                 <p className="text-xs font-bold">{order.book_it_status ? order.book_it_status.replace(/_/g, ' ').toUpperCase() : 'PENDING PICKUP'}</p>
               </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
