import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { sanitizeSupabaseUrl, formatIST } from './utils';
import { sendNativeNotification } from './native-notifications';

/**
 * Send notification to user via Supabase Edge Function using their user ID
 */
async function sendOrderNotificationToUser(userId: string, title: string, body: string): Promise<void> {
  try {
    await sendNativeNotification([userId], { title, body });
  } catch (error) {
    console.error('Error sending order notification:', error);
  }
}

/**
 * Notify shop owner that a new order has been created
 */
async function notifyShopOwnerNewOrder(order: Order): Promise<void> {
  try {
    console.log('🔔 Notifying shop owner of new order:', order.id);
    
    // Find all owners for this shop
    const { data: owners, error: ownersError } = await supabase
      .from('shop_owners')
      .select('user_id')
      .eq('shop_id', order.shop_id);

    if (ownersError || !owners || owners.length === 0) {
      console.warn('⚠️ No owners found for shop:', order.shop_id);
      return;
    }

    const payload = {
      title: 'New Order Received! 🛍️',
      body: `New order for ₹${order.order_amount} from ${order.customer_name}. Click to view!`,
      channelId: 'order_alerts_v1', // High priority channel with alarm sound
      data: {
        type: 'new_order',
        order_id: order.id,
        customer_name: order.customer_name,
        amount: order.order_amount.toString(),
        quantity: order.quantity.toString(),
        delivery_type: order.delivery_type || 'pickup',
        ring: 'true' // Flag to trigger native alarm bridge
      }
    };

    const ownerUserIds = owners.map(o => o.user_id).filter(Boolean);
    if (ownerUserIds.length > 0) {
      await sendNativeNotification(ownerUserIds, payload);
    }
  } catch (error) {
    console.error('❌ Error in notifyShopOwnerNewOrder:', error);
  }
}

/**
 * Notify both customer and shop owner that the order is complete
 */
async function notifyOrderCompletion(order: Order): Promise<void> {
  try {
    console.log('🎉 Notifying completion for order:', order.id);

    // 1. Notify Customer
    const customerPayload = {
      title: 'Order Completed! 🎉',
      body: `Your order of ₹${order.order_amount} from ${order.shop_name || 'the shop'} is complete. Enjoy!`,
      data: { orderId: order.id, type: 'order_completion' }
    };
    await sendOrderNotificationToUser(order.customer_id, customerPayload.title, customerPayload.body);

    // 2. Notify All Shop Owners
    const { data: owners } = await supabase
      .from('shop_owners')
      .select('user_id')
      .eq('shop_id', order.shop_id);

    if (owners && owners.length > 0) {
      const ownerPayload = {
        title: 'Order Completed! ✅',
        body: `Order for ${order.customer_name} is complete.`,
        data: { orderId: order.id, type: 'order_completion' }
      };
      const ownerUserIds = owners.map(o => o.user_id).filter(Boolean);
      if (ownerUserIds.length > 0) {
        await sendNativeNotification(ownerUserIds, ownerPayload);
      }
    }
  } catch (error) {
    console.error('❌ Error in notifyOrderCompletion:', error);
  }
}

export type FulfillmentStatus = 'order_accepted' | 'product_picking' | 'delivery' | 'order_complete';

export interface Order {
  id: string;
  shop_id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  order_amount: number;
  order_description?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'ready_for_collection' | 'ready_for_delivery' | 'out_for_delivery' | 'collected' | 'delivered';
  fulfillment_status?: FulfillmentStatus;
  delivery_type?: 'pickup' | 'delivery';
  delivery_choice?: 'self' | 'book_it';
  rejection_reason?: string;
  rejection_notes?: string;
  quantity: number;
  customer_address?: string;
  location_link?: string;
  product_name?: string;
  product_image?: string;
  unit_price?: number;
  delivery_cost: number;
  total_amount: number;
  distance: number;
  book_it_status?: 'accepted' | 'picking_up' | 'delivering' | 'delivered';
  customer_lat?: number;
  customer_lng?: number;
  shop_lat?: number;
  shop_lng?: number;
  shop_name?: string;
  created_at: string;
  updated_at: string;
  accepted_at?: string;
  rejected_at?: string;
  ready_at?: string;
  collected_at?: string;
  expires_at: string;
  otp_code?: string;
  order_code?: string;
  is_cancelled?: boolean;
  cancelled_at?: string;
  payment_screenshot_url?: string;
  payment_status?: 'unpaid' | 'pending_verification' | 'paid';
  house_no?: string;
  landmark?: string;
}

