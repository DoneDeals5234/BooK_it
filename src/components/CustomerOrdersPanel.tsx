import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, MapPin, Package, CheckCircle, XCircle, Clock, Truck, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { getCustomerOrders, markOrderDelivered, cancelOrder, getStatusColor, getStatusDisplayName, formatOrderDate, type Order } from '@/lib/supabase-orders';
import { OrderCollectionModal } from './OrderCollectionModal';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { IndianRupee, Navigation, CreditCard, ImageIcon } from 'lucide-react';
import { getShopById, type Shop } from '@/lib/shops-storage';
import { UpiPaymentModal } from './UpiPaymentModal';

interface CustomerOrdersPanelProps {
  customerId: string;
}

export const CustomerOrdersPanel = ({ customerId }: CustomerOrdersPanelProps) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [activeOrderTab, setActiveOrderTab] = useState<string>('pickup');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState<{orderId: string, amount: number, upiId: string, shopName: string} | null>(null);
  const [shopsData, setShopsData] = useState<Record<string, Shop>>({});

  const pickupOrders = orders.filter(o => (o.delivery_type === 'pickup' || (!o.customer_address || o.customer_address === 'PICKUP FROM SHOP')) && !['delivered', 'collected'].includes(o.status));
  const deliveryOrders = orders.filter(o => o.delivery_type === 'delivery' && o.customer_address && o.customer_address !== 'PICKUP FROM SHOP' && !['delivered', 'collected'].includes(o.status));
  const completedOrders = orders.filter(o => ['delivered', 'collected'].includes(o.status));

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 5000);
    return () => clearInterval(interval);
  }, [customerId]);

  const loadOrders = async () => {
    try {
      const customerOrders = await getCustomerOrders(customerId);
      setOrders(customerOrders);
      
      // Load unique shops data
      const shopIds = [...new Set(customerOrders.map(o => o.shop_id))];
      const newShopsData: Record<string, Shop> = { ...shopsData };
      for (const id of shopIds) {
        if (!newShopsData[id]) {
          const shop = await getShopById(id);
          if (shop) newShopsData[id] = shop;
        }
      }
      setShopsData(newShopsData);
    } catch (error) {
      console.error('Error loading orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const handleCollectClick = (order: Order) => {
    setSelectedOrder(order);
    setShowCollectionModal(true);
  };

  const handleCompleteOrder = async (orderId: string) => {
    if (!confirm('Have you received your order?')) return;
    try {
      await markOrderDelivered(orderId);
      toast.success('Order completed! Thank you.');
      loadOrders();
    } catch (error) {
      toast.error('Failed to complete order');
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    try {
      await cancelOrder(orderId);
      toast.success('Order cancelled successfully');
      loadOrders();
    } catch (error) {
      toast.error('Failed to cancel order');
    }
  };

  const handleGoToShop = async (shopId: string) => {
    try {
      const shop = await getShopById(shopId);
      if (shop?.locationMapLink) {
        window.open(shop.locationMapLink, '_blank');
      } else if (shop?.latitude && shop?.longitude) {
        window.open(`https://www.google.com/maps?q=${shop.latitude},${shop.longitude}`, '_blank');
      } else {
        toast.error('Shop location not found');
      }
    } catch (error) {
      toast.error('Failed to fetch shop location');
    }
  };

  const handlePayAdvance = (order: Order, shop: Shop) => {
    if (!shop.upiId) {
      toast.error('Shop UPI ID not configured');
      return;
    }
    setPaymentOrder({
      orderId: order.id,
      amount: order.order_amount,
      upiId: shop.upiId,
      shopName: shop.name
    });
    setShowPaymentModal(true);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500 mb-4" />
        <p className="text-muted-foreground animate-pulse">Fetching your orders...</p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <Card className="border-dashed border-2 bg-gray-50/50">
        <CardContent className="pt-10 pb-10 text-center space-y-4">
          <Package className="h-16 w-16 text-gray-200 mx-auto" />
          <div>
            <p className="text-lg font-bold text-gray-400">No Orders Yet</p>
            <p className="text-sm text-gray-400">Items you order will appear here for tracking.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xl font-black text-gray-900 dark:text-white">My Orders</h2>
        <span className="text-xs font-bold text-orange-500 bg-orange-50 px-2 py-1 rounded-full">
          {orders.filter(o => o.status !== 'collected' && o.status !== 'delivered').length} ACTIVE
        </span>
      </div>

      <Tabs defaultValue="pickup" value={activeOrderTab} onValueChange={setActiveOrderTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
          <TabsTrigger value="pickup" className="rounded-lg font-black text-[10px] uppercase tracking-wider py-2 data-[state=active]:bg-white data-[state=active]:text-orange-600">
            Self Pick Up ({pickupOrders.length})
          </TabsTrigger>
          <TabsTrigger value="delivery" className="rounded-lg font-black text-[10px] uppercase tracking-wider py-2 data-[state=active]:bg-white data-[state=active]:text-blue-600">
            Home Delivery ({deliveryOrders.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="rounded-lg font-black text-[10px] uppercase tracking-wider py-2 data-[state=active]:bg-white data-[state=active]:text-green-600">
            Completed ({completedOrders.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pickup">
          <div className="grid gap-4">
            {pickupOrders.length === 0 ? (
              <p className="text-center py-10 text-muted-foreground text-sm font-medium">No pickup orders yet</p>
            ) : (
              pickupOrders.map((order) => (
                <OrderCard 
                  key={order.id} 
                  order={order} 
                  onTrack={() => handleCollectClick(order)}
                  onComplete={() => handleCompleteOrder(order.id)}
                  onCancel={() => handleCancelOrder(order.id)}
                  onGoToShop={() => handleGoToShop(order.shop_id)}
                  shop={shopsData[order.shop_id]}
                  onPay={() => handlePayAdvance(order, shopsData[order.shop_id])}
                />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="delivery">
          <div className="grid gap-4">
            {deliveryOrders.length === 0 ? (
              <p className="text-center py-10 text-muted-foreground text-sm font-medium">No delivery orders yet</p>
            ) : (
              deliveryOrders.map((order) => (
                <OrderCard 
                  key={order.id} 
                  order={order} 
                  onTrack={() => handleCollectClick(order)}
                  onComplete={() => handleCompleteOrder(order.id)}
                  onCancel={() => handleCancelOrder(order.id)}
                  shop={shopsData[order.shop_id]}
                  onPay={() => handlePayAdvance(order, shopsData[order.shop_id])}
                />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="completed">
          <div className="grid gap-4">
            {completedOrders.length === 0 ? (
              <div className="text-center py-10 bg-gray-50 rounded-2xl border-2 border-dashed">
                <CheckCircle className="h-10 w-10 text-gray-200 mx-auto mb-2" />
                <p className="text-xs font-bold text-gray-400">No completed orders yet</p>
              </div>
            ) : (
              completedOrders.map((order) => (
                <OrderCard 
                  key={order.id} 
                  order={order} 
                  onTrack={() => {}}
                  onComplete={() => {}}
                  onCancel={() => {}}
                  shop={shopsData[order.shop_id]}
                />
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Order Collection Modal */}
      {paymentOrder && (
        <UpiPaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          orderId={paymentOrder.orderId}
          amount={paymentOrder.amount}
          upiId={paymentOrder.upiId}
          shopName={paymentOrder.shopName}
          onSuccess={loadOrders}
        />
      )}

      {selectedOrder && (
        <OrderCollectionModal
          isOpen={showCollectionModal}
          onClose={() => {
            setShowCollectionModal(false);
            setSelectedOrder(null);
          }}
          order={selectedOrder}
        />
      )}
    </div>
  );
};

interface OrderCardProps {
  order: Order;
  onTrack: () => void;
  onComplete: () => void;
  onCancel: () => void;
  onGoToShop?: () => void;
  shop?: Shop;
  onPay?: () => void;
}

const OrderCard = ({ order, onTrack, onComplete, onCancel, onGoToShop, shop, onPay }: OrderCardProps) => {
  const canCancelPickup = order.delivery_type === 'pickup' && !['ready_for_collection', 'collected', 'delivered', 'rejected'].includes(order.status);
  const canCancelDelivery = order.delivery_type === 'delivery' && order.status === 'pending';
  const canCancel = canCancelPickup || canCancelDelivery;

  return (
    <Card 
      className={`overflow-hidden border-none shadow-sm transition-all active:scale-[0.98] ${
        order.status === 'rejected' ? 'opacity-90' : ''
      }`}
    >
      <CardContent className="p-0">
        {/* Header: Status & ID */}
        <div className={`px-4 py-2 flex items-center justify-between ${getStatusColor(order.status)}`}>
          <span className="text-[10px] font-black uppercase tracking-widest opacity-80">
            ID: {order.order_code || '------'}
          </span>
          <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
            {order.status === 'accepted' || order.status === 'ready_for_collection' ? (
              <CheckCircle className="h-3 w-3" />
            ) : order.status === 'rejected' ? (
              <XCircle className="h-3 w-3" />
            ) : (
              <Loader2 className="h-3 w-3 animate-spin" />
            )}
            {getStatusDisplayName(order.status)}
          </span>
        </div>

        {/* Main Content */}
        <div className="px-4 py-3 flex gap-3 items-center">
          {order.product_image && (
            <img 
              src={order.product_image} 
              alt={order.product_name} 
              className="w-12 h-12 rounded-xl object-cover border border-slate-100 shadow-sm"
            />
          )}
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-slate-900 text-sm leading-tight truncate">
              {order.product_name}
            </h4>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs font-black text-blue-600">₹{(order.total_amount || order.order_amount).toFixed(2)}</span>
              <span className="text-[10px] text-slate-500 font-bold">Qty: {order.quantity || 1}</span>
            </div>
          </div>
        </div>

        {/* Payment Warning for Compulsory Mode */}
        {order.status === 'pending' && 
         order.payment_status === 'unpaid' && 
         shop?.advancePaymentMode === 'compulsory' && (
          <div className="mx-4 mb-3 p-3 rounded-xl bg-red-50 border border-red-100 flex items-center gap-2 animate-pulse">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
            <p className="text-[10px] font-bold text-red-700 uppercase">
              Advance payment required to process your order
            </p>
          </div>
        )}

        <div className="p-4 space-y-4 pt-0">
          <div className="mt-2 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-3 w-3 text-orange-600" />
              <span className="text-sm font-black text-orange-600">Total: ₹{(order.total_amount || order.order_amount).toFixed(2)}</span>
            </div>
            <p className="text-[10px] text-gray-400 font-bold">
              Product: ₹{order.order_amount.toFixed(2)} {order.delivery_cost > 0 && `+ Delivery: ₹${order.delivery_cost.toFixed(2)}`}
            </p>
          </div>

          {/* Delivery Info */}
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
            <div className="flex items-start gap-2">
              <MapPin className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-gray-600 leading-tight">
                <strong>{order.delivery_type === 'delivery' ? 'Delivery to:' : 'Pickup from:'}</strong><br/>
                {order.delivery_type === 'delivery' ? (order.customer_address || 'No address provided') : (order.shop_name || 'Shop Location')}
              </p>
            </div>
          </div>

          {/* Status Specific Messages */}
          {order.status === 'pending' && (
            <div className="space-y-3">
              <p className="text-[11px] text-center text-yellow-600 font-bold bg-yellow-50 py-1 rounded-lg">
                ⏳ Waiting for shop owner to confirm...
              </p>
            </div>
          )}

          {/* OTP for Delivery Orders */}
          {order.delivery_type === 'delivery' && order.otp_code && order.status !== 'delivered' && (
            <div className="bg-indigo-600 p-3 rounded-xl text-center shadow-lg shadow-indigo-100">
              <p className="text-[9px] font-black text-indigo-100 uppercase tracking-widest mb-1">Delivery OTP</p>
              <p className="text-2xl font-black text-white tracking-[0.5em] ml-[0.5em]">{order.otp_code}</p>
              <p className="text-[8px] font-bold text-indigo-200 mt-1">Share this with the rider only when you receive your order</p>
            </div>
          )}

          {order.status === 'rejected' && order.rejection_notes && (
            <p className="text-[11px] text-red-600 font-bold bg-red-50 p-2 rounded-lg border border-red-100">
              ❌ REJECTED: {order.rejection_notes}
            </p>
          )}

          {/* Book It Live Status Ribbon */}
          {order.delivery_choice === 'book_it' && (
            <div className="p-3 rounded-xl bg-blue-600 text-white shadow-md relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-2 opacity-10">
                <Truck className="h-10 w-10" />
              </div>
              <div className="relative z-10 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-black uppercase tracking-widest text-blue-100 flex items-center gap-2">
                    <Clock className="h-3 w-3" /> Delivery Progress
                  </p>
                  <span className="px-2 py-0.5 rounded-full bg-white/20 text-[8px] font-black uppercase">
                    {order.book_it_status || 'Processing'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between gap-1">
                  <div className={`flex-1 h-1 rounded-full ${order.book_it_status ? 'bg-white' : 'bg-white/30'}`} />
                  <div className={`flex-1 h-1 rounded-full ${['picking_up', 'delivering', 'delivered'].includes(order.book_it_status || '') ? 'bg-white' : 'bg-white/30'}`} />
                  <div className={`flex-1 h-1 rounded-full ${['delivering', 'delivered'].includes(order.book_it_status || '') ? 'bg-white' : 'bg-white/30'}`} />
                  <div className={`flex-1 h-1 rounded-full ${order.book_it_status === 'delivered' ? 'bg-white' : 'bg-white/30'}`} />
                </div>

                <p className="font-bold text-[10px] leading-tight">
                  {order.book_it_status === 'accepted' ? 'Book It accepted your request' :
                   order.book_it_status === 'picking_up' ? 'Rider is picking up from store' :
                   order.book_it_status === 'delivering' ? 'Rider is on the way to you' :
                   order.book_it_status === 'delivered' ? 'Order delivered successfully' :
                   'Delivery request sent to Book It'}
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {/* Advance Payment Section */}
          {order.delivery_type === 'pickup' && 
           shop?.advancePaymentMode && 
           shop.advancePaymentMode !== 'none' && 
           order.payment_status === 'unpaid' && 
           !['delivered', 'rejected'].includes(order.status) && (
            <div className="bg-slate-50 p-4 rounded-2xl border-2 border-dashed border-slate-200 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                  <CreditCard className="h-4 w-4 text-indigo-600" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-900 uppercase">Advance Payment {shop.advancePaymentMode === 'compulsory' ? '(Compulsory)' : '(Optional)'}</p>
                  <p className="text-[9px] text-slate-500 font-bold">Pay ₹{order.order_amount.toFixed(2)} to confirm order</p>
                </div>
              </div>
              <Button 
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-wider h-10 rounded-xl shadow-lg shadow-indigo-100"
                onClick={onPay}
              >
                PAY ADVANCE NOW
              </Button>
            </div>
          )}

          {/* Payment Status Badge */}
          {order.payment_status && order.payment_status !== 'unpaid' && (
            <div className={`p-3 rounded-xl flex items-center justify-center gap-2 ${
              order.payment_status === 'paid' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {order.payment_status === 'paid' ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Payment Verified</span>
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Payment Verification Pending</span>
                </>
              )}
            </div>
          )}

          {/* Screenshot Preview */}
          {order.payment_screenshot_url && (
            <Button
              variant="outline"
              className="w-full h-10 rounded-xl border-dashed border-slate-200 text-slate-500 font-bold text-[10px] uppercase"
              onClick={() => window.open(order.payment_screenshot_url, '_blank')}
            >
              <ImageIcon className="h-3.5 w-3.5 mr-2" />
              View Payment Screenshot
            </Button>
          )}

          {(order.status === 'accepted' || order.status === 'ready_for_collection' || order.status === 'ready_for_delivery' || order.status === 'out_for_delivery') && (
            <div className="space-y-2">
              <div className="flex gap-2">
                {onGoToShop && (
                  <Button 
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black text-[10px] uppercase tracking-wider h-11 rounded-xl shadow-lg shadow-red-100"
                    onClick={onGoToShop}
                  >
                    <Navigation className="h-3.5 w-3.5 mr-2" />
                    Go to Shop
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  className="flex-1 border-blue-200 text-blue-600 hover:bg-blue-50 font-black text-[10px] uppercase tracking-wider h-11 rounded-xl"
                  onClick={onTrack}
                >
                  <Package className="h-3.5 w-3.5 mr-2" />
                  Track Order
                </Button>
              </div>
              
              <Button 
                className="w-full bg-green-600 hover:bg-green-700 text-white font-black text-[10px] uppercase tracking-wider h-12 rounded-xl shadow-lg shadow-green-100"
                onClick={onComplete}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Complete Order
              </Button>
            </div>
          )}

          {canCancel && (
            <Button 
              variant="ghost"
              className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 font-black text-[10px] uppercase tracking-wider h-10 rounded-xl mt-2"
              onClick={onCancel}
            >
              <XCircle className="h-3.5 w-3.5 mr-2" />
              Cancel Order
            </Button>
          )}
        </div>
        </CardContent>
    </Card>
  );
};
