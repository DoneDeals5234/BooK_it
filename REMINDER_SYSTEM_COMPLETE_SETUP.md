# Complete Reminder System Setup Guide

## Overview

Your reminder system now works with **per-reminder monitoring**:

1. **User books and sets reminder** → Reminder saved to `alert_reminders` table
2. **Client-side monitor starts** → Checks every 1 minute if it's time to send
3. **When time comes** → OneSignal sends notification
4. **After sending** → Monitor stops automatically

## How It Works

### Step 1: User Sets Reminder (When they click "Confirm Booking")

```
User fills in booking details
    ↓
Selects reminder time (e.g., 14:30)
    ↓
Clicks "Confirm Booking" button
    ↓
System saves reminder to alert_reminders table
    ↓
Client-side monitor starts (checks every 1 minute)
    ↓
Confirmation shown: "Reminder set for 14:30"
```

### Step 2: Client-Side Monitor (Every 1 Minute)

```
Monitor starts running every 1 minute
    ↓
Calls process-pending-reminder function with bookingId
    ↓
Function checks: Is it time to send? (is scheduled_for <= now?)
    ↓
Not yet time → Continue checking next minute
```

### Step 3: Time to Send Reminder

```
Scheduled time reached (e.g., 14:30)
    ↓
process-pending-reminder function detects it's time
    ↓
Sends OneSignal notification to user (via external_id/user_id)
    ↓
Marks reminder as sent in database (sent=true)
    ↓
Client-side monitor stops checking
```

## Database Tables

### `alert_reminders` Table

```sql
CREATE TABLE alert_reminders (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,           -- Firebase user ID
  booking_id TEXT NOT NULL,        -- Unique booking ID
  shop_id TEXT NOT NULL,           -- Shop ID
  shop_name TEXT NOT NULL,         -- Shop name (for notification)
  token_number INT NOT NULL,       -- Token/ticket number
  user_name TEXT NOT NULL,         -- User's name
  time_slot TEXT NOT NULL,         -- Appointment time (HH:MM)
  booking_date TEXT NOT NULL,      -- Appointment date (YYYY-MM-DD)
  reminder_time TEXT NOT NULL,     -- Reminder time (HH:MM)
  scheduled_for TIMESTAMP,         -- When to send (UTC)
  timezone_offset_hours FLOAT,     -- User's timezone offset
  sent BOOLEAN DEFAULT FALSE,      -- Has reminder been sent?
  sent_at TIMESTAMP,               -- When was it sent?
  created_at TIMESTAMP,            -- When was it created?
  updated_at TIMESTAMP             -- Last updated
);
```

## Edge Functions

### 1. `process-pending-reminder` (NEW)
**Purpose**: Called by client-side monitor every 1 minute for a specific reminder

**When it runs**: Every 1 minute (via client-side timer in the app)

**What it does**:
- Takes `bookingId` as input
- Checks if scheduled time has arrived
- If not time yet: Returns `"Not yet time to send"` with time remaining
- If time arrived: Sends OneSignal notification and marks `sent=true`
- If already sent: Returns `"Reminder already sent"`

**File**: `supabase/functions/process-pending-reminder/index.ts`

### 2. `be-alert-reminders` (BACKUP - Optional)
**Purpose**: Global backup cron job in case client monitor fails

**When it runs**: Every 1 minute via Supabase cron (optional)

**What it does**:
- Queries all pending reminders from `alert_reminders`
- Sends notifications for any that are due
- Marks them as sent

**File**: `supabase/functions/be-alert-reminders/index.ts`

**Note**: You can skip this if client-side monitor is reliable enough

## Setup Instructions

### Step 1: Create the Database Table

Go to **Supabase Dashboard** → **SQL Editor** and run:

```sql
-- Create table for alert reminders
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
ON alert_reminders(sent, scheduled_for) WHERE sent = FALSE;

CREATE INDEX IF NOT EXISTS idx_alert_reminders_user 
ON alert_reminders(user_id);

CREATE INDEX IF NOT EXISTS idx_alert_reminders_booking 
ON alert_reminders(booking_id);
```