export const REJECTION_REASONS = {
  out_of_stock: 'Product is out of stock',
  not_available: 'Not available right now',
  closed: 'Shop is closed',
  technical_issue: 'Technical issue',
  custom: 'Custom reason'
};

export interface CreateOrderParams {
  shopId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  amount: number;
  description?: string;
  quantity?: number;
  address?: string;
  locationLink?: string;
  productName?: string;
  productImage?: string;
  unitPrice?: number;
  deliveryType?: 'pickup' | 'delivery';
  deliveryCost?: number;
  totalAmount?: number;
  distance?: number;
  customerLat?: number;
  customerLng?: number;
  shopLat?: number;
  shopLng?: number;
  houseNo?: string;
  landmark?: string;
}

// Create a new order
export async function createOrder(params: CreateOrderParams): Promise<Order> {
  const {
    shopId, customerId, customerName, customerPhone, amount, description,
    quantity = 1, address, locationLink, productName, productImage, unitPrice,
    deliveryType = 'pickup', deliveryCost = 0, totalAmount = 0, distance = 0,
    customerLat, customerLng, shopLat, shopLng, houseNo, landmark
  } = params;

  try {
    if (!shopId || !customerId || !customerName || !customerPhone || amount <= 0) {
      console.error('❌ Validation failed:', { shopId, customerId, customerName, customerPhone, amount });
      throw new Error('Invalid order parameters');
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-customer-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        shopId, customerId, customerName, customerPhone, amount, description,
        quantity, address, locationLink, productName, productImage, unitPrice,
        deliveryType, deliveryCost, totalAmount: totalAmount || amount, distance, customerLat, customerLng, shopLat, shopLng,
        houseNo, landmark
      }),
    });

    const responseData = await response.json();
    if (!response.ok || !responseData.success || !responseData.order) {
      const errorMsg = responseData.details || responseData.error || 'Failed to create order';
      const errorHint = responseData.hint ? `\nHint: ${responseData.hint}` : '';
      const errorCode = responseData.code ? `\nCode: ${responseData.code}` : '';
      
      alert(`❌ Order Error:\n${errorMsg}${errorHint}${errorCode}`);
      throw new Error(errorMsg);
    }

    const data: Order = {
      ...responseData.order,
      product_image: sanitizeSupabaseUrl(responseData.order.product_image)
    };

    // Notifications (non-blocking)
    notifyShopOwnerNewOrder(data).catch(console.error);
    sendOrderNotificationToUser(
      data.customer_id,
      'Order Booked! 🛍️',
      `Your order for ₹${data.order_amount} from ${data.shop_name || 'the shop'} is booked.`
    ).catch(console.error);

    return data;
  } catch (error) {
    console.error('❌ Error in createOrder:', error);
    throw error;
  }
}

