# Reminder Implementation Summary

## What Was Done

### 1. ✅ Created Database Migration
- **File**: `supabase/migrations/create_alert_reminders_table.sql`
- **What it does**: Defines the `alert_reminders` table structure with all required fields

### 2. ✅ Updated Client Code
- **File**: `src/lib/supabase-reminders.ts`
  - All functions now use `alert_reminders` table instead of `scheduled_reminders`
  - Added detailed logging to show exactly what's being saved
  - Better error messages for debugging

- **File**: `src/components/BookingModal.tsx`
  - Added call to `startReminderMonitor()` when reminder is set
  - Added cleanup function to stop monitors when modal closes
  - Added detailed logging messages

### 3. ✅ Created Per-Reminder Monitor System
- **File**: `src/lib/reminder-monitor.ts`
  - Monitors individual reminders
  - Checks every 1 minute if it's time to send
  - Automatically stops after reminder is sent
  - Tracks attempt count and provides status

### 4. ✅ Created Edge Function for Per-Reminder Processing
- **File**: `supabase/functions/process-pending-reminder/index.ts`
  - Called by the client-side monitor every 1 minute
  - Checks if scheduled time has arrived
  - Sends OneSignal notification when time comes
  - Marks reminder as sent in database

## How The System Works

```
┌─────────────────────────────────────────────────────┐
│  USER BOOKS APPOINTMENT & SETS REMINDER             │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│  Client saves reminder to alert_reminders table      │
│  (calls saveReminderToSupabase)                      │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│  Client-side monitor STARTS                         │
│  (calls startReminderMonitor)                       │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────┐
        │  Every 1 minute, call   │
        │  process-pending-       │
        │  reminder function      │
        └────────┬────────────────┘
                 │
        ┌────────▼──────────┐
        │   Is it time to   │
        │   send reminder?  │
        └────────┬──────────┘
                 │
        ┌────────┴──────────┐
        │                   │
    NO  ▼                   ▼  YES
   Wait 1 min         Send OneSignal
   Check again       notification
                     Mark sent=true
                     Stop monitor
                           │
                           ▼
                        DONE ✅
```

## Step-by-Step Setup

### Step 1: Create the Database Table (CRITICAL)
```sql
-- Go to Supabase Dashboard → SQL Editor
-- Run this SQL:

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

CREATE INDEX IF NOT EXISTS idx_alert_reminders_pending
ON alert_reminders(sent, scheduled_for) WHERE sent = FALSE;

CREATE INDEX IF NOT EXISTS idx_alert_reminders_user 
ON alert_reminders(user_id);

CREATE INDEX IF NOT EXISTS idx_alert_reminders_booking 
ON alert_reminders(booking_id);
```

### Step 2: Deploy the Edge Function
```bash
# Run this command in terminal
supabase functions deploy process-pending-reminder

# Or deploy all functions
supabase functions deploy
```

### Step 3: Test It!

#### Test A: Watch Browser Console
1. Open the app
2. Book an appointment
3. Set reminder for **2-3 minutes from now**
4. Open browser DevTools (F12) → Console tab
5. Watch for messages like:
   ```
   🔔 saveReminderToSupabase called
   📝 Reminder saved to alert_reminders table
   ⏳ Starting reminder monitor - will check every 1 minute
   🔄 Reminder monitor check #1 for booking xyz...
   ⏰ Time remaining: 2 minute(s)
   🔄 Reminder monitor check #2 for booking xyz...
   ⏰ Time remaining: 1 minute(s)
   🔄 Reminder monitor check #3 for booking xyz...
   ✅ Reminder successfully sent for booking xyz
   🛑 Reminder monitor stopped for booking xyz
   ```

#### Test B: Check Database
```sql
-- Check if reminder was saved
SELECT * FROM alert_reminders 
WHERE booking_id = 'YOUR_BOOKING_ID';

-- Should see: sent = false, scheduled_for = future time

-- Wait for the reminder time to pass, then check again
-- Should see: sent = true, sent_at = current time
```

