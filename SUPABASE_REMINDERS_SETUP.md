# Supabase Alert Reminders Setup Guide

This guide walks you through setting up server-side reminder processing using Supabase's `alert_reminders` table and the `be-alert-reminders` Edge Function.

## Overview

The system uses **alert_reminders** table with the `be-alert-reminders` Edge Function for server-side processing:

1. **Primary**: `alert_reminders` table + `be-alert-reminders` function (runs every minute via cron)
2. **Fallback 1**: Local browser storage (works when app is open)
3. **Fallback 2**: Legacy OneSignal scheduling (compatibility fallback)

## Setup Steps

### Step 1: Create the Database Table

Go to your Supabase dashboard and run this SQL in the SQL Editor:

```sql
-- Create table for alert reminders (processed by be-alert-reminders function)
CREATE TABLE IF NOT EXISTS alert_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  booking_id TEXT NOT NULL,
  shop_id TEXT NOT NULL,
  shop_name TEXT NOT NULL,
  token_number INT NOT NULL,
  user_name TEXT NOT NULL,
  time_slot TEXT NOT NULL,
  booking_date TEXT NOT NULL,
  reminder_time TEXT NOT NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  timezone_offset_hours FLOAT DEFAULT 0,
  sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_alert_reminders_pending
ON alert_reminders(sent, scheduled_for)
WHERE sent = FALSE;

CREATE INDEX IF NOT EXISTS idx_alert_reminders_user
ON alert_reminders(user_id);

CREATE INDEX IF NOT EXISTS idx_alert_reminders_booking
ON alert_reminders(booking_id);
```

### Step 2: Deploy the Edge Function

The Edge Function `be-alert-reminders` is already created at: `supabase/functions/be-alert-reminders/index.ts`

Deploy it using Supabase CLI:

```bash
# Login to Supabase
supabase login

# Deploy the function
supabase functions deploy be-alert-reminders

# Or deploy all functions
supabase functions deploy
```

### Step 3: Create the CRON Trigger

Go to your Supabase dashboard:

1. Navigate to **Edge Functions** section
2. Click on **be-alert-reminders**
3. Click **Schedule**
4. Set the cron expression to: `*/1 * * * *` (every minute)
   - This checks for pending reminders every minute
   - The be-alert-reminders function is lightweight and efficient
   - Adjust frequency based on your needs:
     - `*/1 * * * *` = every minute (recommended for real-time reminders)
     - `*/5 * * * *` = every 5 minutes
     - `*/15 * * * *` = every 15 minutes
     - `0 * * * *` = every hour

5. Add a name: "Be Alert Reminders"
6. Save the trigger

**Cron Expression Reference:**
```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6)
│ │ │ │ │
│ │ │ │ │
* * * * *
```

## How It Works

### User Books Appointment with Reminder

```
1. User selects reminder time (e.g., 22:53)
2. Booking is saved
3. sendScheduledReminderNotification() is called
   ├─ Layer 1: Save to alert_reminders table
   ├─ Layer 2: Save to local storage (fallback)
   └─ Layer 3: OneSignal scheduling (legacy fallback)
4. Booking confirmed ✅
```

### Server-Side Processing (Every minute via be-alert-reminders)

```
1. Cron job triggers be-alert-reminders function
2. Function queries alert_reminders table for reminders where:
   - sent = FALSE
   - scheduled_for <= NOW()
3. For each pending reminder:
   - Send notification via OneSignal using external_id (user_id) alias
   - Mark as sent in database
   - Update sent_at timestamp
4. Log results and continue
```

## Database Schema

### `alert_reminders` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | TEXT | Firebase user ID (External ID in OneSignal) |
| `booking_id` | TEXT | Booking ID |
| `shop_id` | TEXT | Shop ID |
| `shop_name` | TEXT | Shop name for notification |
| `token_number` | INT | Token/ticket number |
| `user_name` | TEXT | User's name |
| `time_slot` | TEXT | Appointment time (HH:MM) |
| `booking_date` | TEXT | Appointment date (YYYY-MM-DD) |
| `reminder_time` | TEXT | Reminder time (HH:MM) |
| `scheduled_for` | TIMESTAMP | UTC timestamp when to send |
| `timezone_offset_hours` | FLOAT | User's timezone offset |
| `sent` | BOOLEAN | Whether notification was sent |
| `sent_at` | TIMESTAMP | When notification was sent |
| `created_at` | TIMESTAMP | Record creation time |
| `updated_at` | TIMESTAMP | Last update time |

## Testing

### Test via Browser Console

```javascript
// Import the reminder functions
import { getReminderStats } from '@/lib/supabase-reminders';

// Check reminder statistics
const stats = await getReminderStats();
console.log(stats);
// Output:
// {
//   total: 5,
//   pending: 2,
//   sent: 3,
//   dueNow: [...]
// }
```

### Test the Edge Function Manually

Visit this URL in your browser (replace YOUR_PROJECT_ID):
```
https://YOUR_PROJECT_ID.supabase.co/functions/v1/process-scheduled-reminders
```

