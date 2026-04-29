import { supabase } from './supabase';

/**
 * Send notification to user via Supabase Edge Function using their user ID
 * This function targets the user by their external_id (user ID)
 */
async function sendOrderNotificationToUser(userId: string, title: string, body: string): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const authHeader = session?.access_token ? `Bearer ${session.access_token}` : `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`;

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-notification-by-userid`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        user_ids: [userId],
        title,
        body,
        data: {
          type: 'order_update'
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn('Failed to send order notification:', errorText);
    } else {
      console.log('✅ Order notification sent to user:', userId);
    }
  } catch (error) {
    console.error('Error sending order notification:', error);
    // Don't throw - notification failure shouldn't block order operations
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
  created_at: string;
  updated_at: string;
  accepted_at?: string;
  rejected_at?: string;
  ready_at?: string;
  collected_at?: string;
  expires_at: string;
}

export const REJECTION_REASONS = {
  out_of_stock: 'Product is out of stock',
  not_available: 'Not available right now',
  closed: 'Shop is closed',
  technical_issue: 'Technical issue',
  custom: 'Custom reason'
};

// Create a new order
export async function createOrder(
  shopId: string,
  customerId: string,
  customerName: string,
  customerPhone: string,
  amount: number,
  description?: string,
  quantity?: number,
  address?: string,
  locationLink?: string,
  productName?: string,
  productImage?: string,
  unitPrice?: number,
  deliveryType: 'pickup' | 'delivery' = 'pickup',
  deliveryCost: number = 0,
  totalAmount: number = 0,
  distance: number = 0,
  customerLat?: number,
  customerLng?: number,
  shopLat?: number,
  shopLng?: number
): Promise<Order> {
  try {
    // Validate inputs
    if (!shopId || !customerId || !customerName || !customerPhone || amount <= 0) {
      throw new Error('Invalid order parameters: missing required fields');
    }

    console.log('📋 Creating order with details:', {
      shopId,
      customerId,
      customerName,
      customerPhone,
      amount,
      deliveryType
    });

    // Use Edge Function to create order (handles RLS and security properly)
    let data: Order;
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-customer-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          shopId,
          customerId,
          customerName,
          customerPhone,
          amount,
          description,
          quantity,
          address,
          locationLink,
          productName,
          productImage,
          unitPrice,
          deliveryType,
          deliveryCost,
          totalAmount,
          distance,
          customerLat,
          customerLng,
          shopLat,
          shopLng
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error('❌ Edge Function error creating order:', JSON.stringify(responseData, null, 2));
        const errorMsg = responseData.details || responseData.error || 'Failed to create order';
        throw new Error(`Failed to create order: ${errorMsg}`);
      }

      if (!responseData.success || !responseData.order) {
        throw new Error('Order creation failed: No order data returned');
      }

      data = responseData.order;
    } catch (fetchError) {
      const fetchMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
      console.error('❌ Error calling create-customer-order function:', fetchMsg);
      throw fetchError;
    }

    console.log('✅ Order created successfully:', data.id);

    console.log('✅ Order created successfully:', data.id);
    return data;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Error in createOrder:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

// Get pending orders for a shop (owner view)
export async function getPendingOrdersForShop(shopId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('shop_id', shopId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Get all orders for a shop (owner view)
export async function getAllOrdersForShop(shopId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Get all orders for a customer
export async function getCustomerOrders(customerId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Get single order by ID
export async function getOrderById(orderId: string): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (error) throw error;
  return data;
}

// Accept an order
export async function acceptOrder(orderId: string): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', orderId)
    .select()
    .single();

  if (error) throw error;

  // Send notification to customer
  if (data) {
    await sendOrderNotificationToUser(
      data.customer_id,
      'Order Accepted! ✅',
      `Your order of ₹${data.order_amount} has been accepted by ${data.shop_name || 'the shop'}. Get ready to collect it!`
    );
  }

  return data;
}

// Reject an order
export async function rejectOrder(
  orderId: string,
  reason?: string,
  notes?: string
): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .update({
      status: 'rejected',
      rejection_reason: reason,
      rejection_notes: notes,
      rejected_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', orderId)
    .select()
    .single();

  if (error) throw error;

  // Send notification to customer
  if (data) {
    const reasonText = notes ? `Reason: ${notes}` : 'Please try again later.';
    await sendOrderNotificationToUser(
      data.customer_id,
      'Order Rejected ❌',
      `Your order of ₹${data.order_amount} has been declined. ${reasonText}`
    );
  }

  return data;
}

// Mark order as ready for collection
export async function markOrderReady(orderId: string): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .update({
      status: 'ready_for_collection',
      ready_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', orderId)
    .select()
    .single();

  if (error) throw error;

  // Send notification to customer
  if (data) {
    await sendOrderNotificationToUser(
      data.customer_id,
      'Order Ready! 📦',
      `Your order of ₹${data.order_amount} is ready for collection. Come to the shop now!`
    );
  }

  return data;
}

// Mark order as collected
export async function markOrderCollected(orderId: string): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .update({
      status: 'collected',
      collected_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', orderId)
    .select()
    .single();

  if (error) throw error;

  // Send notification to customer
  if (data) {
    await sendOrderNotificationToUser(
      data.customer_id,
      'Order Collected! 🎉',
      `Thank you for collecting your order of ₹${data.order_amount}. We appreciate your business!`
    );
  }

  return data;
}

// Mark order as out for delivery
export async function markOrderOutForDelivery(orderId: string): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .update({
      status: 'out_for_delivery',
      updated_at: new Date().toISOString()
    })
    .eq('id', orderId)
    .select()
    .single();

  if (error) throw error;

  // Send notification to customer
  if (data) {
    await sendOrderNotificationToUser(
      data.customer_id,
      'Out for Delivery! 🚚',
      `Your order of ₹${data.order_amount} from ${data.shop_name || 'the shop'} is on its way to you!`
    );
  }

  return data;
}

// Mark order as delivered (By shop owner for delivery orders)
export async function markOrderDeliveredByOwner(orderId: string): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .update({
      status: 'delivered',
      updated_at: new Date().toISOString()
    })
    .eq('id', orderId)
    .select()
    .single();

  if (error) throw error;

  // Send notification to customer
  if (data) {
    await sendOrderNotificationToUser(
      data.customer_id,
      'Order Delivered! 🎉',
      `Your order of ₹${data.order_amount} has been successfully delivered. Enjoy!`
    );
  }

  return data;
}

// Mark order as delivered (Completed by customer)
export async function markOrderDelivered(orderId: string): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .update({
      status: 'delivered',
      updated_at: new Date().toISOString()
    })
    .eq('id', orderId)
    .select()
    .single();

  if (error) throw error;

  // Send notification to shop owner about completion
  if (data) {
    const { data: shopData } = await supabase.from('shops').select('owner_email').eq('id', data.shop_id).single();
    if (shopData?.owner_email) {
      const { data: profile } = await supabase.from('user_profiles').select('user_id').eq('email', shopData.owner_email).single();
      if (profile?.user_id) {
        await sendOrderNotificationToUser(
          profile.user_id,
          'Order Completed! 🎉',
          `${data.customer_name} has marked their order as delivered.`
        );
      }
    }
  }

  return data;
}

// Update delivery choice
export async function updateDeliveryChoice(
  orderId: string, 
  choice: 'self' | 'book_it'
): Promise<Order> {
  const status = choice === 'self' ? 'ready_for_delivery' : 'accepted';
  const { data, error } = await supabase
    .from('orders')
    .update({
      delivery_choice: choice,
      status: status,
      updated_at: new Date().toISOString()
    })
    .eq('id', orderId)
    .select()
    .single();

  if (error) throw error;

  // If Book-It is chosen, notify staff (this will be picked up by the Staff Portal)
  if (choice === 'book_it') {
    try {
      const addressInfo = data.customer_address ? ` to ${data.customer_address}` : '';
      await supabase.from('admin_notifications').insert({
        type: 'delivery_request',
        order_id: orderId,
        message: `🚚 Book It Delivery requested for order ₹${data.order_amount} from ${data.customer_name}${addressInfo}`,
        is_read: false
      });
    } catch (e) {
      console.warn('Failed to insert admin notification:', e);
    }
  }

  return data;
}

// Update Book It Delivery status
export async function updateBookItStatus(
  orderId: string,
  status: 'accepted' | 'picking_up' | 'delivering' | 'delivered'
): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .update({
      book_it_status: status,
      updated_at: new Date().toISOString()
    })
    .eq('id', orderId)
    .select()
    .single();

  if (error) throw error;

  // Send notification to customer
  if (data) {
    let title = 'Delivery Update';
    let body = `Your delivery status for order ₹${data.total_amount} has been updated.`;

    if (status === 'accepted') {
      title = 'Delivery Accepted! 🚚';
      body = 'Book It has accepted your delivery request and is assigning a rider.';
    } else if (status === 'picking_up') {
      title = 'Picking Up! 📦';
      body = 'The rider is picking up your order from the store.';
    } else if (status === 'delivering') {
      title = 'On the Way! 🛵';
      body = 'Your order is being delivered to your location.';
    } else if (status === 'delivered') {
      title = 'Delivered! 🎉';
      body = 'Your order has been successfully delivered by Book It. Enjoy!';
    }

    await sendOrderNotificationToUser(data.customer_id, title, body);
  }

  return data;
}

// Update shop owner fulfillment status
export async function updateFulfillmentStatus(
  orderId: string,
  fulfillmentStatus: FulfillmentStatus
): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .update({
      fulfillment_status: fulfillmentStatus,
      updated_at: new Date().toISOString()
    })
    .eq('id', orderId)
    .select()
    .single();

  if (error) throw error;

  // Notify customer of status update
  if (data) {
    const statusMessages: Record<FulfillmentStatus, { title: string; body: string }> = {
      order_accepted: { title: 'Order Accepted! ✅', body: `Your order of ₹${data.order_amount} has been accepted and is being prepared.` },
      product_picking: { title: 'Picking Your Order 📦', body: `The shop is picking your items for order ₹${data.order_amount}.` },
      delivery: { title: 'Out for Delivery 🚚', body: `Your order of ₹${data.order_amount} is on its way to you!` },
      order_complete: { title: 'Order Complete! 🎉', body: `Your order of ₹${data.order_amount} has been completed. Thank you!` },
    };
    const msg = statusMessages[fulfillmentStatus];
    if (msg) await sendOrderNotificationToUser(data.customer_id, msg.title, msg.body);
  }

  return data;
}

// Get order count by status for a shop
export async function getOrderCountByStatus(shopId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('orders')
    .select('status')
    .eq('shop_id', shopId)
    .gt('expires_at', new Date().toISOString());

  if (error) throw error;

  const counts: Record<string, number> = {
    pending: 0,
    accepted: 0,
    rejected: 0,
    ready_for_collection: 0,
    ready_for_delivery: 0,
    out_for_delivery: 0,
    collected: 0,
    delivered: 0
  };

  data?.forEach((order) => {
    counts[order.status] = (counts[order.status] || 0) + 1;
  });

  return counts;
}

// Format date for display
export function formatOrderDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

// Get status badge color
export function getStatusColor(status: string): string {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'accepted':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'rejected':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'ready_for_collection':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'ready_for_delivery':
      return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200';
    case 'out_for_delivery':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    case 'collected':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

// Get status display name
export function getStatusDisplayName(status: string): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'accepted':
      return 'Accepted';
    case 'rejected':
      return 'Rejected';
    case 'ready_for_collection':
      return 'Ready for Collection';
    case 'ready_for_delivery':
      return 'Ready for Delivery';
    case 'out_for_delivery':
      return 'Out for Delivery';
    case 'collected':
      return 'Collected';
    case 'delivered':
      return 'Delivered';
    default:
      return status;
  }
}