**Verify**:
```sql
SELECT * FROM alert_reminders LIMIT 1;  -- Should show empty table (no error)
```

### Step 2: Deploy the Edge Functions

Deploy the new function:
```bash
supabase functions deploy process-pending-reminder
```

Or deploy all:
```bash
supabase functions deploy
```

### Step 3: (Optional) Set up Global Backup Cron

If you want a backup cron job (recommended for reliability):

1. Go to **Supabase Dashboard** → **Edge Functions**
2. Click on **be-alert-reminders**
3. Click **Schedule**
4. Set cron expression: `*/1 * * * *` (every 1 minute)
5. Name: "Be Alert Reminders Backup"
6. Save

This ensures even if client-side monitor fails, reminders still get sent.

## How to Test

### Test 1: Manual Booking with Reminder

1. Open the app and book an appointment
2. Set reminder for **3 minutes from now** (e.g., if current time is 14:30, set reminder for 14:33)
3. Watch browser console for logs:
   ```
   📝 Reminder saved to alert_reminders table
   ⏳ Starting reminder monitor - will check every 1 minute until sent
   🔄 Reminder monitor check #1 for booking xyz...
   ⏰ Time remaining: 2 minute(s)
   🔄 Reminder monitor check #2 for booking xyz...
   ⏰ Time remaining: 1 minute(s)
   🔄 Reminder monitor check #3 for booking xyz...
   ✅ Reminder successfully sent for booking xyz
   🛑 Reminder monitor stopped for booking xyz (checked 3 times)
   ```

### Test 2: Check Database

```sql
-- See all reminders
SELECT id, user_id, booking_id, shop_name, scheduled_for, sent, sent_at
FROM alert_reminders
ORDER BY created_at DESC;

-- Check pending reminders
SELECT COUNT(*) as pending
FROM alert_reminders
WHERE sent = FALSE AND scheduled_for <= NOW();

-- Check sent reminders
SELECT id, booking_id, scheduled_for, sent_at,
  EXTRACT(EPOCH FROM (sent_at - scheduled_for)) as delay_seconds
FROM alert_reminders
WHERE sent = TRUE
ORDER BY sent_at DESC
LIMIT 10;
```

### Test 3: Manual Function Test

```bash
# Test process-pending-reminder function
curl -X POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/process-pending-reminder \
  -H "Content-Type: application/json" \
  -d '{"bookingId": "your-booking-id-here"}'
```

## Troubleshooting

### Problem: Reminders not being saved to `alert_reminders`

**Checklist**:
1. ✅ Does `alert_reminders` table exist?
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_name = 'alert_reminders';
   ```

2. ✅ Check browser console for error messages
   - Look for: `❌ Error saving reminder to alert_reminders:`
   - Check network tab for failed requests

3. ✅ Check Supabase logs for permission errors
   - Dashboard → Logs → Functions

4. ✅ Verify `send-native-reminder-notification` function isn't being used
   - This is legacy - we use `process-pending-reminder` now

### Problem: Monitor started but not sending notifications

**Checklist**:
1. ✅ Is `process-pending-reminder` function deployed?
   ```bash
   supabase functions deploy process-pending-reminder
   ```

2. ✅ Check browser console for monitor messages
   - Should see `🔄 Reminder monitor check #X`
   - Should see time remaining countdown

3. ✅ Check OneSignal credentials in function
   - `ONESIGNAL_NATIVE_APP_ID` and `ONESIGNAL_NATIVE_API_KEY`

4. ✅ Verify user has set external_id in OneSignal
   - Function targets `include_aliases.external_id` with `[user_id]`

### Problem: Monitor checking but saying "Not yet time"

This is **normal**! The monitor will keep checking every minute until the scheduled time arrives. If it keeps saying "Not yet time" even after the scheduled time:

1. Check timezone calculation
   ```sql
   -- Check what time was stored as scheduled_for
   SELECT booking_id, reminder_time, scheduled_for, 
     now() as current_time,
     (scheduled_for - now()) as time_difference
   FROM alert_reminders
   WHERE booking_id = 'your-booking-id';
   ```

