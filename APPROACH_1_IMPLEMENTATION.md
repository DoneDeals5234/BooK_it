# Approach 1: Permission + Always Active - Implementation Guide

## Overview

**Approach 1** requires explicit permission from shop owners during onboarding or settings. Once permission is granted, the system automatically starts the foreground service on the owner's device when customers book appointments.

### Key Differences from Approach 3

| Aspect | Approach 3 | Approach 1 |
|--------|-----------|-----------|
| Permission Required | ❌ No | ✅ Yes, explicit grant |
| Starts Service On | Customer's device | **Owner's device only** |
| Service Trigger | Automatic for all owners | Only if permission granted |
| Battery Impact | Affects customer | Affects owner only |
| User Control | System decides | Owner decides |

## Architecture Flow

```
ONBOARDING/SETTINGS PHASE:
Owner logs in → Sees permission grant screen → Owner grants permission
              → Permission saved to native_shop_owners table

BOOKING PHASE:
Customer selects time → Clicks "Next" → Creates booking_request
                     ↓
                Fetch native shop owners for shop
                     ↓
                Check permission status for each owner (via Edge Function)
                     ↓
                Send notification ONLY to authorized owners (those with permission)
                     ↓
          Owner's device receives notification with special type
                     ↓
Owner's app checks: "Is current user the shop owner?" + "Has permission been granted?"
                     ↓
              YES → Automatically start foreground service
              NO → Notification ignored (or shown as regular notification)
                     ↓
          Foreground service monitors appointment time
                     ↓
         Owner receives automatic reminders/alarms
```

## Files Created/Modified

### 1. **NEW: Permission Management Library**
**File:** `src/lib/owner-permissions.ts`

Functions:
- `checkOwnerForegroundServicePermission(userId, shopId)` - Check if owner has permission
- `setOwnerForegroundServicePermission(userId, shopId, hasPermission)` - Grant/revoke permission
- `getAuthorizedOwnersByShopId(shopId)` - Get all authorized owners for a shop

### 2. **NEW: Permission UI Component**
**File:** `src/components/OwnerForegroundServicePermission.tsx`

- React component for granting/revoking permission
- Shows what the service does
- Displays current permission status
- Can be used in onboarding or settings
- Provides clear feedback to owner

### 3. **MODIFIED: Supabase Edge Function**
**File:** `supabase/functions/trigger-owner-foreground-service/index.ts`

Changes:
- Checks permission status for each owner BEFORE sending notification
- Only fetches player IDs for authorized owners
- Sends notification ONLY to owners with permission granted
- Returns count of authorized vs. unauthorized owners

### 4. **MODIFIED: Notification Handler**
**File:** `src/lib/capacitor-notifications.ts`

Function: `handleForegroundServiceTrigger(data)`
- Gets current logged-in user
- Checks if current user is the shop owner (verification)
- Calls `checkOwnerForegroundServicePermission()` to verify permission
- Only starts foreground service if BOTH conditions are true:
  - Current user is the owner
  - Permission has been granted
- Prevents customer devices from starting the service

### 5. **Database Migration**
**File:** `supabase/migrations/add_foreground_service_permission.sql`

- Adds `auto_start_foreground_service` column to `native_shop_owners` table
- Column defaults to `false` (no permission)
- Creates index for fast permission lookups

### 6. **MODIFIED: Booking Flow**
**File:** `src/components/ProductionBooking/CustomerTimeSlotSelection.tsx`

- Unchanged calling sequence - still calls `triggerOwnerForegroundService()`
- Backend now handles permission checking
- Only authorized owners receive the trigger notification

## Step-by-Step Implementation

### Step 1: Database Setup
Run the migration to add the permission column:
```sql
ALTER TABLE native_shop_owners
ADD COLUMN IF NOT EXISTS auto_start_foreground_service BOOLEAN DEFAULT false;
```

### Step 2: Owner Onboarding/Settings
Add the permission component to your onboarding flow:

```tsx
import { OwnerForegroundServicePermission } from '@/components/OwnerForegroundServicePermission';

// In your onboarding or settings page:
<OwnerForegroundServicePermission 
  shopId={shop.id}
  shopName={shop.name}
  onPermissionChange={(hasPermission) => {
    console.log('Permission updated:', hasPermission);
  }}
/>
```

The component will:
- Display a clear explanation of what will happen
- Show current permission status
- Allow owner to grant/revoke permission
- Provide visual feedback and toast notifications

### Step 3: Customer Booking
No changes needed - the existing booking flow will work:
1. Customer selects time and clicks "Next"
2. Backend checks which owners have permission
3. Sends notification only to authorized owners
4. Only authorized owners' devices will auto-start the service

### Step 4: Owner's Device
When owner's device receives the notification:
1. Capacitor notification handler intercepts it
2. Checks if current user is the owner
3. Checks if permission is granted
4. Auto-starts foreground service if both conditions are true

## Security & Privacy

✅ **Owner Control** - Owners explicitly choose to enable this feature  
✅ **Device Verification** - Notification only auto-triggers on owner's logged-in device  
✅ **Permission Checking** - Double-verification (auth check + permission flag)  
✅ **No Forced Permissions** - Owners can revoke anytime  
✅ **Audit Trail** - All permission changes are logged via Supabase timestamps  

## Data Flow

