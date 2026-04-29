# Shop Open/Close Feature with Automatic Foreground Service

## Overview

This feature enhances **Approach 1 (Permission + Always Active)** by linking the shop's open/close status to the foreground service. 

**Key Concept:** When the shop owner opens their shop, the foreground service automatically becomes enabled. When they close the shop, the service is automatically disabled.

### How It Works

```
Shop Owner Action:
└─ Opens Shop in BarberPortal
   ├─ Shop status: isOpen = true
   └─ Foreground service: auto_start_foreground_service = true
      └─ Service will run and monitor appointments
      
Shop Owner Action:
└─ Closes Shop in BarberPortal
   ├─ Shop status: isOpen = false
   └─ Foreground service: auto_start_foreground_service = false
      └─ Service will not run
```

## No Separate Permission Step Needed

**Before (Manual Permission):**
- Owner grants permission in settings
- Owner opens shop manually
- Two separate actions needed

**Now (Automatic via Shop Status):**
- Owner just opens/closes shop
- Foreground service permission is automatically managed
- Single action needed

## Files Created/Modified

### 1. **NEW: Shop Status & Permission Linker**
**File:** `src/lib/shop-status-permissions.ts`

Functions:
- `toggleShopStatusAndPermission(userId, shopId, isOpen)` 
  - Automatically sets `auto_start_foreground_service = isOpen`
  - When opening shop: permission = true
  - When closing shop: permission = false

### 2. **MODIFIED: BarberPortal Dashboard**
**File:** `src/components/BarberPortal.tsx`

Changes:
- Enhanced Shop Status card with visual feedback
- Shows when foreground service is enabled/disabled
- When shop is open: 
  - Green gradient background
  - "🟢 Shop Status - OPEN"
  - "🚀 Foreground Service Status: ✅ ENABLED"
  - Pulsing green indicator
- When shop is closed:
  - Red gradient background
  - "🔴 Shop Status - CLOSED"
  - "🚀 Foreground Service Status: ⏸️ DISABLED"
  - Gray indicator

Updated `handleToggleShopOpen()` function:
- Calls `toggleShopStatusAndPermission()` first
- Updates database
- Shows detailed feedback to owner

## User Experience Flow

### Opening Shop

```
Step 1: Owner clicks "🟢 Open Shop" button
        ↓
Step 2: System calls toggleShopStatusAndPermission(user.id, shop.id, true)
        ↓
Step 3: Database updates:
        - shops.is_open = true
        - native_shop_owners.auto_start_foreground_service = true
        ↓
Step 4: Toast notification shows:
        "✅ Shop is now OPEN
         🚀 Foreground service is ENABLED
         You will receive automatic appointment reminders"
        ↓
Step 5: UI updates to show green status
        - Service status: ✅ ENABLED (with pulsing green dot)
        - Help text explains service is monitoring
        ↓
Step 6: When customers book:
        - Foreground service auto-starts on owner's device
        - Owner gets reminders for appointments
```

### Closing Shop

```
Step 1: Owner clicks "🔴 Close Shop" button
        ↓
Step 2: System calls toggleShopStatusAndPermission(user.id, shop.id, false)
        ↓
Step 3: Database updates:
        - shops.is_open = false
        - native_shop_owners.auto_start_foreground_service = false
        ↓
Step 4: Toast notification shows:
        "🔴 Shop is now CLOSED
         ⏸️ Foreground service is DISABLED"
        ↓
Step 5: UI updates to show red status
        - Service status: ⏸️ DISABLED (with gray dot)
        - Help text explains service is not running
        ↓
Step 6: Foreground service won't start for new bookings
        - But existing reminders may still work
```

## UI Enhancements

### Dashboard Card Before (Old)
```
┌─ Shop Status ─────────────────┐
│ Shop Status          🟢 Open  │
│ [Close Shop]                  │
│ Token Booking      ▶️ Active  │
│ [Pause]                       │
└───────────────────────────────┘
```

### Dashboard Card After (New)
```
┌─ 🟢 Shop Status - OPEN ───────────────────────────┐
│                                                   │
│ Shop Status                    🟢 [Close Shop]   │
│ ✅ OPEN                                           │
│ ─────────────────────────────────────────────── │
│ 🚀 Foreground Service Status                     │
│ Auto-Start Service             🟢                │
│ ✅ ENABLED - Service will auto-start...        │
│ ─────────────────────────────────────────────── │
│ ℹ️ Your shop is open. The foreground service   │
│    is now ENABLED and will automatically        │
│    monitor appointments...                      │
│ ─────────────────────────────────────────────── │
│ Token Booking                  ▶️ [Pause]       │
│ ▶️ Active                                        │
└───────────────────────────────────────────────────┘
```

## Visual Indicators

### When Shop is OPEN
- 🟢 Green border on card
- 🟢 Green gradient background (light)
- 🟢 Green text "✅ OPEN"
- 🚀 Service status: "✅ ENABLED"
- 🟢 Pulsing green dot (animated)
- Green button: "🔴 Close Shop"

### When Shop is CLOSED
- 🔴 Red border on card
- 🔴 Red gradient background (light)
- 🔴 Red text "❌ CLOSED"
- ⏸️ Service status: "⏸️ DISABLED"
- ⚪ Gray dot (static)
- Green button: "🟢 Open Shop"