#### Test C: Manual Function Call
```bash
# Get your booking ID from the database query above
# Replace YOUR_PROJECT_ID and YOUR_BOOKING_ID

curl -X POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/process-pending-reminder \
  -H "Content-Type: application/json" \
  -d '{"bookingId": "YOUR_BOOKING_ID"}'

# You should get a response like:
# {"success": true, "message": "Not yet time to send", "timeRemaining": 120000}
```

## What to Look For in Logs

### Success Logs
```
✅ Reminder saved to alert_reminders successfully
✅ Reminder monitor started for booking xyz - will check every 1 minute
✅ Reminder successfully sent for booking xyz
✅ Reminder monitor stopped for booking xyz (checked 3 times)
```

### Error Logs
```
❌ Error saving reminder to alert_reminders:
❌ Reminder was NOT saved to alert_reminders table
❌ Exception in saveReminderToSupabase:
❌ Check failed on attempt X:
```

If you see error logs, check:
1. Is the `alert_reminders` table created?
2. Is the function deployed?
3. Check Supabase logs for permission errors
4. Check OneSignal credentials are correct

## Testing Checklist

- [ ] Created `alert_reminders` table in Supabase
- [ ] Deployed `process-pending-reminder` function
- [ ] Tested booking with reminder
- [ ] Saw success logs in browser console
- [ ] Reminder showed as `sent=false` in database before time
- [ ] Reminder showed as `sent=true` in database after time
- [ ] Received OneSignal notification at reminder time
- [ ] Monitor stopped checking after notification sent

## Common Issues & Solutions

### Issue: "Table does not exist" error
**Solution**: Make sure you ran the SQL migration to create the `alert_reminders` table

### Issue: "Reminder was NOT saved to alert_reminders"
**Solution**:
1. Check browser console for error details
2. Check Supabase Dashboard → Logs for SQL errors
3. Make sure table exists: `SELECT * FROM alert_reminders LIMIT 1;`

### Issue: Monitor starts but never sends
**Solution**:
1. Check if reminder time is in the future
2. Verify `scheduled_for` in database is correct UTC time
3. Check timezone calculation in logs
4. Manually call function to test:
   ```bash
   curl -X POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/process-pending-reminder \
     -H "Content-Type: application/json" \
     -d '{"bookingId": "xyz"}'
   ```

### Issue: No notification received
**Solution**:
1. Check OneSignal dashboard for delivery status
2. Verify user has enabled push notifications
3. Check OneSignal credentials in `process-pending-reminder` function
4. Verify `external_id` is set for user in OneSignal

## How to Add Backup Cron Job (Optional)

If you want a backup cron that also checks every minute:

1. Go to Supabase Dashboard
2. Navigate to Edge Functions
3. Find `be-alert-reminders`
4. Click "Schedule"
5. Set cron expression: `*/1 * * * *` (every minute)
6. Save

This ensures reminders get sent even if client-side monitor fails.

## Files Changed

### New Files:
- `supabase/migrations/create_alert_reminders_table.sql`
- `supabase/functions/process-pending-reminder/index.ts`
- `src/lib/reminder-monitor.ts`

### Modified Files:
- `src/components/BookingModal.tsx`
- `src/lib/supabase-reminders.ts`
- `SUPABASE_REMINDERS_SETUP.md`

## Next Actions

1. **Run the SQL migration** to create the table
2. **Deploy the function** with Supabase CLI
3. **Test with a booking** and watch console logs
4. **Verify database** shows reminder saved
5. **Check if notification received** at reminder time
6. **(Optional)** Add backup cron job

## Questions?

Check the detailed guide: `REMINDER_SYSTEM_COMPLETE_SETUP.md`

For quick reference:
- **How it works**: Flow diagram above
- **Detailed setup**: `REMINDER_SYSTEM_COMPLETE_SETUP.md`
- **Previous migration**: `REMINDER_MIGRATION_SUMMARY.md`