2. Verify `timezone_offset_hours` is correct
   - IST (India Standard Time) = UTC+5:30 = 5.5 hours

### Problem: Monitor keeps checking but never stops

**Possible causes**:
1. Notification sending failed but not caught
2. Database update failed after sending
3. OneSignal is rejecting the request silently

**Solution**:
1. Check Supabase Edge Function logs
2. Check OneSignal dashboard for bounce/failure reasons
3. Monitor has a max of 1440 checks (24 hours) then stops

## File Structure

### New Files Added:
```
supabase/functions/
  process-pending-reminder/
    index.ts              ← New: Per-reminder monitor
    
src/lib/
  reminder-monitor.ts    ← New: Client-side monitor logic
```

### Modified Files:
```
src/components/
  BookingModal.tsx       ← Updated: Calls startReminderMonitor
  
src/lib/
  supabase-reminders.ts  ← Updated: Uses alert_reminders
  onesignal-messaging.ts ← Added: Better logging
```

## Client-Side Monitor Behavior

### What Happens When User Closes App

The monitor is **client-side only**, so:
- If user closes the app **before reminder time**: Monitor stops
- The backup `be-alert-reminders` cron job will still catch it ✓
- Notification will still be sent by the cron job

**Important**: Always have `be-alert-reminders` running as backup!

### What Happens When User Navigates Away

The `stopAllReminderMonitors()` function is called when:
- User closes the booking modal
- User leaves the page

The backup cron job will still process the reminder if needed.

## Performance Notes

- **Client monitor**: Lightweight, only runs for reminders actively being monitored
- **Cron job check**: ~1 second per 10 reminders
- **Network requests**: One API call per minute per active reminder
- **Database queries**: Indexed for fast lookup

## Cost Considerations

Using this system:
- **Edge Function calls**: Low cost (cron + per-reminder checks)
- **Database queries**: Minimal (indexed lookups)
- **OneSignal**: Only pay for notifications sent
- **Overall**: Very cost-efficient

## API Response Examples

### When not yet time to send:
```json
{
  "success": true,
  "message": "Not yet time to send",
  "reminderId": "abc-123",
  "timeRemaining": 120000  // ms until send time
}
```

### When reminder sent:
```json
{
  "success": true,
  "message": "Reminder sent and marked as complete",
  "reminderId": "abc-123",
  "bookingId": "booking-456"
}
```

### When already sent:
```json
{
  "success": true,
  "message": "Reminder already sent",
  "reminderId": "abc-123"
}
```

## Next Steps Checklist

- [ ] Create `alert_reminders` table in Supabase
- [ ] Deploy `process-pending-reminder` function
- [ ] (Optional) Schedule `be-alert-reminders` as backup cron
- [ ] Test with a booking
- [ ] Monitor browser console logs
- [ ] Verify notifications are received
- [ ] Check database for `sent = true`

## Support & Debugging

### Enable Detailed Logging

In browser console:
```javascript
// Check if monitors are running
import { getMonitorStatus } from '@/lib/reminder-monitor';
getMonitorStatus('your-booking-id');
// Output: { bookingId: '...', attempts: 5, isRunning: true, maxAttempts: 1440 }
```

### Common Log Messages

| Log | Meaning |
|-----|---------|
| `📝 Reminder saved to alert_reminders table` | ✅ Reminder successfully saved |
| `⏳ Starting reminder monitor` | ✅ Monitor started |
| `🔄 Reminder monitor check #X` | ℹ️ Periodic check happening |
| `⏳ Time remaining: X minute(s)` | ℹ️ Waiting for scheduled time |
| `✅ Reminder successfully sent` | ✅ Notification sent |
| `🛑 Reminder monitor stopped` | ✅ Monitor stopped after success |
| `❌ Error saving reminder to alert_reminders` | ❌ Database save failed |
| `⚠️ Check failed on attempt #X` | ⚠️ Network error (will retry) |
