# Reminder Notification Enhancement - 3x Notifications with Intervals

## Overview
Updated the reminder notification system to send **3 notifications** with **10-second intervals** between each, ensuring users receive multiple alerts to take attention of important appointment reminders.

## Changes Made

### 1. **send-scheduled-reminder-notification** (`supabase/functions/send-scheduled-reminder-notification/index.ts`)
- Modified to send 3 notifications instead of 1
- Each notification is sent with a 10-second interval using `send_after` parameter
- **Timeline**: 
  - Notification 1: scheduled time
  - Notification 2: scheduled time + 10 seconds
  - Notification 3: scheduled time + 20 seconds

### 2. **send-native-reminder-notification** (`supabase/functions/send-native-reminder-notification/index.ts`)
- Modified to send 3 notifications for native app users (Android/iOS)
- Each notification sent with 10-second intervals
- Maintains separate API calls for reliability tracking

### 3. **process-pending-reminder** (`supabase/functions/process-pending-reminder/index.ts`)
- Updated to send 3 notifications when reminder time is reached
- First notification sent immediately
- 2nd and 3rd notifications scheduled using `send_after` with 10-second delays
- Better error tracking for multi-notification sends

### 4. **be-alert-reminders** (`supabase/functions/be-alert-reminders/index.ts`)
- Enhanced to send 3 notifications per reminder during cron job execution
- Tracks success count for each notification batch
- Improved logging for debugging multi-notification sends

## Priority & Importance Settings

All notification functions now include **MAXIMUM priority settings**:

### Android Configuration
```typescript
android_importance: 5,      // MAXIMUM (5) - Heads-up notification with sound/vibration
android_priority: 10,       // MAXIMUM (10) - For older Android versions
android_sound: "default",   // Or custom sound URL
big_picture: true,          // Larger, more prominent display
```

### iOS Configuration
```typescript
ios_sound: "default",
ios_badged: true,
ios_critical_sound: true,   // NEW: Critical notification sound
```

### Web Configuration
```typescript
isWebPush: true,
big_picture: true,          // More prominent display
```

## Key Features

✅ **Triple Notifications**: Users receive 3 consecutive notifications with 10-second intervals
✅ **Deduplication Prevention**: Each notification has unique ID and distinct heading to prevent OneSignal merging
✅ **High Priority**: Android importance level set to MAXIMUM (5)
✅ **High Urgency**: Android priority set to MAXIMUM (10)
✅ **Critical Sound**: iOS critical notification sound enabled
✅ **Reliable Delivery**: Independent API calls for each notification
✅ **Error Tracking**: Detailed logging of each notification send success/failure
✅ **Backward Compatible**: Works with both web and native devices
✅ **Clear Sequence Tracking**: Each notification shows its position (1/3, 2/3, 3/3)

## Implementation Details

### Multi-Notification Loop
```typescript
for (let i = 0; i < notificationCount; i++) {
  const payload = { ...basePayload };
  
  if (sendAfterTimestamp) {
    payload.send_after = sendAfterTimestamp + (notificationIntervalSeconds * i);
  }
  
  // Send the notification to OneSignal
  // Track success/failure
}
```

### Success Tracking
Each function now returns detailed results:
```json
{
  "success": true,
  "message": "3/3 reminder notifications sent successfully",
  "details": [
    { "notificationNumber": 1, "success": true },
    { "notificationNumber": 2, "success": true },
    { "notificationNumber": 3, "success": true }
  ]
}
```

## Notification Timeline

**Example for a 2:00 PM reminder:**

| Time | Event | Notification Title |
|------|-------|-------------------|
| 2:00:00 PM | Notification 1 sent | 🔔 Appointment Reminder |
| 2:00:10 PM | Notification 2 sent | ⏰ Appointment Reminder (Final Call) |
| 2:00:20 PM | Notification 3 sent | 🚨 Last Reminder - Your Appointment Now! |

User receives **3 distinct notifications** with escalating urgency within a 20-second window.

### Important Notes:
- **Congratulation notification** is sent separately when the booking is confirmed
- **Reminder notifications** only start at the scheduled time (e.g., 9:00 PM)
- Each notification has a unique title, ID, and sequence identifier to prevent OneSignal deduplication
- The data payload includes `notificationSequence` (e.g., "1/3") and `reminderIndex` for tracking

## Understanding the Notification Flow

### Two Different Notification Types:

**1. Congratulation/Confirmation Notification** (Immediate)
- Sent **immediately** when booking is confirmed
- Only sent **once** when user completes the booking
- Shows booking confirmation and token details
- Purpose: Confirm booking was successful

**2. Reminder Notifications** (Scheduled)
- Sent **only at the scheduled reminder time** (e.g., 9:00 PM)
- Sent **3 times with 10-second intervals**:
  - 1st: "🔔 Appointment Reminder" at 9:00:00 PM
  - 2nd: "⏰ Appointment Reminder (Final Call)" at 9:00:10 PM
  - 3rd: "🚨 Last Reminder - Your Appointment Now!" at 9:00:20 PM
- Purpose: Get user's attention before appointment

### Deduplication Prevention

To ensure OneSignal sends all **3 notifications as distinct, separate notifications** (not merged), we use:
- **Unique IDs**: Each notification has a unique `id` field: `{bookingId}-seq-{1|2|3}`
- **Unique Titles**: Each notification has a different heading to make them visually distinct
- **Sequence Tracking**: Data payload includes `notificationSequence` and `reminderIndex` for app-level tracking

## Testing Notes

To test the enhanced notification system:

1. **Book a token** with a reminder time (e.g., 2 minutes from now)
   - You'll see a **congratulation notification immediately**
   - This is separate from the reminder notifications

2. **Wait for scheduled reminder time**
   - You should receive **3 distinct notifications** at 10-second intervals:
     - 1st: "🔔 Appointment Reminder"
     - 2nd: "⏰ Appointment Reminder (Final Call)"
     - 3rd: "🚨 Last Reminder - Your Appointment Now!"

3. **Check notification details**:
   - Each notification should have different text
   - They should appear 10 seconds apart
   - Check OneSignal logs for all 3 API calls with unique IDs

4. **Verify priority** - Notifications should appear as heads-up notifications on Android

5. **Check sounds/vibrations** - Critical sound should be enabled with MAXIMUM importance

## Configuration

The system uses these constants:
- **Notification Interval**: 10 seconds (configurable in `notificationIntervalSeconds`)
- **Notification Count**: 3 (configurable in `notificationCount`)

To change these values, update:
- `const notificationIntervalSeconds = 10;`
- `const notificationCount = 3;`

in the respective functions.

## Backward Compatibility

✅ All changes are backward compatible
✅ Existing reminder system continues to work as expected
✅ Database schema unchanged
✅ OneSignal API version unchanged

## Notes

- OneSignal batches identical notifications, so spacing them with `send_after` ensures each is sent separately
- First notification can be sent immediately while subsequent ones are scheduled
- All 3 notifications share the same action data for consistent user experience
- If any notification fails to send, others are still attempted (fail-fast not used)

## Future Enhancements

Potential improvements:
- Make notification count and interval user-configurable
- Different sounds for each notification (escalating alert pattern)
- User preferences for notification frequency
- A/B testing for optimal interval timing
