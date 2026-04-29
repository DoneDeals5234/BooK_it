# Quick Reference Guide - Booking Flow Implementation

## What Was Implemented

A complete booking flow with confirmation via foreground service:
1. User books appointment → 2. Selects reminder times → 3. Foreground service shows reminder at appointment time → 4. User confirms/cancels via Yes/No buttons → 5. Owner gets notified

## Files to Know

### Frontend Components
```
src/components/ProductionBooking/
├── ProductionBookingFlow.tsx         (Main booking negotiation flow)
├── ReminderSettings.tsx              (⭐ MODIFIED - Now starts foreground service)
├── CustomerTimeSlotSelection.tsx     (Time slot selection)
├── OwnerBookingNotification.tsx      (Owner receives request)
└── ... other booking flow components
```

### Backend Services
```
src/lib/
├── booking-negotiation-notifications.ts  (⭐ EXTENDED - New notification functions)
├── foreground-service-handlers.ts         (⭐ NEW - Handle Yes/No responses)
├── alarm-scheduler.ts                    (Calls native AlarmBridge)
├── supabase-bookings.ts                  (Booking CRUD)
└── onesignal-messaging.ts                (OneSignal notifications)
```

### Database
```
supabase/
├── migrations/
│   ├── create_bookings_table.sql
│   └── 20250211_extend_bookings_for_foreground_service.sql  (⭐ NEW - Adds columns)
└── functions/
    ├── handle-booking-confirmation/index.ts  (⭐ NEW - Edge function)
    └── ... other functions
```

## Key Functions

### Starting Foreground Service
**In:** `src/components/ProductionBooking/ReminderSettings.tsx`
```typescript
const foregroundResult = await startForegroundAlarmService({
  bookingId,
  tokenNumber,
  shopName,
  timeSlot: bookingTime,
  triggerTimeMs, // When to show reminder
});
```

### Handling Customer Confirmation (Yes)
**In:** `src/lib/foreground-service-handlers.ts`
```typescript
export const handleForegroundServiceConfirmation = async (bookingId: string) => {
  // 1. Update booking.customer_confirmation = 'confirmed'
  // 2. Notify owner with notification
  // 3. Return success/failure
}
```

### Handling Customer Cancellation (No)
**In:** `src/lib/foreground-service-handlers.ts`
```typescript
export const handleForegroundServiceCancellation = async (bookingId: string) => {
  // 1. Update booking.customer_confirmation = 'cancelled'
  // 2. Notify owner with cancellation notification
  // 3. Delete booking from active list
  // 4. Return success/failure
}
```

### Notify Owner
**In:** `src/lib/booking-negotiation-notifications.ts`
```typescript
// When customer confirms
await notifyOwnerCustomerConfirmed({
  ownerId,
  customerName,
  serviceName,
  bookingTime,
  tokenNumber,
  bookingId,
  shopId,
});

// When customer cancels
await notifyOwnerCustomerCancelled({
  ownerId,
  customerName,
  serviceName,
  bookingTime,
  tokenNumber,
  bookingId,
  shopId,
});
```

## Database Changes

### New Columns in `bookings` Table
```sql
reminder_time TEXT
customer_confirmation TEXT DEFAULT 'pending'  -- pending, confirmed, cancelled
foreground_service_status TEXT DEFAULT 'not_started'  -- not_started, running, completed
customer_confirmed_at TIMESTAMP WITH TIME ZONE
owner_notified_confirmation BOOLEAN DEFAULT false
```

### New Indexes
```sql
idx_bookings_pending_confirmations
idx_bookings_foreground_service
```

## API Endpoints

### Handle Booking Confirmation (Edge Function)
```
POST /functions/v1/handle-booking-confirmation
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json

{
  "booking_id": "uuid",
  "action": "confirmed" | "cancelled"
}

Response: {
  "success": true,
  "message": "Booking confirmed - owner notified",
  "booking_id": "uuid",
  "status": "confirmed"
}
```

## Data Flow

```
User Confirms Booking
        ↓
ReminderSettings shows reminder options
        ↓
User selects reminders (or skips)
        ↓
startForegroundAlarmService({
  bookingId: 'abc123',
  tokenNumber: 456,
  shopName: 'Elite Barbershop',
  timeSlot: '10:30 AM',
  triggerTimeMs: 1707552600000
})
        ↓
Native code waits for triggerTimeMs
        ↓
At appointment time, show notification with Yes/No buttons
        ↓
User taps Yes/No
        ↓
Native code calls JavaScript:
processForegroundServiceResponse(
  'abc123',  // bookingId
  'confirmed' | 'cancelled'
)
        ↓
handleForegroundServiceConfirmation()
or
handleForegroundServiceCancellation()
        ↓
Update booking.customer_confirmation
        ↓
Send notification to owner
```