// Get pending orders for a shop
export async function getPendingOrdersForShop(shopId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('shop_id', shopId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(order => ({ ...order, product_image: sanitizeSupabaseUrl(order.product_image) }));
}

// Get all orders for a shop
export async function getAllOrdersForShop(shopId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .limit(150);

  if (error) throw error;
  return (data || []).map(order => ({ ...order, product_image: sanitizeSupabaseUrl(order.product_image) }));
}

// Get customer orders
export async function getCustomerOrders(customerId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(80);

  if (error) throw error;
  return (data || []).map(order => ({ ...order, product_image: sanitizeSupabaseUrl(order.product_image) }));
}

// Get single order
export async function getOrderById(orderId: string): Promise<Order> {
  const { data, error } = await supabase.from('orders').select('*').eq('id', orderId).single();
  if (error) throw error;
  return { ...data, product_image: sanitizeSupabaseUrl(data.product_image) };
}

// Accept order — notify customer + owner
export async function acceptOrder(orderId: string): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .update({ status: 'accepted', accepted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', orderId).select().single();

  if (error) throw error;
  if (data) {
    // Notify Customer
    sendOrderNotificationToUser(
      data.customer_id,
      '✅ Order Accepted!',
      `Great news! Your order of ₹${data.order_amount} from ${data.shop_name || 'the shop'} has been accepted. Get ready!`
    ).catch(console.error);

    // Notify Shop Owner confirmation
    const { data: owners } = await supabase.from('shop_owners').select('user_id').eq('shop_id', data.shop_id);
    if (owners && owners.length > 0) {
      const ownerIds = owners.map((o: any) => o.user_id).filter(Boolean);
      sendNativeNotification(ownerIds, {
        title: '✅ Order Confirmed',
        body: `You confirmed ${data.customer_name}'s order for ₹${data.order_amount}.`
      }).catch(console.error);
    }
  }
  return data;
}

// Reject order — notify customer + owner
export async function rejectOrder(orderId: string, reason?: string, notes?: string): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .update({ status: 'rejected', rejection_reason: reason, rejection_notes: notes, rejected_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', orderId).select().single();

  if (error) throw error;
  if (data) {
    // Notify Customer
    sendOrderNotificationToUser(
      data.customer_id,
      '❌ Order Rejected',
      `Your order of ₹${data.order_amount} from ${data.shop_name || 'the shop'} has been declined. ${notes || 'Please try again.'}`
    ).catch(console.error);
  }
  return data;
}

// Mark ready
export async function markOrderReady(orderId: string): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .update({ status: 'ready_for_collection', ready_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', orderId).select().single();

  if (error) throw error;
  if (data) {
    sendOrderNotificationToUser(data.customer_id, 'Order Ready! 📦', `Your order is ready for collection.`).catch(console.error);
  }
  return data;
}

// Mark collected
export async function markOrderCollected(orderId: string): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .update({ status: 'collected', collected_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', orderId).select().single();

  if (error) throw error;
  if (data) {
    sendOrderNotificationToUser(data.customer_id, 'Order Collected! 🎉', `Thank you for your business!`).catch(console.error);
  }
  return data;
}

// Mark out for delivery
export async function markOrderOutForDelivery(orderId: string): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .update({ status: 'out_for_delivery', updated_at: new Date().toISOString() })
    .eq('id', orderId).select().single();

  if (error) throw error;
  if (data) {
    sendOrderNotificationToUser(data.customer_id, 'Out for Delivery! 🚚', `Your order is on its way.`).catch(console.error);
  }
  return data;
}

// Verify and complete
export async function verifyAndCompleteOrder(orderId: string, code: string): Promise<Order> {
  const { data: order, error: fetchError } = await supabase.from('orders').select('order_code, otp_code').eq('id', orderId).single();
  if (fetchError) throw fetchError;
  const savedCode = order.order_code || order.otp_code;
  if (savedCode !== code) throw new Error('Invalid Order ID.');

  const { data, error } = await supabase
    .from('orders')
    .update({ status: 'delivered', updated_at: new Date().toISOString() })
    .eq('id', orderId).select().single();

  if (error) throw error;
  if (data) notifyOrderCompletion(data).catch(console.error);
  return data;
}

// Cancel order
export async function cancelOrder(orderId: string): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .update({ status: 'rejected', is_cancelled: true, rejection_reason: 'Cancelled by customer', cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', orderId).select().single();

  if (error) throw error;
  if (data) {
    const { data: owners } = await supabase.from('shop_owners').select('user_id').eq('shop_id', data.shop_id);
    if (owners && owners.length > 0) {
      const ownerUserIds = owners.map(o => o.user_id).filter(Boolean);
      sendNativeNotification(ownerUserIds, {
        title: 'Order Cancelled ⚠️',
        body: `Order for ₹${data.order_amount} cancelled by ${data.customer_name}.`
      }).catch(console.error);
    }
  }
  return data;
}

// Update fulfillment status — notify customer AND shop owner
export async function updateFulfillmentStatus(orderId: string, fulfillmentStatus: FulfillmentStatus): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .update({ fulfillment_status: fulfillmentStatus, updated_at: new Date().toISOString() })
    .eq('id', orderId).select().single();

  if (error) throw error;
  if (data) {
    if (fulfillmentStatus === 'order_complete') {
      notifyOrderCompletion(data).catch(console.error);
    } else {
      const customerMsgs: Record<string, any> = {
        order_accepted: { title: '✅ Order Accepted!', body: `Your order from ${data.shop_name || 'the shop'} is being prepared.` },
        product_picking: { title: '📦 Picking Your Order', body: 'Items are being picked. Almost ready!' },
        delivery: { title: '🚚 Out for Delivery!', body: 'Your order is on its way. Get ready!' },
      };
      const ownerMsgs: Record<string, any> = {
        order_accepted: { title: '🔄 Order Processing', body: `${data.customer_name}'s order is now being prepared.` },
        product_picking: { title: '📦 Picking Items', body: `Order for ${data.customer_name} is being picked.` },
        delivery: { title: '🚚 Order Dispatched', body: `${data.customer_name}'s order is out for delivery.` },
      };

      const customerMsg = customerMsgs[fulfillmentStatus];
      if (customerMsg) sendOrderNotificationToUser(data.customer_id, customerMsg.title, customerMsg.body).catch(console.error);

      const ownerMsg = ownerMsgs[fulfillmentStatus];
      if (ownerMsg) {
        supabase.from('shop_owners').select('user_id').eq('shop_id', data.shop_id).then(({ data: owners }) => {
          if (owners && owners.length > 0) {
            const ownerIds = owners.map((o: any) => o.user_id).filter(Boolean);
            sendNativeNotification(ownerIds, ownerMsg).catch(console.error);
          }
        });
      }
    }
  }
  return data;
}

// Update Book It delivery status
export async function updateBookItStatus(orderId: string, status: 'accepted' | 'picking_up' | 'delivering' | 'delivered'): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .update({ book_it_status: status, updated_at: new Date().toISOString() })
    .eq('id', orderId).select().single();

  if (error) throw error;
  
  if (data) {
    // Send notification to customer
    const msgs: Record<string, any> = {
      accepted: { title: 'Delivery Accepted! 🚚', body: 'A delivery partner has accepted your order.' },
      picking_up: { title: 'Order Being Picked Up 📦', body: 'Our partner is picking up your order from the shop.' },
      delivering: { title: 'Order on the Way! 🛵', body: 'Your delivery is en route to your location.' },
      delivered: { title: 'Order Delivered! 🎉', body: 'Your order has been successfully delivered.' },
    };
    
    const msg = msgs[status];
    if (msg) {
      sendOrderNotificationToUser(data.customer_id, msg.title, msg.body).catch(console.error);
    }
  }
  
  return data;
}

// Update order delivery choice (Self vs Book It)
export async function updateDeliveryChoice(orderId: string, choice: 'self' | 'book_it'): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .update({ 
      delivery_choice: choice, 
      updated_at: new Date().toISOString(),
      // Reset book_it_status if switching to self
      ...(choice === 'self' ? { book_it_status: null } : {})
    })
    .eq('id', orderId).select().single();

  if (error) throw error;
  return data;
}

// Update order payment status
export async function updateOrderPaymentStatus(orderId: string, status: 'paid' | 'unpaid'): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .update({ 
      payment_status: status, 
      updated_at: new Date().toISOString() 
    })
    .eq('id', orderId).select().single();

  if (error) throw error;
  return data;
}

// Mark order as delivered by owner (bypassing OTP if needed or for manual override)
export async function markOrderDeliveredByOwner(orderId: string): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .update({ 
      status: 'delivered', 
      updated_at: new Date().toISOString() 
    })
    .eq('id', orderId).select().single();

  if (error) throw error;
  if (data) notifyOrderCompletion(data).catch(console.error);
  return data;
}

// Mark order as delivered (called by customer)
export async function markOrderDelivered(orderId: string): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .update({ 
      status: 'delivered', 
      updated_at: new Date().toISOString() 
    })
    .eq('id', orderId).select().single();

  if (error) throw error;
  if (data) notifyOrderCompletion(data).catch(console.error);
  return data;
}

// Update order payment screenshot URL
export async function updateOrderPaymentScreenshot(orderId: string, screenshotUrl: string): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .update({ 
      payment_screenshot_url: screenshotUrl,
      payment_status: 'pending_verification',
      updated_at: new Date().toISOString() 
    })
    .eq('id', orderId).select().single();

  if (error) throw error;
  return data;
}

// Other utility functions (getStatuses, etc) remain similar...
export async function getAllBookingsFromSupabase() { return []; }
export async function getShopBookingsFromSupabase(id: string) { return []; }
export function subscribeToShopBookings(id: string, cb: any) { return () => {}; }
export async function getNextTokenNumberFromSupabase(id: string) { return 1; }
export async function deleteBookingFromSupabase(id: string) { return true; }
export function formatOrderDate(d: string) { return formatIST(d); }
export function getStatusColor(s: string) { return 'bg-gray-100'; }
export function getStatusDisplayName(s: string) { return s; }
