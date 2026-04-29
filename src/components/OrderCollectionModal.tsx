import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MapPin, Phone, Loader2, AlertCircle, MapIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { getShopById } from '@/lib/shops-storage';
import { Order, markOrderDelivered } from '@/lib/supabase-orders';

interface OrderCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
}

export const OrderCollectionModal = ({
  isOpen,
  onClose,
  order
}: OrderCollectionModalProps) => {
  const [shopData, setShopData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && order) {
      loadShopData();
    }
  }, [isOpen, order]);

  const loadShopData = async () => {
    setLoading(true);
    setError('');
    try {
      const shop = await getShopById(order.shop_id);
      setShopData(shop);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load shop details';
      setError(errorMessage);
      console.error('Error loading shop:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoToLocation = () => {
    if (shopData?.locationMapLink) {
      window.open(shopData.locationMapLink, '_blank');
    } else if (shopData?.latitude && shopData?.longitude) {
      const mapsUrl = `https://www.google.com/maps?q=${shopData.latitude},${shopData.longitude}`;
      window.open(mapsUrl, '_blank');
    } else {
      toast.error('Location information is not available');
    }
  };

  const handleCompleteOrder = async () => {
    if (!confirm('Have you received your order at the shop?')) return;
    
    setActionLoading(true);
    try {
      await markOrderDelivered(order.id);
      toast.success('Order completed! Thank you.');
      onClose();
    } catch (err) {
      toast.error('Failed to complete order');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {order.delivery_type === 'delivery' ? 'Track Your Delivery' : 'Collect Your Order'}
          </DialogTitle>
          <DialogDescription>
            {order.delivery_type === 'delivery' 
              ? (order.status === 'out_for_delivery' ? 'Your order is on the way!' : 'Your order is being prepared for delivery')
              : 'Visit the shop to collect your order'
            }
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : error ? (
          <div className="flex gap-2 items-start bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        ) : shopData ? (
          <div className="space-y-4">
            {/* Shop Name */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-600 dark:text-blue-400 mb-1">Shop Name</p>
              <p className="text-lg font-bold text-blue-900 dark:text-blue-100">{shopData.name}</p>
            </div>

            {/* Contact Information */}
            <div className="space-y-3">
              {/* Phone */}
              {shopData.phone && (
                <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                  <Phone className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Phone</p>
                    <a
                      href={`tel:${shopData.phone}`}
                      className="font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      {shopData.phone}
                    </a>
                  </div>
                </div>
              )}

              {/* Address */}
              {shopData.address && (
                <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                  <MapPin className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Address</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {shopData.address}
                      {shopData.village && `, ${shopData.village}`}
                      {shopData.district && `, ${shopData.district}`}
                      {shopData.state && `, ${shopData.state}`}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Order Information */}
            <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-xl border border-orange-200 dark:border-orange-800">
               <div className="flex justify-between items-start mb-2">
                 <div>
                   <p className="text-xs text-orange-600 dark:text-orange-400 font-bold uppercase tracking-wider">Product</p>
                   <p className="text-lg font-black text-gray-900 dark:text-white leading-tight">
                     {order.product_name || 'Generic Order'}
                   </p>
                 </div>
                 <div className="text-right">
                   <p className="text-xs text-orange-600 dark:text-orange-400 font-bold uppercase tracking-wider">Quantity</p>
                   <p className="text-lg font-black text-gray-900 dark:text-white">{order.quantity || 1}</p>
                 </div>
               </div>
              <div className="pt-2 border-t border-orange-100 dark:border-orange-800">
                <p className="text-xs text-gray-500">Total Amount</p>
                <p className="text-2xl font-black text-orange-600">₹{order.order_amount.toFixed(2)}</p>
              </div>
            </div>

            {/* Delivery/Location Note */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-800">
              <p className="text-[11px] text-blue-700 dark:text-blue-300 font-medium leading-relaxed">
                {order.delivery_type === 'delivery' 
                  ? `📍 This order will be delivered to: ${order.customer_address || 'your address'}. Please ensure someone is available to receive it.`
                  : '📍 Open the shop location in Google Maps to navigate. Ensure you have the total amount ready for the shop owner.'
                }
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="flex-1 rounded-xl h-11 font-bold"
                >
                  Close
                </Button>
                {order.delivery_type !== 'delivery' && (
                  <Button
                    onClick={handleGoToLocation}
                    disabled={!shopData?.locationMapLink && (!shopData?.latitude || !shopData?.longitude)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 font-bold shadow-lg shadow-blue-100"
                  >
                    <MapIcon className="h-4 w-4 mr-2" />
                    Go to Shop
                  </Button>
                )}
              </div>
              
              {(order.status === 'ready_for_collection' || order.status === 'ready_for_delivery' || order.status === 'out_for_delivery') && (
                <Button
                  onClick={handleCompleteOrder}
                  disabled={actionLoading}
                  className="w-full bg-green-600 hover:bg-green-700 text-white rounded-xl h-12 font-black shadow-lg shadow-green-100"
                >
                  {actionLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Package className="h-5 w-5 mr-2" />
                      {order.delivery_type === 'delivery' ? 'I HAVE RECEIVED MY ORDER' : 'COMPLETE ORDER NOW'}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
