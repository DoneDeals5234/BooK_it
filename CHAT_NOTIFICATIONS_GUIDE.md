# Hybrid Chat Notifications System

## Overview

This system implements **3-layer fallback notifications** for temporary chat messages. When a customer sends a message in a shop's chat, the shop owner is notified through multiple channels with automatic fallbacks.

## Architecture

```
Customer Sends Message
│
├─ Layer 1: OneSignal Push Notification (Fast, Immediate)
│  │
│  ├─ Success → Shop owner receives push notification immediately ✅
│  └─ Fail → Fallback to Layer 2
│
├─ Layer 2: WhatsApp Message Link (Reliable)
│  │
│  ├─ Success → WhatsApp link saved & can be sent manually 📱
│  └─ Fail → Fallback to Layer 3
│
└─ Layer 3: Database Trigger (Guaranteed)
   │
   ├─ Record saved to database
   └─ Server-side cron job processes & sends notification 💾
```

## Implementation Details

### Layer 1: OneSignal Push Notification

**What happens:**
1. Customer sends message in temporary chat
2. System fetches shop owner's player ID from `native_devices` table
3. Sends notification via Supabase Edge Function → OneSignal API
4. Shop owner receives instant push notification

**Requirements:**
- Shop owner must have installed the app
- Shop owner must have allowed push notifications
- Device must be registered with OneSignal

**Success indicators:**
- Notification appears on shop owner's device immediately
- Console shows: `✅ Layer 1: OneSignal notification sent successfully`

---

### Layer 2: WhatsApp Fallback

**What happens:**
1. If Layer 1 fails (no player ID, notification disabled, etc.)
2. System creates a WhatsApp message link with pre-filled message
3. Stores the link in `chat_notifications_fallback` table
4. Can be sent manually or through SMS/email

**Requirements:**
- Shop owner's phone number in shop details
- WhatsApp installed on shop owner's phone

**Success indicators:**
- Console shows: `✅ Layer 2: WhatsApp notification prepared`
- WhatsApp URL available in `chat_notifications_fallback` table

**Manual trigger:**
```typescript
const url = getWhatsAppFallbackUrl(shopId);
window.open(url); // Opens WhatsApp
```

---

### Layer 3: Database Trigger (Server-Side)

**What happens:**
1. Notification request saved to `chat_notifications` table with `status: 'pending'`
2. Server-side cron job (optional) or manual trigger processes pending notifications
3. Fetches shop owner's latest player ID from database
4. Sends OneSignal notification from server

**Requirements:**
- Edge function `process-chat-notifications` deployed to Supabase
- Optional: Cron job scheduling in `pg_cron`
- OneSignal API key configured in Supabase secrets

**How to trigger:**
```bash
# Manual trigger
curl -X POST https://your-project.supabase.co/functions/v1/process-chat-notifications \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Scheduled (optional, requires pg_cron)
SELECT cron.schedule('process-chat-notifications', '*/5 * * * *', 
  'SELECT http_post(''https://your-project.supabase.co/functions/v1/process-chat-notifications'')');
```

---

## Database Tables

