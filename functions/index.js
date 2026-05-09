const functions = require('firebase-functions');
const fetch = require('node-fetch');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

const ONESIGNAL_APP_ID = '71048c28-503e-49e5-89b1-0de00ccdca4b';
const ONESIGNAL_API_KEY = 'os_v2_app_d4kpvvanf5dfvm5i4duxnodst5glczst2rmebymf4qvuwtvteamesdo3btuipvl5bgc53qwuyoge23d5hwst2xxyhry4t2kiyk4driq';
const ONESIGNAL_API_URL = 'https://onesignal.com/api/v1/notifications';

// Supabase Configuration - Primary Project
const SUPABASE_URL = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL'; // https://xxx.supabase.co
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'YOUR_SUPABASE_ANON_KEY'; // Get from Supabase dashboard
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Supabase Configuration - Secondary Project (Failover)
const SUPABASE_URL_SECONDARY = process.env.SUPABASE_URL_SECONDARY || 'YOUR_SUPABASE_URL_SECONDARY';
const SUPABASE_KEY_SECONDARY = process.env.SUPABASE_KEY_SECONDARY || 'YOUR_SUPABASE_ANON_KEY_SECONDARY';
const supabaseSecondary = createClient(SUPABASE_URL_SECONDARY, SUPABASE_KEY_SECONDARY);

/**
 * Helper function to try primary Supabase first, then fallback to secondary
 * Logs which project is being used
 */
async function executeSupabaseQuery(queryFn) {
  try {
    console.log('🔄 Attempting primary Supabase project...');
    const result = await queryFn(supabase);
    console.log('✅ PRIMARY project succeeded');
    return result;
  } catch (primaryError) {
    console.warn('⚠️ Primary project failed, attempting secondary fallback...');
    console.warn('Primary error:', primaryError.message);
    try {
      const result = await queryFn(supabaseSecondary);
      console.log('✅ SECONDARY project succeeded (failover active)');
      return result;
    } catch (secondaryError) {
      console.error('❌ Both projects failed');
      console.error('Secondary error:', secondaryError.message);
      throw new Error(`Both Supabase projects failed. Primary: ${primaryError.message}, Secondary: ${secondaryError.message}`);
    }
  }
}

// Razorpay Configuration - REPLACE WITH YOUR CREDENTIALS
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'YOUR_RAZORPAY_KEY_ID'; // Get from Razorpay dashboard
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'YOUR_RAZORPAY_KEY_SECRET'; // Get from Razorpay dashboard
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'YOUR_RAZORPAY_WEBHOOK_SECRET';

const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});

/**
 * Firebase Cloud Function to trigger foreground service on owner's native Android device
 * Called when a customer books a time slot
 * 
 * Endpoint: POST https://[region]-[project].cloudfunctions.net/triggerOwnerForegroundService
 * 
 * Request body:
 * {
 *   ownerUserIds: ['userId1', 'userId2'],
 *   customerName: 'John',
 *   serviceName: 'Haircut',
 *   timeSlot: '10:00 AM',
 *   bookingRequestId: 'req-123',
 *   customerPhone: '123456789'
 * }
 */
