# Reminder System Migration Summary

## Overview
The reminder system has been successfully migrated from using `scheduled_reminders` table to use the `alert_reminders` table exclusively, with the `be-alert-reminders` function handling all server-side reminder processing.

## Changes Made

### 1. Database Schema ✅
- **Created**: `supabase/migrations/create_alert_reminders_table.sql`
- **Removed references to**: `process-scheduled-reminders` function
- **Table structure**: `alert_reminders` has identical schema to `scheduled_reminders`:
  - `id`, `user_id`, `booking_id`, `shop_id`, `shop_name`, `token_number`, `user_name`
  - `time_slot`, `booking_date`, `reminder_time`, `scheduled_for`
  - `timezone_offset_hours`, `sent`, `sent_at`, `created_at`, `updated_at`
- **Indexes**: Optimized for querying pending reminders

### 2. Client-Side Code ✅
**Updated**: `src/lib/supabase-reminders.ts`
- `saveReminderToSupabase()`: Now inserts into `alert_reminders` instead of `scheduled_reminders`
- `getUserPendingReminders()`: Now queries `alert_reminders`
- `getReminder()`: Now queries `alert_reminders`
- `deleteReminder()`: Now deletes from `alert_reminders`
- `getReminderStats()`: Now queries `alert_reminders` for statistics

### 3. Server-Side Processing ✅
**Using existing**: `supabase/functions/be-alert-reminders/index.ts`
- Already configured to query `alert_reminders` table
- Sends OneSignal notifications using `include_aliases` with `external_id` (user_id)
- Marks reminders as sent with `sent_at` timestamp
- Includes comprehensive logging for debugging

### 4. Notification Flow ✅
**No changes needed** to: `src/lib/onesignal-messaging.ts`
- `sendScheduledReminderNotification()` uses 3-layer fallback approach:
  - **Layer 1**: Saves to `alert_reminders` table (now via updated saveReminderToSupabase)
  - **Layer 2**: Saves to localStorage (fallback when app is open)
  - **Layer 3**: OneSignal scheduling via send-native-reminder-notification
- All layers work together for maximum reliability

### 5. Documentation ✅
**Updated**: `SUPABASE_REMINDERS_SETUP.md`
- Step 1: Create `alert_reminders` table (updated SQL)
- Step 2: Deploy `be-alert-reminders` function (existing function)
- Step 3: Schedule `be-alert-reminders` with cron (every minute: `*/1 * * * *`)
- Updated all examples and monitoring queries
- Updated troubleshooting section
- Added migration notes from scheduled_reminders

## Reminder Processing Flow

```
1. USER BOOKS APPOINTMENT
   └─> sendScheduledReminderNotification() called

2. LAYER 1: Server-Side (Primary)
   └─> saveReminderToSupabase()
       └─> INSERT INTO alert_reminders
           └─> Stored in database for be-alert-reminders to process

3. LAYER 2: Client-Side (Fallback)
   └─> saveReminderLocally()
       └─> Stored in localStorage
           └─> Local monitor sends if cron job fails

4. LAYER 3: OneSignal (Legacy Fallback)
   └─> send-native-reminder-notification()
       └─> Direct OneSignal scheduling as final backup

5. SERVER-SIDE PROCESSING (Every minute via cron)
   └─> be-alert-reminders function
       ├─> Query alert_reminders WHERE sent=false AND scheduled_for<=now()
       ├─> For each reminder:
       │   ├─> Send OneSignal notification via external_id (user_id)
       │   └─> UPDATE alert_reminders SET sent=true, sent_at=now()
       └─> Log results and continue
```

## How to Activate

### Step 1: Create the Database Table
1. Go to Supabase Dashboard → SQL Editor
2. Run the SQL from `supabase/migrations/create_alert_reminders_table.sql`
3. Verify table was created: `SELECT * FROM alert_reminders LIMIT 1;` (should show empty table)

### Step 2: Deploy the Function
1. Run: `supabase functions deploy be-alert-reminders`
2. Or deploy all: `supabase functions deploy`

### Step 3: Schedule the Cron Trigger
1. Go to Supabase Dashboard → Edge Functions
2. Click on `be-alert-reminders`
3. Click "Schedule"
4. Set cron expression to: `*/1 * * * *` (every minute)
5. Add name: "Be Alert Reminders"
6. Save

## Testing the Migration

### Manual Database Test
```sql
-- Check if table exists
SELECT * FROM alert_reminders LIMIT 1;

-- View all reminders
SELECT id, user_id, booking_id, shop_name, scheduled_for, sent 
FROM alert_reminders 
ORDER BY created_at DESC;

-- View pending reminders (due now)
SELECT COUNT(*) as pending_count 
FROM alert_reminders 
WHERE sent = FALSE AND scheduled_for <= NOW();
```

### Manual Function Test
```bash
curl -X POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/be-alert-reminders \
  -H "Content-Type: application/json" \
  -d '{}'
```

### End-to-End Test
1. Book an appointment with a reminder 5 minutes from now
2. Check database: `SELECT * FROM alert_reminders WHERE booking_id = 'YOUR_BOOKING_ID';`
3. Wait for cron to trigger (max 1 minute)
4. Verify notification was received
5. Check database again: Verify `sent = true` and `sent_at` is populated

## Verification Checklist

- ✅ `alert_reminders` migration created
- ✅ `saveReminderToSupabase()` uses `alert_reminders`
- ✅ All reminder functions use `alert_reminders`
- ✅ `be-alert-reminders` function is correctly configured
- ✅ Documentation updated
- ✅ No references to `process-scheduled-reminders` in active code
- ⏳ Database table created (user responsibility)
- ⏳ Function deployed (user responsibility)
- ⏳ Cron trigger scheduled (user responsibility)

## What Was NOT Changed

- Local reminder system (`local-reminders.ts`) - Still works as fallback
- Direct OneSignal scheduling fallback - Still works as final backup
- UI Components - No changes needed
- Booking flow - No changes needed
- Notification handlers - No changes needed

## Rollback Plan

If you need to revert:
1. This is a forward migration only (scheduled_reminders → alert_reminders)
2. Old `scheduled_reminders` table can be kept for historical data
3. Code no longer uses `scheduled_reminders`, so it can be archived
4. Local reminders will continue to work as fallback

## Important Notes

⚠️ **Required Actions by User:**
1. Run the SQL migration to create `alert_reminders` table
2. Deploy `be-alert-reminders` function to Supabase
3. Schedule the cron trigger (recommended: every 1 minute)

✅ **Already Done by Assistant:**
1. Created migration file
2. Updated all client-side code
3. Updated documentation
4. Verified server-side function is correct

## Support

If reminders aren't working after migration:
1. Check Supabase Dashboard → Edge Functions → be-alert-reminders → Invocations
2. Query database: `SELECT * FROM alert_reminders;`
3. Verify OneSignal credentials in `be-alert-reminders` function
4. Check browser console for client-side errors
5. Verify cron job is scheduled and enabled