## Testing the Flow

### Manual Test Steps
1. Create a booking and confirm it
2. Select reminder times (or skip)
3. Check browser console for foreground service logs
4. When appointment time arrives (or use test alarm):
   - Foreground service notification should appear
   - Should have Yes/No buttons
5. Tap Yes or No
6. Check that:
   - Booking status updates
   - Owner receives notification
   - Console shows success message

### Check Database Status
```sql
-- Check booking confirmation status
SELECT customer_confirmation, foreground_service_status, reminder_time
FROM bookings
WHERE id = 'booking-id';

-- Should show:
-- customer_confirmation: 'pending' → 'confirmed' or 'cancelled'
-- foreground_service_status: 'running' → 'completed'
-- reminder_time: 'HH:MM' (first reminder time)
```

## Android Native Implementation Checklist

- [ ] Create `ForegroundAlarmService.java` class
- [ ] Create `ConfirmationReceiver.java` broadcast receiver
- [ ] Register service and receiver in `AndroidManifest.xml`
- [ ] Add required permissions to manifest
- [ ] Implement `AlarmBridge` JavaScript interface
- [ ] Create notification with Yes/No buttons
- [ ] Handle Yes button → call `processForegroundServiceResponse(bookingId, 'confirmed')`
- [ ] Handle No button → call `processForegroundServiceResponse(bookingId, 'cancelled')`
- [ ] Play notification sound/vibration
- [ ] Add service to foregroundServiceType reminder

See `FOREGROUND_SERVICE_IMPLEMENTATION.md` for complete Android code.

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Foreground service doesn't start | AlarmBridge not available | Check Capacitor/native setup |
| Notification doesn't ring | Device in DND mode | Show as high-priority notification |
| Owner doesn't get notified | OneSignal external_id not set | Verify owner has setOneSignalUserIdTag() called |
| Yes/No buttons don't work | JavaScript bridge not connected | Implement callback in native code |
| Foreground service shows but no buttons | Notification not built correctly | Use NotificationCompat.Builder with addAction() |

## Notification Content

### Foreground Service Notification
**Title:** "Are you ready? 🔔"
**Text:** "Token #123 - Elite Barbershop at 10:30 AM"
**Buttons:** 
- "Yes, I'm Ready" → confirms booking
- "No, Cancel" → cancels booking

### Owner Confirmation Notification
**Title:** "✅ Customer Confirmed"
**Text:** "John confirmed they're coming! Token #123 will arrive at 10:30 AM"

### Owner Cancellation Notification
**Title:** "❌ Customer Cancelled"
**Text:** "John cancelled their booking for Haircut at 10:30 AM"

## Environment Variables

Existing variables used:
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
ONESIGNAL_NATIVE_APP_ID
ONESIGNAL_NATIVE_API_KEY
```

No new environment variables needed - uses existing OneSignal setup.

## Backward Compatibility

✅ Fully backward compatible
- Web users without foreground service can still book
- Existing OneSignal reminders still work
- Booking flow works on all platforms
- Foreground service is Android-only, gracefully degrades on other platforms

## Architecture Diagram

```
┌─────────────────────┐
│    Booking Flow     │
│  (Product. Booking) │
└──────────┬──────────┘
           │
           ↓
┌──────────────────────────┐
│   Reminder Settings      │
│ (Select reminder times)  │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────────────┐
│  Start Foreground Service        │
│  window.AlarmBridge.start...()   │
└──────────┬───────────────────────┘
           │
           ↓
┌──────────────────────────────────┐
│   Native: ForegroundService      │
│  (Wait for trigger time)         │
└──────────┬───────────────────────┘
           │
           ↓
┌──────────────────────────────────┐
│  Show Notification + Yes/No       │
└──────────┬───────────────────────┘
           │
      ┌────┴─────┐
      ↓          ↓
    YES         NO
      │          │
      ↓          ↓
┌─────────┐  ┌──────────┐
│Confirmed│  │Cancelled │
└────┬────┘  └────┬─────┘
     │            │
     └────┬───────┘
          ↓
 Update booking status
 Send notification to owner
```

## Performance Notes

- Foreground service is lightweight
- Minimal battery impact (wakes device at scheduled time only)
- OneSignal notifications are sent in batches
- Database queries are indexed for fast lookups
- No polling required (uses AlarmManager)

## Security

- All requests require JWT authentication
- Owner ID verified from database (not client-provided)
- Booking ownership verified before updating
- All notifications signed with OneSignal API key
- Timestamps prevent replay attacks

---

**Need more details?**
- Implementation details: See `BOOKING_FLOW_IMPLEMENTATION_SUMMARY.md`
- Android code examples: See `FOREGROUND_SERVICE_IMPLEMENTATION.md`
- Component code: Check individual component files in `src/components/ProductionBooking/`
