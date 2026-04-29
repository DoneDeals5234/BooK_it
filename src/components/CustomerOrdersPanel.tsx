import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, MapPin, Package, CheckCircle, XCircle, Clock, Truck, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { getCustomerOrders, markOrderDelivered, getStatusColor, getStatusDisplayName, formatOrderDate, type Order } from '@/lib/supabase-orders';
import { OrderCollectionModal } from './OrderCollectionModal';

interface CustomerOrdersPanelProps {
  customerId: string;
}

export const CustomerOrdersPanel = ({ customerId }: CustomerOrdersPanelProps) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showCollectionModal, setShowCollectionModal] = useState(false);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 5000);
    return () => clearInterval(interval);
  }, [customerId]);

  const loadOrders = async () => {
    try {
      const customerOrders = await getCustomerOrders(customerId);
      setOrders(customerOrders);
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
    try {
      await markOrderDelivered(orderId);
      toast.success('Order completed! Thank you.');
      loadOrders();
    } catch (error) {
      toast.error('Failed to complete order');
    }
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
        <h2 className="text-xl font-black text-gray-900 dark:text-white">Active Orders</h2>
        <span className="text-xs font-bold text-orange-500 bg-orange-50 px-2 py-1 rounded-full">
          {orders.filter(o => o.status !== 'collected').length} ACTIVE
        </span>
      </div>

      <div className="grid gap-4">
        {orders.map((order) => (
          <Card 
            key={order.id} 
            className={`overflow-hidden border-none shadow-sm transition-all active:scale-[0.98] ${
              order.status === 'rejected' ? 'opacity-90' : ''
            }`}
          >
            <CardContent className="p-0">
              {/* Header: Status & ID */}
              <div className={`px-4 py-2 flex items-center justify-between ${getStatusColor(order.status)}`}>
                <span className="text-[10px] font-black uppercase tracking-widest opacity-80">
                  ID: {order.id.slice(0, 8)}
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
              <div className="p-4 space-y-4">
                <div className="flex gap-4">
                  {order.product_image ? (
                    <img 
                      src={order.product_image} 
                      alt="" 
                      className="w-20 h-20 object-cover rounded-2xl shadow-sm border border-gray-100" 
                    />
                  ) : (
                    <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center">
                      <Package className="h-8 w-8 text-gray-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 truncate">{order.product_name || 'Generic Order'}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{formatOrderDate(order.created_at)}</p>
                    <div className="mt-2 flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-3 w-3 text-orange-600" />
                        <span className="text-sm font-black text-orange-600">Total: ₹{(order.total_amount || order.order_amount).toFixed(2)}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 font-bold">
                        Product: ₹{order.order_amount.toFixed(2)} {order.delivery_cost > 0 && `+ Delivery: ₹${order.delivery_cost.toFixed(2)}`}
                      </p>
                      <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded w-fit">QTY: {order.quantity || 1}</span>
                    </div>
                  </div>
                </div>

                {/* Delivery Info */}
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-gray-600 leading-tight">
                      <strong>Delivery to:</strong><br/>
                      {order.customer_address || 'No address provided'}
                    </p>
                  </div>
                </div>

                {/* Status Specific Messages */}
                {order.status === 'pending' && (
                  <p className="text-[11px] text-center text-yellow-600 font-bold bg-yellow-50 py-1 rounded-lg">
                    ⏳ Waiting for shop owner to confirm...
                  </p>
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

                {/* Action Button */}
                {(order.status === 'accepted' || order.status === 'ready_for_collection') && (
                  <div className="space-y-2">
                    <Button 
                      variant="soft" 
                      className="w-full bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold text-xs h-10 rounded-xl"
                      onClick={() => handleCollectClick(order)}
                    >
                      Track or Collect Order
                    </Button>
                    {order.status === 'ready_for_collection' && (
                      <Button 
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold text-xs h-10 rounded-xl"
                        onClick={() => handleCompleteOrder(order.id)}
                      >
                        Complete Order
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Order Collection Modal */}
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