### Permission Storage
```
native_shop_owners table:
├── id
├── user_id (owner's user ID)
├── shop_id
├── auto_start_foreground_service ← NEW COLUMN
├── created_at
└── updated_at
```

### Notification Data Structure
```javascript
{
  type: "start_foreground_service",
  action: "start_service_for_booking",
  bookingRequestId: "...",
  customerName: "...",
  serviceName: "...",
  timeSlot: "...",
  shopId: "...",  // Used to verify owner
  triggerType: "booking_request"
}
```

## Testing the Implementation

### Test Scenario 1: Owner Without Permission
1. Owner logs in (permission = false by default)
2. Customer books appointment
3. Owner receives notification but foreground service does NOT start
4. ✅ Expected: No service started

### Test Scenario 2: Owner Grants Permission
1. Owner grants permission in settings
2. `auto_start_foreground_service` is set to `true`
3. Customer books appointment
4. Owner receives notification
5. Foreground service automatically starts
6. ✅ Expected: Service starts on owner's device only

### Test Scenario 3: Customer Receives Notification
1. If by mistake a notification goes to customer
2. Customer's app checks permission
3. Customer is NOT the owner
4. Service does NOT start on customer's device
5. ✅ Expected: No service started on customer device

### Test Scenario 4: Permission Revoked
1. Owner revokes permission
2. `auto_start_foreground_service` is set to `false`
3. Customer books appointment
4. Owner receives notification but service does NOT auto-start
5. ✅ Expected: No service started

## Console Logs to Monitor

### When Permission Check Passes:
```
🔐 Checking foreground service permission for user: user-123, shop: shop-456
🔐 Permission status: ✅ GRANTED
👤 Current user: user-123
📍 Shop ID from notification: shop-456
✅ Owner verified - permission granted - starting foreground service...
⏰ Starting ForegroundAlarmService
✅ ForegroundAlarmService started
```

### When Permission Check Fails:
```
🔐 Checking foreground service permission for user: user-123, shop: shop-456
🔐 Permission status: ❌ DENIED
🚫 Current user is not the authorized owner OR permission not granted
```

### Backend Permission Check:
```
🔐 Checking owner permissions for automatic foreground service...
✅ Found X authorized owner(s) with permission
🔍 Fetching player IDs for authorized owner users...
📱 Found X native device(s) for authorized owner(s)
📡 Sending foreground service trigger to OneSignal...
✅ Foreground service trigger sent successfully
```

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Service not starting on owner device | Permission not granted | Check `native_shop_owners.auto_start_foreground_service` is `true` |
| Service starting on customer device | Wrong device checking | Verify auth user check in `handleForegroundServiceTrigger()` |
| Permission not saving | Database column missing | Run migration to add `auto_start_foreground_service` column |
| Notification not reaching owner | Owner not in authorized list | Check if permission was actually granted |
| Service starts without permission | Logic error | Review the three checks: (1) auth, (2) permission, (3) notification data |

## Implementation Checklist

### Setup Phase
- [ ] Run database migration to add `auto_start_foreground_service` column
- [ ] Deploy Supabase Edge Function with permission checking
- [ ] Add `owner-permissions.ts` library to project
- [ ] Add `OwnerForegroundServicePermission.tsx` component
- [ ] Update capacitor-notifications.ts to check permission and user

### Integration Phase
- [ ] Add permission component to onboarding flow
- [ ] Add permission component to owner settings page
- [ ] Test permission grant/revoke in UI
- [ ] Test permission saves to database
- [ ] Verify permission is checked before service start

### Testing Phase
- [ ] Test scenario: Owner without permission (should NOT start)
- [ ] Test scenario: Owner grants permission (SHOULD start)
- [ ] Test scenario: Customer gets notification (should NOT start)
- [ ] Test scenario: Wrong user logged in (should NOT start)
- [ ] Test scenario: Owner revokes permission (should NOT start)
- [ ] Monitor console logs for permission checks

### Deployment Phase
- [ ] Deploy database migration to production
- [ ] Deploy Edge Function update
- [ ] Deploy frontend code with permission checks
- [ ] Monitor logs for permission-related errors
- [ ] Communicate feature to owners

## Advantages of Approach 1

✅ **Owner Explicit Consent** - Owners know exactly what will happen  
✅ **Respects Battery** - Owner controls when service runs  
✅ **Device Specific** - Only starts on owner's own device  
✅ **Compliance** - Follows user consent principles  
✅ **Trust** - Builds confidence in the system  
✅ **Flexibility** - Owner can revoke anytime  
✅ **Privacy** - No forced permissions or background services  

## Future Enhancements

1. **Permission Tiers** - Different levels of service (silent/with notifications/with sound)
2. **Scheduled Permissions** - Grant permission for specific time windows
3. **Conditional Permissions** - Only during business hours
4. **Audit Logging** - Track who granted/revoked and when
5. **Permission Analytics** - See adoption rate among owners
6. **Batch Permission** - Grant for multiple shops at once

## Implementation Status

✅ Permission library created (`owner-permissions.ts`)  
✅ Permission UI component created (`OwnerForegroundServicePermission.tsx`)  
✅ Edge Function updated with permission checks  
✅ Notification handler updated to verify owner and permission  
✅ Database migration created  
✅ Documentation complete  

**Next Steps:**
1. Run database migration in your Supabase project
2. Deploy the Edge Function update
3. Integrate permission component into onboarding/settings
4. Test with real devices
5. Monitor adoption and adjust as needed
