# Booking Notifications Implementation

## Overview

This implementation sets up **automatic shop owner notifications** whenever a booking is created, updated, or deleted. Unlike the client-side approach, this uses **database triggers** to ensure notifications are sent regardless of how the booking was created (UI, API, bulk import, etc.).

## Architecture

```
Booking Inserted/Updated/Deleted
    ↓
Database Trigger
    ↓
notify_shop_owner_of_booking_change() [PL/pgSQL]
    ↓
Queue notification in booking_notification_queue table
    ↓
pg_cron scheduler (runs every minute)
    ↓
process-booking-notifications [Edge Function]
    ↓
Send via OneSignal API
    ↓
Shop Owner receives notification
```

## Components

### 1. Database Migration
**File:** `supabase/migrations/20250213_create_booking_notification_triggers.sql`

Creates:
- `booking_notification_queue` table - stores pending notifications
- `notify_shop_owner_of_booking_change()` - PL/pgSQL trigger function
- Three triggers on `bookings` table:
  - `trigger_booking_created` - on INSERT
  - `trigger_booking_updated` - on UPDATE (status changes)
  - `trigger_booking_deleted` - on DELETE

**How it works:**
1. When a booking is inserted/updated/deleted, the trigger fires
2. Fetches shop owner user ID from `native_shop_owners` table
3. Queues a notification with title, body, and metadata
4. Returns control immediately (non-blocking)

### 2. Edge Function
**File:** `supabase/functions/process-booking-notifications/index.ts`

Processes the notification queue:
- Fetches up to 10 pending notifications
- Sends each via OneSignal API
- Marks as "sent" on success
- Increments retry counter on failure (max 3 retries)
- Handles errors gracefully

**Required environment variables:**
```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ONESIGNAL_API_KEY
ONESIGNAL_APP_ID
```

### 3. Cron Scheduler
**File:** `supabase/migrations/20250213_setup_booking_notification_cron.sql`

Schedules the notification processor:
- Runs every minute (configurable)
- Calls the Edge Function to process queue
- Built on `pg_cron` extension

## Notification Types

### 1. New Booking Created
```
Title: 📅 New Booking!
Body: "[Customer] booked [Service] at [Time]. Token #[Number]"
Data: {
  event: "booking_created",
  bookingId, customerName, customerPhone, serviceName, timeSlot, tokenNumber, bookingDate, shopId
}
```

### 2. Booking Status Updated
```
Title: ⏳ Booking In Progress | ✅ Completed | ❌ Cancelled
Body: Varies by status
Data: {
  event: "booking_status_changed",
  bookingId, customerName, oldStatus, newStatus, serviceName, shopId
}
```

### 3. Booking Deleted
```
Title: ❌ Booking Cancelled
Body: "Booking for [Customer] ([Service] at [Time]) has been deleted."
Data: {
  event: "booking_deleted",
  bookingId, customerName, serviceName, timeSlot, shopId
}
```

## Key Features

✅ **Reliable** - Uses database queue, retries up to 3 times
✅ **Asynchronous** - Non-blocking notifications
✅ **Complete** - Catches ALL booking changes (UI, API, direct DB inserts)
✅ **Scalable** - Queue-based processing handles high volume
✅ **Debuggable** - Logs all events, tracks retry counts
✅ **Flexible** - Easy to modify notification templates or behavior

## How to Deploy

1. **Run migrations:**
   ```bash
   npx supabase migration up
   ```

2. **Verify triggers are created:**
   ```sql
   SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'bookings';
   ```

3. **Check Edge Function is available:**
   ```bash
   npx supabase functions list
   ```

4. **Verify cron job:**
   ```sql
   SELECT * FROM cron.job;
   ```

5. **Monitor the queue:**
   ```sql
   SELECT * FROM booking_notification_queue ORDER BY created_at DESC LIMIT 10;
   ```

## Testing

### Test 1: Create a booking and check the queue
```sql
-- Queue should be populated within 1 second of booking creation
SELECT * FROM booking_notification_queue WHERE status = 'pending' ORDER BY created_at DESC LIMIT 1;
```

### Test 2: Check cron job execution
```sql
-- View cron logs (if available in your Supabase version)
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

### Test 3: Monitor processed notifications
```sql
-- See sent notifications
SELECT * FROM booking_notification_queue 
WHERE status = 'sent' 
ORDER BY sent_at DESC 
LIMIT 10;
```

## Troubleshooting

### Notifications not being sent?

1. **Check queue is populated:**
   ```sql
   SELECT COUNT(*) FROM booking_notification_queue WHERE status = 'pending';
   ```

2. **Check Edge Function environment variables:**
   - Ensure ONESIGNAL_API_KEY and ONESIGNAL_APP_ID are set
   - Verify Supabase URL configuration

3. **Check cron job is running:**
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'process-booking-notifications';
   ```

4. **Check for failed notifications:**
   ```sql
   SELECT * FROM booking_notification_queue 
   WHERE status = 'failed' 
   ORDER BY created_at DESC;
   ```

### Shop owner not receiving notifications?

1. **Verify native_shop_owners record exists:**
   ```sql
   SELECT * FROM native_shop_owners WHERE shop_id = '[YOUR_SHOP_ID]';
   ```

2. **Verify shop owner's OneSignal user ID is registered:**
   - Check that the user's `user_id` is set as the OneSignal external ID

3. **Test OneSignal directly:**
   - Use OneSignal dashboard to send test notification to the external user ID

## Coexistence with Client-Side Notifications

The **client-side notification system** (`src/lib/booking-notification-system.ts`) can work alongside this:
- **For normal UI bookings:** Both client-side and database triggers will fire (notification may be sent twice, but OneSignal deduplicates)
- **For API/bulk bookings:** Only database triggers will send notifications
- **Recommendation:** Keep the client-side system for immediate UX feedback, rely on database triggers for reliability

## Modifications

### Change notification frequency
Edit the cron schedule in `supabase/migrations/20250213_setup_booking_notification_cron.sql`:
```sql
-- Change from '* * * * *' (every minute) to:
'*/5 * * * *'  -- Every 5 minutes
'0 * * * *'    -- Every hour
```

### Disable status change notifications
In `notify_shop_owner_of_booking_change()`, comment out or modify the UPDATE section.

### Add more event types
Add additional conditions in the trigger function to queue notifications for other events.

## Performance Considerations

- Queue is indexed on `status` and `booking_id` for fast queries
- Processes 10 notifications per run (adjust in Edge Function)
- Cron runs every minute (prevents queue overload)
- RLS is enabled for security

## References

- Supabase Triggers: https://supabase.com/docs/guides/database/extensions/plpgsql
- Supabase pg_cron: https://supabase.com/docs/guides/database/extensions/pgcron
- OneSignal API: https://documentation.onesignal.com/reference/push-channel-properties
