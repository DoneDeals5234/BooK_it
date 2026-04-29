import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Phone, DollarSign, AlertCircle, CheckCircle, XCircle, Package, MapPin, Navigation, ExternalLink, User, Truck, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { getPendingOrdersForShop, getAllOrdersForShop, acceptOrder, rejectOrder, markOrderReady, markOrderOutForDelivery, markOrderDeliveredByOwner, updateDeliveryChoice, getStatusColor, getStatusDisplayName, formatOrderDate, type Order } from '@/lib/supabase-orders';
import { RejectOrderModal } from './RejectOrderModal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface OrderRequestsPanelProps {
  shopId: string;
}

export const OrderRequestsPanel = ({ shopId }: OrderRequestsPanelProps) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('all-orders');

  useEffect(() => {
    loadOrders();
    // Reload orders every 5 seconds
    const interval = setInterval(loadOrders, 5000);
    return () => clearInterval(interval);
  }, [shopId]);

  useEffect(() => {
    if (selectedStatus === 'all') {
      setFilteredOrders(orders);
    } else {
      setFilteredOrders(orders.filter(order => order.status === selectedStatus));
    }
  }, [selectedStatus, orders]);

  const loadOrders = async () => {
    try {
      const allOrders = await getAllOrdersForShop(shopId);
      setOrders(allOrders);
    } catch (error) {
      console.error('Error loading orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (orderId: string) => {
    setActionLoading(orderId);
    try {
      await acceptOrder(orderId);
      toast.success('Order accepted!');
      loadOrders();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to accept order';
      toast.error('Error: ' + errorMessage);
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
      toast.success('Order rejected');
      setShowRejectModal(false);
      setRejectingOrderId(null);
      loadOrders();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reject order';
      toast.error('Error: ' + errorMessage);
      throw error;
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkReady = async (orderId: string) => {
    setActionLoading(orderId);
    try {
      await markOrderReady(orderId);
      toast.success('Order marked as ready for collection!');
      loadOrders();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to mark order as ready';
      toast.error('Error: ' + errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateDeliveryChoice = async (orderId: string, choice: 'self' | 'book_it') => {
    setActionLoading(orderId);
    try {
      await updateDeliveryChoice(orderId, choice);
      const msg = choice === 'self' ? 'Self delivery selected! Order moved to Ready for Delivery.' : 'Book It Delivery requested! Book It team will be notified.';
      toast.success(msg);
      loadOrders();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update delivery choice';
      toast.error('Error: ' + errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkOutForDelivery = async (orderId: string) => {
    setActionLoading(orderId);
    try {
      await markOrderOutForDelivery(orderId);
      toast.success('Order is now Out for Delivery! 🚚');
      loadOrders();
    } catch (error) {
      toast.error('Failed to update status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkDelivered = async (orderId: string) => {
    setActionLoading(orderId);
    try {
      await markOrderDeliveredByOwner(orderId);
      toast.success('Order marked as Delivered! 🎉');
      loadOrders();
    } catch (error) {
      toast.error('Failed to complete delivery');
    } finally {
      setActionLoading(null);
    }
  };


  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const acceptedCount = orders.filter(o => o.status === 'accepted').length;
  const rejectedCount = orders.filter(o => o.status === 'rejected').length;
  const readyCount = orders.filter(o => o.status === 'ready_for_collection' || o.status === 'ready_for_delivery').length;
  const collectedCount = orders.filter(o => o.status === 'collected' || o.status === 'delivered').length;

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-2" />
          <p className="text-muted-foreground">Loading orders...</p>
        </CardContent>
      </Card>
    );
  }

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-2 opacity-50" />
          <p className="text-muted-foreground">No orders yet</p>
          <p className="text-xs text-muted-foreground mt-1">Orders from customers will appear here</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto w-full">
      <Tabs defaultValue="all-orders" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="all-orders" className="text-xs font-bold">All Orders</TabsTrigger>
          <TabsTrigger value="book-it" className="text-xs font-bold">Book It Delivery</TabsTrigger>
        </TabsList>

        <TabsContent value="all-orders" className="space-y-4">
          <OrderList 
            orders={filteredOrders}
            actionLoading={actionLoading}
            handleAccept={handleAccept}
            handleRejectClick={handleRejectClick}
            handleMarkReady={handleMarkReady}
            handleUpdateDeliveryChoice={handleUpdateDeliveryChoice}
            selectedStatus={selectedStatus}
            setSelectedStatus={setSelectedStatus}
            pendingCount={pendingCount}
            acceptedCount={acceptedCount}
            readyCount={readyCount}
            collectedCount={collectedCount}
          />
        </TabsContent>

        <TabsContent value="book-it" className="space-y-4">
          <OrderList 
            orders={orders.filter(o => o.delivery_choice === 'book_it')}
            actionLoading={actionLoading}
            handleAccept={handleAccept}
            handleRejectClick={handleRejectClick}
            handleMarkReady={handleMarkReady}
            handleUpdateDeliveryChoice={handleUpdateDeliveryChoice}
            isBookItTab={true}
          />
        </TabsContent>
      </Tabs>

      {/* Reject Order Modal */}
      <RejectOrderModal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setRejectingOrderId(null);
        }}
        onConfirm={handleRejectConfirm}
        customerName={
          orders.find(o => o.id === rejectingOrderId)?.customer_name || 'Customer'
        }
      />
    </div>
  );
};

interface OrderListProps {
  orders: Order[];
  actionLoading: string | null;
  handleAccept: (id: string) => Promise<void>;
  handleRejectClick: (id: string) => void;
  handleMarkReady: (id: string) => Promise<void>;
  handleUpdateDeliveryChoice: (id: string, choice: 'self' | 'book_it') => Promise<void>;
  selectedStatus?: string;
  setSelectedStatus?: (status: string) => void;
  pendingCount?: number;
  acceptedCount?: number;
  readyCount?: number;
  collectedCount?: number;
  isBookItTab?: boolean;
}

const OrderList = ({
  orders,
  actionLoading,
  handleAccept,
  handleRejectClick,
  handleMarkReady,
  handleUpdateDeliveryChoice,
  selectedStatus,
  setSelectedStatus,
  pendingCount,
  acceptedCount,
  readyCount,
  collectedCount,
  isBookItTab = false
}: OrderListProps) => {
  return (
    <div className="space-y-4">
      {!isBookItTab && setSelectedStatus && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedStatus('all')}>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{orders.length}</p>
              <p className="text-xs text-muted-foreground">All</p>
            </CardContent>
          </Card>
          <Card className={`cursor-pointer hover:shadow-md transition-shadow ${selectedStatus === 'pending' ? 'ring-2 ring-yellow-500' : ''}`} onClick={() => setSelectedStatus('pending')}>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </CardContent>
          </Card>
          <Card className={`cursor-pointer hover:shadow-md transition-shadow ${selectedStatus === 'accepted' ? 'ring-2 ring-green-500' : ''}`} onClick={() => setSelectedStatus('accepted')}>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-green-600">{acceptedCount}</p>
              <p className="text-xs text-muted-foreground">Accepted</p>
            </CardContent>
          </Card>
          <Card className={`cursor-pointer hover:shadow-md transition-shadow ${selectedStatus === 'ready_for_delivery' || selectedStatus === 'ready_for_collection' || selectedStatus === 'out_for_delivery' ? 'ring-2 ring-blue-500' : ''}`} onClick={() => setSelectedStatus('ready_for_delivery')}>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{(readyCount || 0) + orders.filter(o => o.status === 'out_for_delivery').length}</p>
              <p className="text-xs text-muted-foreground">Ready/Delivery</p>
            </CardContent>
          </Card>
          <Card className={`cursor-pointer hover:shadow-md transition-shadow ${selectedStatus === 'collected' ? 'ring-2 ring-gray-500' : ''}`} onClick={() => setSelectedStatus('collected')}>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-gray-600">{collectedCount}</p>
              <p className="text-xs text-muted-foreground">Collected</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="space-y-3">
        {orders.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">No orders found</p>
            </CardContent>
          </Card>
        ) : (
          orders.map((order) => (
            <Card key={order.id} className="hover:shadow-md transition-shadow overflow-hidden border-slate-100 dark:border-slate-800">
              <CardContent className="p-3 sm:p-4 space-y-3">
                {/* Header with Status Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                      {order.customer_name}
                    </h3>
                    <p className="text-xs text-muted-foreground">{formatOrderDate(order.created_at)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getStatusColor(order.status)}`}>
                      {getStatusDisplayName(order.status)}
                    </span>
                    {order.fulfillment_status && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                        order.fulfillment_status === 'order_complete' ? 'bg-green-100 text-green-700' :
                        order.fulfillment_status === 'delivery' ? 'bg-purple-100 text-purple-700' :
                        order.fulfillment_status === 'product_picking' ? 'bg-amber-100 text-amber-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {order.fulfillment_status === 'order_accepted' ? '✅ Accepted' :
                         order.fulfillment_status === 'product_picking' ? '📦 Picking' :
                         order.fulfillment_status === 'delivery' ? '🚚 Delivery' :
                         '🎉 Complete'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Details Section */}
                <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-xl space-y-3 border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-3 pb-2 border-b border-gray-100 dark:border-gray-800">
                    {order.product_image && (
                      <img src={order.product_image} alt="" className="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded-lg" />
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-sm sm:text-base text-gray-900 dark:text-white leading-tight truncate">
                        {order.product_name || 'Generic Order'}
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Qty: {order.quantity || 1}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-orange-600" />
                        <span className="text-sm font-bold text-orange-600">Total: ₹{order.total_amount || order.order_amount}</span>
                      </div>
                      <p className="text-[9px] text-muted-foreground ml-6">
                        Product: ₹{order.order_amount} {order.delivery_cost > 0 && `+ Delivery: ₹${order.delivery_cost}`}
                      </p>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-blue-600" />
                        <a href={`tel:${order.customer_phone}`} className="text-sm font-medium text-blue-600 hover:underline">
                          {order.customer_phone}
                        </a>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 px-2 text-[8px] sm:text-[9px] font-black text-blue-600 hover:text-blue-700 hover:bg-blue-50 mt-1"
                        onClick={() => window.open(`/profile/${order.customer_id}`, '_blank')}
                      >
                        <User className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" /> VISIT PROFILE
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1">
                        <MapPin className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-semibold text-gray-500 uppercase">Delivery Address</p>
                          <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2">
                            {order.customer_address || 'No address provided'}
                          </p>
                        </div>
                      </div>
                      {(order.location_link || (order.customer_lat && order.customer_lng)) && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 rounded-lg text-[10px] font-bold border-red-200 text-red-600 shrink-0"
                          onClick={() => window.open(order.location_link || `https://www.google.com/maps?q=${order.customer_lat},${order.customer_lng}`, '_blank')}
                        >
                          <MapPin className="h-3 w-3 mr-1" /> MAP LINK
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions Section */}
                <div className="space-y-2 pt-2 border-t">
                  {order.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleAccept(order.id)}
                        disabled={actionLoading === order.id}
                        className="flex-1 bg-green-600 hover:bg-green-700 h-9"
                        size="sm"
                      >
                        {actionLoading === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Accept'}
                      </Button>
                      <Button
                        onClick={() => handleRejectClick(order.id)}
                        disabled={actionLoading === order.id}
                        variant="outline"
                        className="flex-1 h-9 border-red-200 text-red-600"
                        size="sm"
                      >
                        {actionLoading === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reject'}
                      </Button>
                    </div>
                  )}

                  {order.status === 'accepted' && (
                    <div className="space-y-2">
                      {/* Delivery choice — only show toggle if not yet chosen */}
                      {(order.delivery_type === 'delivery' || !!order.customer_address) && (
                        order.delivery_choice === 'book_it' ? (
                          // Already transferred to Book It — show success card
                          <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-200 dark:bg-green-950/20 dark:border-green-800">
                            <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </div>
                            <div>
                              <p className="text-xs font-black text-green-800 dark:text-green-200">Successfully Transferred to Book It</p>
                              <p className="text-[10px] text-green-600 dark:text-green-400">Book It team is handling the delivery</p>
                            </div>
                          </div>
                        ) : order.delivery_choice === 'self' ? (
                          // Self delivery chosen — show info badge
                          <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl border bg-indigo-50 border-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-800">
                            <CheckCircle className="h-3 w-3 text-indigo-600" />
                            <span className="text-[10px] font-black uppercase text-indigo-600">Self Delivery Selected</span>
                          </div>
                        ) : (
                          // No choice yet — show the toggle
                          <div className="bg-blue-50 dark:bg-indigo-900/10 p-4 rounded-2xl border-2 border-indigo-100 dark:border-indigo-800 space-y-3 shadow-sm">
                            <p className="text-[11px] font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-widest text-center flex items-center justify-center gap-2">
                               <Package className="h-3 w-3" /> CHOOSE DELIVERY TYPE
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                              <Button
                                onClick={() => handleUpdateDeliveryChoice(order.id, 'self')}
                                disabled={actionLoading === order.id}
                                variant="outline"
                                className="text-[10px] font-black h-11 rounded-xl transition-all bg-white border-indigo-200"
                              >
                                SELF DELIVERY
                              </Button>
                              <Button
                                onClick={() => handleUpdateDeliveryChoice(order.id, 'book_it')}
                                disabled={actionLoading === order.id}
                                variant="outline"
                                className="text-[10px] font-black h-11 rounded-xl transition-all bg-white border-blue-200"
                              >
                                BOOK IT DELIVERY
                              </Button>
                            </div>
                          </div>
                        )
                      )}

                      {/* Pickup order — mark ready */}
                      {order.delivery_type !== 'delivery' && !order.customer_address && (
                        <Button
                          onClick={() => handleMarkReady(order.id)}
                          disabled={actionLoading === order.id}
                          className="w-full bg-blue-600 hover:bg-blue-700 h-10 font-bold rounded-xl"
                        >
                          {actionLoading === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Mark Ready for Collection'}
                        </Button>
                      )}
                    </div>
                  )}

                  {/* New Status Actions for Delivery */}
                  {order.status === 'ready_for_delivery' && (
                    <div className="space-y-2">
                      {order.customer_address && (
                        <Button
                          onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.customer_address || '')}`, '_blank')}
                          variant="outline"
                          className="w-full border-red-200 text-red-600 font-bold h-10 rounded-xl"
                        >
                          <Navigation className="mr-2 h-4 w-4" />
                          Go to Customer Home
                        </Button>
                      )}
                      <Button
                        onClick={() => handleMarkOutForDelivery(order.id)}
                        disabled={actionLoading === order.id}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 h-10 font-bold rounded-xl"
                      >
                        {actionLoading === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Mark as Out for Delivery'}
                      </Button>
                    </div>
                  )}

                  {order.status === 'out_for_delivery' && (
                    <Button
                      onClick={() => handleMarkDelivered(order.id)}
                      disabled={actionLoading === order.id}
                      className="w-full bg-green-600 hover:bg-green-700 h-10 font-bold rounded-xl"
                    >
                      {actionLoading === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Order Delivered'}
                    </Button>
                  )}

                  {order.delivery_choice === 'book_it' && (
                    <div className="mt-4 p-4 rounded-2xl bg-blue-600 text-white shadow-lg overflow-hidden relative group">
                      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Truck className="h-16 w-16" />
                      </div>
                      <div className="relative z-10 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-black uppercase tracking-widest text-blue-100 flex items-center gap-2">
                            <Clock className="h-3 w-3" /> Book It Live Status
                          </p>
                          <span className="px-2 py-0.5 rounded-full bg-white/20 text-[9px] font-black uppercase">
                            {order.book_it_status || 'Sent'}
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between gap-1">
                          <div className={`flex-1 h-1.5 rounded-full ${order.book_it_status ? 'bg-white' : 'bg-white/30'}`} />
                          <div className={`flex-1 h-1.5 rounded-full ${['picking_up', 'delivering', 'delivered'].includes(order.book_it_status || '') ? 'bg-white' : 'bg-white/30'}`} />
                          <div className={`flex-1 h-1.5 rounded-full ${['delivering', 'delivered'].includes(order.book_it_status || '') ? 'bg-white' : 'bg-white/30'}`} />
                          <div className={`flex-1 h-1.5 rounded-full ${order.book_it_status === 'delivered' ? 'bg-white' : 'bg-white/30'}`} />
                        </div>

                        <div className="space-y-1">
                          <p className="font-bold text-sm leading-tight">
                            {order.book_it_status === 'accepted' ? 'Book It accepted the request' :
                             order.book_it_status === 'picking_up' ? 'Picking up from your store' :
                             order.book_it_status === 'delivering' ? 'Delivering your product' :
                             order.book_it_status === 'delivered' ? 'Product delivered' :
                             'Request successfully sent to Book It'}
                          </p>
                          <p className="text-[10px] text-blue-100 opacity-80">
                            Book It team is managing your fulfillment. Tracking active.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}


                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