Or use curl:
```bash
curl -X POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/process-scheduled-reminders \
  -H "Content-Type: application/json"
```

### Test Reminder Scheduling

1. Create a booking with reminder time 5 minutes from now
2. Check the database:
   ```sql
   SELECT * FROM scheduled_reminders 
   WHERE user_id = 'YOUR_USER_ID' 
   ORDER BY created_at DESC;
   ```
3. Wait for the cron job to run
4. Verify notification is received
5. Check that `sent = TRUE` in database

## Monitoring

### Monitor via Supabase Dashboard

1. Go to **Edge Functions**
2. Click **be-alert-reminders**
3. View **Invocations** tab for recent runs
4. Check logs for errors and notification delivery status

### Check Pending Reminders

```sql
-- View all pending reminders
SELECT
  booking_id,
  user_name,
  shop_name,
  time_slot,
  scheduled_for,
  now() as current_time,
  (scheduled_for - now()) as time_until_send
FROM alert_reminders
WHERE sent = FALSE
ORDER BY scheduled_for ASC;

-- Count pending reminders
SELECT COUNT(*) as pending_count
FROM alert_reminders
WHERE sent = FALSE AND scheduled_for <= NOW();
```

### Check Sent Reminders

```sql
-- View recently sent reminders
SELECT
  booking_id,
  user_name,
  shop_name,
  scheduled_for,
  sent_at,
  (sent_at - scheduled_for) as delay
FROM alert_reminders
WHERE sent = TRUE
ORDER BY sent_at DESC
LIMIT 20;
```

## Troubleshooting

### Reminders Not Sending

1. **Check if table exists:**
   ```sql
   SELECT * FROM alert_reminders LIMIT 1;
   ```

2. **Check if cron is scheduled:**
   - Go to Supabase Dashboard → Edge Functions
   - Click **be-alert-reminders** → Check if schedule is enabled
   - Verify cron expression is set to `*/1 * * * *` (every minute)

3. **Check Edge Function logs:**
   - Supabase Dashboard → Edge Functions → be-alert-reminders → Invocations
   - Look for error messages or notification delivery failures

4. **Check if reminders were saved:**
   ```sql
   SELECT * FROM alert_reminders
   WHERE user_id = 'YOUR_USER_ID'
   ORDER BY created_at DESC;
   ```

5. **Manually trigger the function:**
   ```bash
   curl -X POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/be-alert-reminders \
     -H "Content-Type: application/json" \
     -d '{}'
   ```

### Timezone Issues

The system converts user's local time to UTC automatically:
- User enters: 14:30 (local time, IST UTC+5:30)
- System calculates: 09:00 UTC
- Notification fires: At exactly that UTC time

If reminders fire at wrong time:
1. Check `timezone_offset_hours` in database (should match user's timezone)
2. Check `scheduled_for` column (should be in UTC)
3. Verify user's system timezone is correct

### Performance

- **Cron frequency**: `*/1 * * * *` processes every minute (lightweight)
- **Database**: Indexed on `(sent, scheduled_for)` for fast queries
- **Notification delivery**: OneSignal API call is async, won't block processing
- **Typical processing time**: <1 second for processing and notification delivery

## Cost Considerations

Using Supabase CRON + Edge Functions:
- **Cron invocations**: Minimal cost (counted as function invocations)
- **Database queries**: Minimal cost (simple indexed queries)
- **OneSignal**: Only charged per notification sent (same as before)
- **Overall**: Cost reduction vs. always-on local scheduler

## Migration from Scheduled Reminders

If you were previously using the `scheduled_reminders` table:

1. The code has been updated to use `alert_reminders` instead
2. Create the `alert_reminders` table using the SQL migration (Step 1)
3. Deploy and schedule the `be-alert-reminders` function (Steps 2-3)
4. New reminders will be stored in `alert_reminders` and processed by `be-alert-reminders`
5. Old `scheduled_reminders` data can be archived or deleted after migration

The local reminder system (`local-reminders.ts`) is still active as fallback:
- Works when app is open
- Provides redundancy if server-side processing is delayed
- Can be kept for backward compatibility

## Files Modified/Created

### Key Files:
- `supabase/functions/be-alert-reminders/index.ts` - Edge Function (already present)
- `supabase/migrations/create_alert_reminders_table.sql` - Database migration
- `src/lib/supabase-reminders.ts` - Client library (updated to use alert_reminders)
- `src/lib/onesignal-messaging.ts` - Notification orchestration (uses sendScheduledReminderNotification with 3-layer fallback)

## Next Steps

1. Create the `alert_reminders` database table (Step 1)
2. Deploy the `be-alert-reminders` Edge Function (Step 2)
3. Set up the CRON trigger for `be-alert-reminders` (Step 3)
4. Test with a real booking
5. Monitor logs via Supabase Dashboard
6. Verify notifications are being sent to users
7. Adjust cron frequency if needed (currently every minute)

## Support

If you encounter issues:
1. Check Supabase Edge Function logs
2. Query the database directly
3. Check browser console for client-side errors
4. Verify timezone offset is correct
5. Confirm OneSignal credentials are valid