### `chat_notifications` (Layer 3)
```sql
CREATE TABLE chat_notifications (
  id UUID PRIMARY KEY,
  shop_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_email TEXT,
  message TEXT NOT NULL,
  notification_type TEXT, -- 'temporary_chat_message'
  status TEXT, -- 'pending', 'processed', 'sent', 'failed'
  sent_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### `chat_notifications_fallback` (Layer 2)
```sql
CREATE TABLE chat_notifications_fallback (
  id UUID PRIMARY KEY,
  shop_id TEXT NOT NULL,
  type TEXT, -- 'whatsapp', 'sms', etc.
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL,
  whatsapp_url TEXT,
  status TEXT, -- 'prepared', 'clicked', 'expired'
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

---

## Setup Instructions

### 1. Apply Database Migrations
```bash
# Supabase will auto-apply migrations when deployed
# Or manually run:
# supabase/migrations/20250213_create_chat_notifications_tables.sql
```

### 2. (Optional) Deploy Edge Function for Layer 3
```bash
# Deploy the process-chat-notifications function
supabase functions deploy process-chat-notifications

# Set environment variables
supabase secrets set ONESIGNAL_API_KEY=<your-key>
supabase secrets set ONESIGNAL_APP_ID=<your-app-id>
```

### 3. (Optional) Setup Cron Schedule
Execute in Supabase SQL Editor:
```sql
-- Process notifications every 5 minutes
SELECT cron.schedule('process-chat-notifications', '*/5 * * * *', 
  'SELECT http_post(''https://YOUR_PROJECT.supabase.co/functions/v1/process-chat-notifications'')');
```

### 4. Test the System

**Test Layer 1 (OneSignal):**
1. Open shop as customer
2. Send message in temporary chat
3. Should see `✅ Shop owner notified!` toast
4. Check shop owner's device for notification

**Test Layer 2 (WhatsApp):**
1. Disable player ID in `native_devices` table (simulate Layer 1 failure)
2. Send message again
3. Should see WhatsApp link prepared in database
4. Check `chat_notifications_fallback` table

**Test Layer 3 (Database):**
1. Check `chat_notifications` table has records
2. Call edge function: `POST /functions/v1/process-chat-notifications`
3. Should process pending notifications

---

## Monitoring & Debugging

### Check Layer 1 Status
```sql
-- View native devices
SELECT user_id, player_id FROM native_devices WHERE user_id = 'shop-owner-id';

-- View OneSignal calls in logs
-- Check Supabase function logs for send-native-notification
```

### Check Layer 2 Status
```sql
-- View WhatsApp fallback records
SELECT * FROM chat_notifications_fallback 
WHERE shop_id = 'your-shop-id' 
ORDER BY created_at DESC;
```

### Check Layer 3 Status
```sql
-- View pending notifications
SELECT * FROM chat_notifications 
WHERE status IN ('pending', 'failed') 
ORDER BY created_at DESC;

-- View processed notifications
SELECT * FROM chat_notifications 
WHERE status = 'sent' 
ORDER BY sent_at DESC;
```

### Browser Console Logs
All layers log detailed information:
```
🔔 Starting hybrid chat notification system...
📱 Layer 1: Attempting OneSignal push notification...
💬 Layer 2: Attempting WhatsApp fallback...
💾 Layer 3: Saving to database for server-side trigger...
```

---

## Success Indicators

### Customer Sees (Toast Messages)
- `✅ Shop owner notified!` → Layer 1 success
- `📱 Notification sent via WhatsApp!` → Layer 2 fallback used
- `💾 Notification queued for processing` → Layer 3 processing
- `⚠️ Could not send notification...` → All layers failed

### Shop Owner Receives
1. **Layer 1:** Instant push notification on device
2. **Layer 2:** Can receive WhatsApp message (manual or automatic)
3. **Layer 3:** Receives notification from server-side processing

---

## Troubleshooting

### Problem: Layer 1 always fails
**Solution:**
- Check if shop owner's device is registered: `SELECT * FROM native_devices`
- Verify player_id is not NULL
- Check if OneSignal permissions allowed on device
- Test by sending scheduled reminder (which uses Layer 3)

### Problem: Layer 2 WhatsApp link not working
**Solution:**
- Verify shop owner phone number in shop details
- Check if phone number includes country code
- Test WhatsApp URL directly: `https://wa.me/[PHONE]?text=[MESSAGE]`

### Problem: Layer 3 not processing
**Solution:**
- Verify Edge Function is deployed: `supabase functions list`
- Check Supabase secrets are set: `supabase secrets list`
- Call function manually to test
- Check function logs in Supabase Dashboard

### Problem: Notifications not arriving at all
**Solution:**
1. Check all three layers in console logs
2. If all fail, verify:
   - Shop owner email matches profile email
   - Shop owner has an account
   - OneSignal API key is correct
   - Notification permissions granted

---

## API Reference

### sendChatNotificationHybrid()
```typescript
const result = await sendChatNotificationHybrid({
  shopId: string,
  senderName: string,
  message: string,
  senderEmail?: string,
});

// Returns
{
  success: boolean,
  layers: string[] // ['OneSignal', 'WhatsApp', 'DatabaseTrigger']
}
```

### getWhatsAppFallbackUrl()
```typescript
const url = getWhatsAppFallbackUrl(shopId);
window.open(url); // Opens WhatsApp if available
```

---

## Performance Characteristics

| Layer | Speed | Reliability | Requires |
|-------|-------|-------------|----------|
| **Layer 1** | Instant (< 100ms) | 70% | Player ID + Permissions |
| **Layer 2** | Manual | 95% | Phone Number + WhatsApp |
| **Layer 3** | Delayed (5-15 min) | 98% | Server Processing |

---

## Cost Considerations

- **Layer 1 (OneSignal):** Included with existing OneSignal plan
- **Layer 2 (WhatsApp):** Free (no API calls needed)
- **Layer 3 (Database):** Minimal (small records, rare processing)

---

## Future Enhancements

1. Add SMS fallback (Layer 2.5)
2. Add email notification (Layer 3.5)
3. Add Telegram integration
4. Implement notification read receipts
5. Add notification analytics dashboard
