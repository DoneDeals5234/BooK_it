# Reminder Notification Fix - Comprehensive Guide

## Problem Summary

Users reported that reminder notifications scheduled via the booking modal were not firing at the specified time on native Android devices. The system was showing success messages, but the notifications never arrived on the device.

### Root Causes Identified:

1. **OneSignal Scheduling Limitations**: OneSignal's `send_after` parameter doesn't reliably work with External IDs on native devices, especially when the device's player ID is not fully registered.

2. **Device Registration Issues**: The logs showed "Player ID is null for user: XXX - Account not fully registered yet", indicating the device wasn't properly registered with OneSignal.

3. **Timezone Calculation Issues**: While the timezone conversion logic was mostly correct, it could have edge cases.

4. **No Local Fallback**: There was no local mechanism to ensure reminders fire if the server-side scheduling fails.

## Solution Implemented

### 1. Local Reminder Scheduler (`src/lib/local-reminders.ts`)

A new local storage-based reminder system that:
- **Stores reminders locally** with exact firing timestamps
- **Monitors reminders periodically** (every 60 seconds) to check if any are ready to send
- **Sends notifications automatically** when the time arrives, even if OneSignal scheduling fails
- **Provides fallback mechanism** for both native and web platforms

**Key Features:**
- Persistent storage using browser's localStorage
- Automatic cleanup of old reminders (>7 days)
- Debugging utilities to view reminder stats
- Non-intrusive monitoring that doesn't block the app

### 2. Dual Scheduling Approach

The booking flow now uses **both** OneSignal server-side scheduling AND local storage:

```
User Submits Booking
    ↓
Save reminder locally (local-reminders.ts)
    ↓
Send to OneSignal for server-side scheduling
    ↓
OneSignal sends notification at scheduled time
    ↓
If OneSignal fails, local scheduler catches it and sends anyway
```

### 3. Timezone Calculation Fix

**Supabase Functions Updated:**
- `send-native-reminder-notification/index.ts`
- `send-scheduled-reminder-notification/index.ts`

**Improvements:**
- Uses UTC date objects for consistent timezone handling
- Properly handles day wrapping when reminder is before midnight
- Better logging for debugging timezone issues
- Validates that reminder time is in the future

**Formula:**
```typescript
// Create UTC date from user input
const utcDate = new Date(Date.UTC(year, month-1, day, hour, minute, 0));
// Convert to UTC by subtracting timezone offset
const utcTimeMs = utcDate.getTime() - (timezoneOffsetHours * 60 * 60 * 1000);
```

### 4. Reminder Validation (`src/components/BookingModal.tsx`)

Added client-side validation that:
- Ensures reminder time is before the booking time
- Validates that reminder is not more than 1 day before booking
- Auto-suggests reminder time (15 minutes before appointment)
- Provides clear error messages for invalid times
- Shows booking time context in the reminder selection UI

### 5. Monitor Initialization

The local reminder monitor is initialized in `setupReminderNotificationHandler()`:
- Called once when the app loads
- Checks for pending reminders immediately
- Runs periodic checks every 60 seconds
- Integrates with existing OneSignal listener setup

## How It Works

### User Flow:

1. **User books appointment** and selects a reminder time
2. **Validation checks** that reminder time is valid
3. **Booking saved** to Supabase
4. **Reminder saved locally** in browser storage with exact UTC timestamp
5. **OneSignal notification scheduled** for server-side delivery
6. **At scheduled time:**
   - OneSignal sends notification (if player ID is registered) ✓
   - Local scheduler checks and sends if OneSignal fails ✓✓

### Local Reminder Monitor:

```typescript
// Monitor runs every 60 seconds
every 60 seconds:
  1. Get all pending reminders from localStorage
  2. Check if current time >= reminder time
  3. For each ready reminder:
     - Send notification to user
     - Mark as sent
     - Delete from pending list
```

## Configuration & Debugging

### Check Reminder Stats:

```javascript
// In browser console:
import { getReminderStats } from '@/lib/local-reminders';
getReminderStats();
// Output:
// {
//   total: 5,
//   pending: 2,
//   upcoming: 3,
//   sent: 0,
//   oldestUnsent: { ... }
// }
```

### View All Reminders:

```javascript
import { getAllReminders } from '@/lib/local-reminders';
const reminders = getAllReminders();
reminders.forEach(r => {
  console.log(`${r.bookingId}: ${new Date(r.scheduledForTimestamp * 1000)}`);
});
```

### Test Local Reminder:

```javascript
// Schedule a test reminder for 1 minute from now
import { saveReminderLocally } from '@/lib/local-reminders';

const now = new Date();
const reminderTime = new Date(now.getTime() + 60000); // 1 minute from now

saveReminderLocally(
  'test-user',
  'test-booking-' + Date.now(),
  `${reminderTime.getHours()}:${String(reminderTime.getMinutes()).padStart(2, '0')}`,
  new Date().toISOString().split('T')[0],
  'Test Shop',
  999,
  'Test User',
  '15:00',
  'test-shop',
  0 // no timezone offset for testing
);
```

## Console Logs for Debugging

### When reminder is scheduled:
```
📤 Scheduling reminder notification for 14:30...
📍 User timezone offset: UTC+5.5
💾 Reminder also saved locally as fallback
📤 Sending native reminder notification...
✅ Reminder notification scheduled successfully
```

### When reminder fires (OneSignal):
```
⏰ Sending reminder via OneSignal...
✅ Notification sent successfully
```

### When reminder fires (Local Scheduler):
```
🔔 Found 1 reminder(s) ready to send
⏰ Sending reminder: booking-123 at [exact time]
⏰ Local reminder is ready to send: booking-123
🔔 Sending local reminder notification: booking-123
✅ Local reminder sent successfully
```

## Testing Checklist

- [ ] **Create a booking** with reminder time set to 5-10 minutes from now
- [ ] **Check local storage** - verify reminder is stored
- [ ] **Wait for reminder time** and check if notification appears
- [ ] **Test with app closed** - kill the app and see if reminder still fires
- [ ] **Test timezone conversion** by booking from different timezones
- [ ] **Test validation** - try invalid reminder times and verify error messages
- [ ] **Check console logs** for any errors or warnings
- [ ] **Verify player ID** is being saved to native_devices table

## Database Requirements

### Required Table: `native_devices`
```sql
- player_id (string) - OneSignal player ID
- user_id (string) - Firebase user ID
- created_at (timestamp)
```

The system stores player IDs when:
1. User allows notifications (OneSignal subscription event)
2. User logs in with pending player ID

## Fallback Mechanism Priority

When a reminder is scheduled:

1. **Primary**: OneSignal server-side scheduling with `send_after`
   - Works best when player ID is registered
   - Most reliable for push notifications

2. **Secondary**: Local reminder monitor
   - Runs every 60 seconds
   - Catches failures from OneSignal
   - Always accessible when app opens

3. **Tertiary**: Browser localStorage
   - Persists reminders across app restarts
   - Survives app updates and cache clears

## Known Limitations

- Local reminders only work if the device has the app installed
- App must be opened at least once every 60 seconds for local scheduler to check
- Timezone offset is captured at booking time (not real-time)
- One-time DST changes might affect reminders scheduled far in the future

## Future Improvements

1. **Background Task Integration**: Use Capacitor Background Task for continuous monitoring
2. **Service Worker**: For web platform to handle reminders without app open
3. **Push Service Integration**: Direct integration with Firebase Cloud Messaging
4. **Analytics**: Track reminder delivery success rates
5. **User Preferences**: Allow users to set multiple reminders

## Files Modified

1. **New Files:**
   - `src/lib/local-reminders.ts` - Local reminder storage and scheduler

2. **Modified Files:**
   - `src/lib/onesignal-messaging.ts` - Enhanced scheduling with local fallback
   - `src/components/BookingModal.tsx` - Added validation and auto-suggestions
   - `supabase/functions/send-native-reminder-notification/index.ts` - Fixed timezone calc
   - `supabase/functions/send-scheduled-reminder-notification/index.ts` - Fixed timezone calc

## Rollback Instructions

If you need to revert these changes:

```bash
# Revert to previous state
git checkout HEAD~1 -- src/lib/onesignal-messaging.ts
git checkout HEAD~1 -- src/components/BookingModal.tsx
git rm src/lib/local-reminders.ts
# Revert Supabase functions separately through Supabase dashboard
```

## Support & Debugging

If reminders still don't work:

1. **Check browser console** for errors
2. **Verify localStorage** has reminder entries
3. **Check OneSignal player ID** is registered (look in browser DevTools)
4. **Verify timezone offset** is correct in logs
5. **Check notification permissions** are granted
6. **Review Supabase function logs** for scheduling errors
7. **Test on emulator** to ensure native environment is working

## References

- OneSignal Documentation: https://documentation.onesignal.com/
- Capacitor Background Task: https://capacitorjs.com/docs/apis/background-task
- Firebase Cloud Messaging: https://firebase.google.com/docs/cloud-messaging