exports.triggerOwnerForegroundService = functions.https.onRequest(async (req, res) => {
  try {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(200).send('OK');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const {
      ownerUserIds = [],
      customerName = '',
      serviceName = '',
      timeSlot = '',
      bookingRequestId = '',
      customerPhone = '',
    } = req.body;

    console.log('📱 Firebase Function: Trigger Foreground Service');
    console.log('  Owner User IDs:', ownerUserIds);
    console.log('  Customer:', customerName);
    console.log('  Service:', serviceName);
    console.log('  Time Slot:', timeSlot);
    console.log('  Booking Request ID:', bookingRequestId);

    // Validate inputs
    if (!Array.isArray(ownerUserIds) || ownerUserIds.length === 0) {
      console.error('❌ No owner user IDs provided');
      res.status(400).json({ 
        success: false, 
        error: 'ownerUserIds must be a non-empty array',
        message: 'Please provide at least one owner user ID'
      });
      return;
    }

    // Filter valid user IDs
    const validUserIds = ownerUserIds.filter(id => 
      typeof id === 'string' && id.trim().length > 0
    );

    if (validUserIds.length === 0) {
      console.error('❌ No valid owner user IDs');
      res.status(400).json({
        success: false,
        error: 'No valid user IDs after filtering'
      });
      return;
    }

    console.log(`✅ Valid owner IDs: ${validUserIds.length}`, validUserIds);

    // Send notification to OneSignal
    const notificationPayload = {
      app_id: ONESIGNAL_APP_ID,
      include_external_user_ids: validUserIds,
      headings: { en: `🔔 Booking Alert - ${customerName}` },
      contents: { en: `${serviceName} at ${timeSlot}` },
      data: {
        bookingRequestId,
        type: 'booking_request',
        action: 'start_foreground_service',
        customerName,
        serviceName,
        timeSlot,
        customerPhone,
        startForegroundService: 'true', // Signal to native app to start foreground service
      },
      priority: 10, // High priority for native push
      ttl: 3600, // 1 hour TTL
    };

    console.log('📤 Sending notification to OneSignal...');
    console.log('📋 Payload:', JSON.stringify(notificationPayload, null, 2));

    const response = await fetch(ONESIGNAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify(notificationPayload),
    });

    const responseData = await response.json();

    console.log(`📋 OneSignal Response Status: ${response.status}`);
    console.log('📋 OneSignal Response:', JSON.stringify(responseData, null, 2));

    if (!response.ok) {
      console.error('❌ OneSignal API Error:', responseData);
      res.status(response.status).json({
        success: false,
        error: 'OneSignal API error',
        details: responseData,
      });
      return;
    }

    const recipientCount = responseData.body?.recipients || 0;

    if (recipientCount > 0) {
      console.log(`✅ SUCCESS! Notification sent to ${recipientCount} device(s)`);
      console.log('📊 Notification ID:', responseData.body?.id);
      res.status(200).json({
        success: true,
        message: `Foreground service trigger sent to ${recipientCount} device(s)`,
        playerIdsCount: recipientCount,
        notificationId: responseData.body?.id,
      });
    } else {
      console.warn('⚠️ Notification created but no recipients found');
      res.status(200).json({
        success: false,
        message: 'Notification queued but may not have recipients (users may not have granted permissions)',
        recipientCount: 0,
        notificationId: responseData.body?.id,
      });
    }
  } catch (error) {
    console.error('❌ Error in triggerOwnerForegroundService:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Firebase Cloud Function to send a test notification
 * Use this to verify OneSignal is working correctly
 * 
 * Endpoint: POST https://[region]-[project].cloudfunctions.net/sendTestNotification
 * 
 * Request body:
 * {
 *   userId: 'user-id-to-test'
 * }
 */
exports.sendTestNotification = functions.https.onRequest(async (req, res) => {
  try {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(200).send('OK');
      return;
    }

    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    console.log('🧪 Sending test notification to:', userId);

    const response = await fetch(ONESIGNAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_external_user_ids: [userId],
        headings: { en: '🧪 Test Notification' },
        contents: { en: 'If you see this, OneSignal is working!' },
        data: { test: 'true' },
        priority: 10,
      }),
    });

    const responseData = await response.json();

    if (response.ok && responseData.body?.recipients > 0) {
      console.log(`✅ Test notification sent to ${responseData.body.recipients} device(s)`);
      res.status(200).json({
        success: true,
        message: `Test notification sent to ${responseData.body.recipients} device(s)`,
        recipientCount: responseData.body.recipients,
      });
    } else {
      console.warn('⚠️ Test notification may not have been delivered');
      res.status(200).json({
        success: false,
        message: 'Notification queued but may have no recipients',
        recipientCount: responseData.body?.recipients || 0,
      });
    }
  } catch (error) {
    console.error('❌ Error in sendTestNotification:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Create Razorpay Order
 * Endpoint: POST https://[region]-[project].cloudfunctions.net/create-order
 *
 * Request body:
 * {
 *   amount: 1000,  // in paise
 *   userId: 'user-id',
 *   userEmail: 'user@example.com'
 * }
 */
exports.createOrder = functions.https.onRequest(async (req, res) => {
  try {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(200).send('OK');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const { amount, userId, userEmail } = req.body;

    if (!amount || !userId) {
      res.status(400).json({ error: 'amount and userId are required' });
      return;
    }

    console.log('💳 Creating Razorpay order for:', { amount, userId, userEmail });

    // Create order in Razorpay
    const order = await razorpay.orders.create({
      amount: amount,
      currency: 'INR',
      receipt: `order_${userId}_${Date.now()}`,
      notes: {
        userId: userId,
        userEmail: userEmail,
      },
    });

    console.log('✅ Razorpay order created:', order.id);

    // Insert pending payment record in Supabase (with failover)
    const { data, error } = await executeSupabaseQuery(async (supabaseClient) => {
      return await supabaseClient
        .from('payments')
        .insert({
          user_id: userId,
          razorpay_order_id: order.id,
          amount: amount,
          status: 'pending',
          notes: {
            userEmail: userEmail,
            createdAt: new Date().toISOString(),
          },
        })
        .select();
    });

    if (error) {
      console.error('❌ Error inserting payment record:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create payment record',
      });
      return;
    }

    console.log('✅ Payment record created in Supabase:', data?.[0]?.id);

    res.status(200).json({
      success: true,
      orderId: order.id,
      keyId: RAZORPAY_KEY_ID,
      amount: order.amount,
      paymentRecordId: data?.[0]?.id,
    });
  } catch (error) {
    console.error('❌ Error creating order:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Verify Razorpay Payment
 * Endpoint: POST https://[region]-[project].cloudfunctions.net/verify-payment
 *
 * Request body:
 * {
 *   orderId: 'order_id',
 *   paymentId: 'pay_id',
 *   signature: 'signature',
 *   userId: 'user-id'
 * }
 */
exports.verifyPayment = functions.https.onRequest(async (req, res) => {
  try {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(200).send('OK');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const { orderId, paymentId, signature, userId } = req.body;

    if (!orderId || !paymentId || !signature || !userId) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    console.log('🔐 Verifying payment signature:', { orderId, paymentId, userId });

    // Verify signature
    const hmac = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(orderId + '|' + paymentId)
      .digest('hex');

    const isSignatureValid = hmac === signature;

    if (!isSignatureValid) {
      console.error('❌ Invalid signature - possible fraud attempt');
      res.status(400).json({
        success: false,
        error: 'Invalid payment signature',
      });
      return;
    }

    console.log('✅ Signature verified! Payment is authentic');

    // Fetch payment details from Razorpay
    const payment = await razorpay.payments.fetch(paymentId);

    console.log('📋 Payment details:', {
      status: payment.status,
      amount: payment.amount,
      method: payment.method,
    });

    // Determine payment status
    let paymentStatus = 'pending';
    if (payment.status === 'captured' || payment.status === 'authorized') {
      paymentStatus = 'success';
    } else if (payment.status === 'failed') {
      paymentStatus = 'failed';
    }

    // Update Supabase with payment status (with failover)
    const { data: updateData, error: updateError } = await executeSupabaseQuery(async (supabaseClient) => {
      return await supabaseClient
        .from('payments')
        .update({
          razorpay_payment_id: paymentId,
          status: paymentStatus,
          payment_method: payment.method,
          updated_at: new Date().toISOString(),
        })
        .eq('razorpay_order_id', orderId)
        .select();
    });

    if (updateError) {
      console.error('❌ Error updating payment in Supabase:', updateError);
      // Don't fail the response - payment is verified, just logging issue
    } else {
      console.log('✅ Payment updated in Supabase:', updateData?.[0]?.id);
    }

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      paymentId: paymentId,
      orderId: orderId,
      status: paymentStatus, // 'success' or 'failed'
      amount: payment.amount,
    });
  } catch (error) {
    console.error('❌ Error verifying payment:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Razorpay Webhook Handler
 * Endpoint: POST https://[region]-[project].cloudfunctions.net/payment-webhook
 *
 * This receives webhooks from Razorpay when payment status changes
 */
exports.paymentWebhook = functions.https.onRequest(async (req, res) => {
  try {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(200).send('OK');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const payload = req.body;
    const signature = req.headers['x-razorpay-signature'];

    // Verify webhook signature
    const hmac = crypto
      .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');

    if (hmac !== signature) {
      console.error('❌ Invalid webhook signature');
      res.status(400).json({ error: 'Invalid signature' });
      return;
    }

    console.log('📨 Received webhook event:', payload.event);

    const { event, payload: eventPayload } = payload;
    const paymentId = eventPayload.payment?.id;
    const orderId = eventPayload.payment?.order_id;
    const userId = eventPayload.payment?.notes?.userId;

    if (!paymentId || !orderId) {
      console.warn('⚠️ Incomplete webhook data');
      res.status(200).json({ acknowledged: true });
      return;
    }

    let statusToUpdate = 'pending';
    let errorMsg = null;

    // Handle different payment events
    if (event === 'payment.authorized') {
      console.log('✅ Payment Authorized:', paymentId);
      statusToUpdate = 'captured';
    } else if (event === 'payment.captured') {
      console.log('✅ Payment Captured:', paymentId);
      statusToUpdate = 'success';
    } else if (event === 'payment.failed') {
      console.log('❌ Payment Failed:', paymentId);
      statusToUpdate = 'failed';
      errorMsg = eventPayload.payment?.error_description || 'Payment failed';
    } else {
      console.log('⏭️  Skipping event:', event);
      res.status(200).json({ acknowledged: true });
      return;
    }

    // Update Supabase with payment status (with failover)
    const { error: updateError } = await executeSupabaseQuery(async (supabaseClient) => {
      return await supabaseClient
        .from('payments')
        .update({
          razorpay_payment_id: paymentId,
          status: statusToUpdate,
          error_message: errorMsg,
          updated_at: new Date().toISOString(),
        })
        .eq('razorpay_order_id', orderId);
    });

    if (updateError) {
      console.error('❌ Error updating payment webhook:', updateError);
    } else {
      console.log('✅ Webhook payment updated in Supabase');
    }

    res.status(200).json({ acknowledged: true });
  } catch (error) {
    console.error('❌ Error in payment webhook:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

console.log('✅ Firebase Cloud Functions deployed');
console.log('📍 Endpoints:');
console.log('  - POST /triggerOwnerForegroundService (send booking alerts)');
console.log('  - POST /sendTestNotification (verify OneSignal setup)');
console.log('  - POST /create-order (create Razorpay order)');
console.log('  - POST /verify-payment (verify payment signature)');
console.log('  - POST /payment-webhook (Razorpay webhook handler)');