## Implementation Details

### Database Changes (Already Exist)
```
shops table:
├── id
├── name
├── is_open ← Already exists
└── ... other fields

native_shop_owners table:
├── id
├── user_id
├── shop_id
├── auto_start_foreground_service ← Permission linked to is_open
├── updated_at
└── ... other fields
```

### Function: toggleShopStatusAndPermission()

```typescript
async function toggleShopStatusAndPermission(
  userId: string,
  shopId: string,
  isOpen: boolean  // true = opening, false = closing
): Promise<boolean> {
  // Updates native_shop_owners table:
  // SET auto_start_foreground_service = isOpen
  // WHERE user_id = userId AND shop_id = shopId
}
```

### Integration in BarberPortal

```typescript
const handleToggleShopOpen = async () => {
  if (!selectedShop || !user?.uid) return;
  
  try {
    // Step 1: Update permission first
    const permissionUpdated = await toggleShopStatusAndPermission(
      user.uid,
      selectedShop.id,
      !selectedShop.isOpen  // Toggle to new state
    );
    
    if (!permissionUpdated) {
      toast.error('Failed to update foreground service permission');
      return;
    }
    
    // Step 2: Update shop status
    const updated = await updateShop(selectedShop.id, { 
      isOpen: !selectedShop.isOpen 
    });
    
    if (updated) {
      setSelectedShop(updated);
      
      // Step 3: Show appropriate feedback
      if (updated.isOpen) {
        toast.success(
          '✅ Shop is now OPEN\n' +
          '🚀 Foreground service is ENABLED\n' +
          'You will receive automatic appointment reminders',
          { duration: 4000 }
        );
      } else {
        toast.success(
          '🔴 Shop is now CLOSED\n' +
          '⏸️ Foreground service is DISABLED',
          { duration: 4000 }
        );
      }
    }
  } catch (error) {
    console.error('Error toggling shop status:', error);
    toast.error('Failed to update shop status');
  }
};
```

## Benefits

✅ **Simpler for Owner:** Just open/close shop - no separate permission step  
✅ **Clear Visual Feedback:** Color-coded status shows service status  
✅ **Automatic Management:** Permission automatically synced with shop status  
✅ **Energy Efficient:** Service disabled when shop is closed  
✅ **No Battery Drain:** Foreground service doesn't run unnecessarily  
✅ **Logical:** Makes sense - service runs when shop is open  
✅ **Transparent:** Owner always knows if service is active  

## Customer Experience

### When Shop is Open
```
Customer:
1. Searches for barber shops
2. Sees shop is "Online" ✅ (isOpen = true)
3. Clicks "Book" and selects time
4. Creates booking

Owner's Device:
1. Receives notification with booking details
2. Foreground service auto-starts
3. Owner gets reminders and alarms
4. Can confirm/deny appointment
```

### When Shop is Closed
```
Customer:
1. Searches for barber shops
2. Sees shop is "Offline" ❌ (isOpen = false)
3. Cannot book (optional - based on your logic)
   OR
   Can book but marked as "pending owner response"

Owner's Device:
1. May receive notification
2. Foreground service won't auto-start
3. Owner won't get automatic reminders
```

## Testing Checklist

- [ ] Owner opens shop → `isOpen = true`, `auto_start_foreground_service = true`
- [ ] Owner closes shop → `isOpen = false`, `auto_start_foreground_service = false`
- [ ] UI shows correct status (green when open, red when closed)
- [ ] Foreground service icon pulses when shop is open
- [ ] Toast notifications show correct messages
- [ ] Permission is properly set in native_shop_owners table
- [ ] When customer books while shop is open → Service starts on owner device
- [ ] When customer books while shop is closed → Service doesn't auto-start

## Console Logs to Monitor

### When Opening Shop:
```
🏪 Updating shop status for user: user-123, shop: shop-456
   Shop is now: 🟢 OPEN
✅ Shop opened - Foreground service permission ENABLED
   Foreground service can now run when customers book appointments
```

### When Closing Shop:
```
🏪 Updating shop status for user: user-123, shop: shop-456
   Shop is now: 🔴 CLOSED
✅ Shop closed - Foreground service permission DISABLED
   Foreground service will not run automatically
```

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Shop status doesn't change | Function failed | Check console logs for error |
| Foreground service still runs after closing | Permission not updated | Verify `auto_start_foreground_service` in database |
| UI shows wrong status | State not synced | Refresh page or reopen portal |
| Toast notification doesn't show | Duration too short | Adjust toast duration in code |
| Service starts when shop is closed | Logic error | Check condition in notification handler |

## Future Enhancements

1. **Scheduled Opening:** Auto-open shop at set times
2. **Auto-Close:** Automatically close shop at end of day
3. **Busy Mode:** Different status for "very busy" (still open but limited)
4. **Break Time:** Close for lunch break without full closure
5. **Appointment Duration:** Auto-close when last appointment ends
6. **Analytics:** Track how long shop was open
7. **Notifications:** Notify customers when shop opens/closes

## Summary

This feature seamlessly integrates the shop's operational status with the foreground service, creating a natural workflow:

- **Open Shop** = Enable Foreground Service
- **Close Shop** = Disable Foreground Service

No additional permission steps needed. The owner simply manages their shop status, and the system automatically handles the foreground service accordingly.
