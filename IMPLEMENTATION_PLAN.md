# Order Requests Feature - Implementation Plan

## Overview
This plan describes how to implement the "Order Requests" feature in the owner portal and customer profile for order management and collection.

## Current Status Analysis
✅ **Good News**: Most of the infrastructure is already in place!

### Existing Components:
1. **Owner Portal** (`BarberPortal.tsx`):
   - Already has an "orders" tab (line 38, 48, 68)
   - `OrderRequestsPanel` component is already imported (line 28)
   - Owners can already Accept/Reject orders

2. **Customer Profile** (`ProfilePage.tsx`):
   - Already has an "orders" tab (line 68)
   - `CustomerOrdersPanel` component is already imported (line 19)
   - Shows orders grouped by status: pending, rejected, accepted, ready_for_collection, collected

3. **Order Collection Modal** (`OrderCollectionModal.tsx`):
   - Already displays shop details (name, phone, address)
   - Shows order amount
   - Has a "Go to Location" button that opens Google Maps
   - Uses shop's `locationMapLink` or latitude/longitude coordinates

4. **Order System** (`supabase-orders.ts`):
   - Complete CRUD operations for orders
   - Support for all statuses: pending, accepted, rejected, ready_for_collection, collected
   - Automatic notifications to customers and shop owners

---

## Implementation Gaps & Fixes Needed

### 1. **Owner Portal - Add "Order Requests" Button to Dashboard**
**Location**: `BarberPortal.tsx` - Dashboard Tab
**Current**: Orders tab exists but no dashboard button to access it
**Fix**: Add a prominent button on the dashboard to navigate to the orders tab

### 2. **Customer Profile - Add "Order" Button/Section**
**Location**: `ProfilePage.tsx` - Main Navigation
**Current**: Orders tab exists but might not be visible in main navigation
**Fix**: Ensure the Orders tab is easily accessible in the profile navigation

### 3. **Order Status Flow - Complete Implementation**
**Current**: Pending → Accepted → Collected workflow exists
**Missing**: "Ready for Collection" status marking by owner (before customer collects)
**Fix**: Add button in OrderRequestsPanel for owner to mark orders as "ready_for_collection"

### 4. **Shop Location Verification**
**Current**: Using `locationMapLink`, `latitude`, `longitude` from shop data
**Verification**: Ensure shop details page allows owners to set location properly

---

## Detailed Implementation Steps

### Step 1: Owner Portal Dashboard Enhancement
**File**: `src/components/BarberPortal.tsx`

**Change**: Add "Order Requests" button in the dashboard that shows:
- Count of pending orders
- Quick access button to Orders tab
- Visual indicator (badge) for pending orders

**Behavior**:
```
Dashboard View:
├── [Order Requests Button]
│   ├── Badge showing: "3 Pending Orders"
│   └── Click → Navigates to "orders" tab
│
Orders Tab View:
├── Summary Cards (All, Pending, Accepted, Ready, Collected)
├── Order List with:
│   ├── Customer Name
│   ├── Order Amount
│   ├── Phone Number (clickable)
│   ├── Status Badge
│   └── Actions (Accept/Reject/Mark Ready)
```

### Step 2: Customer Profile - Order Section
**File**: `src/components/ProfilePage.tsx`

**Current**: Orders tab already exists and shows:
- Pending Orders (waiting for acceptance)
- Rejected Orders (with rejection reason)
- Accepted Orders (ready to collect button)
- Ready for Collection Orders (go to shop button)
- Collected Orders (archived)

**Enhancement**: Ensure tab is visible and add visual improvements
- Show order count in tab
- Add collection status indicators

### Step 3: Add "Ready for Collection" Action in Owner Portal
**File**: `src/components/OrderRequestsPanel.tsx`

**Current**: Only Accept/Reject buttons for pending orders
**Add**: For accepted orders, add "Mark as Ready for Collection" button

**New Behavior**:
```
For Accepted Orders:
├── Shop Owner Action Options:
│   ├── Mark as Ready for Collection (updates status)
│   └── Reject (change mind option)
│
For Ready Orders:
├── Show status badge
└── Info: "Customer has been notified to collect"
```

### Step 4: Shop Details Verification
**File**: `src/lib/shops-storage.ts`

**Verify**: Shop model includes:
- `locationMapLink` - Google Maps link set by owner
- `latitude` and `longitude` - GPS coordinates
- `address`, `village`, `district`, `state` - Full address

**Owner Setup**: When owner sets up shop:
1. Set location on shop view page
2. System captures: address, coordinates, maps link
3. This data is automatically used in order collection modal

### Step 5: Order Collection Modal - Already Complete
**File**: `src/components/OrderCollectionModal.tsx`

**Current Features** (Already Working):
- Displays shop name prominently
- Shows contact phone with clickable tel: link
- Shows full address with all location details
- Shows order amount
- "Go to Location" button opens Google Maps with:
  - `locationMapLink` if available
  - Otherwise generates maps URL from latitude/longitude
- Helpful note about sharing location

---

## Application Behavior After Implementation

### Owner Experience:
```
1. Login → Opens Owner Portal
   ↓
2. Dashboard Tab
   ├── Shows "Order Requests" card with pending count
   └── Click → Navigate to Orders tab
   ↓
3. Orders Tab View
   ├── Summary cards showing:
   │   ├── Total Orders
   │   ├── Pending (yellow)
   │   ├── Accepted (green)
   │   ├── Ready for Collection (blue)
   │   └── Collected (gray)
   │
   └── Pending Orders Section
       ├── Display order details
       ├── [Accept Button] → Status changes to "Accepted"
       │                    → Customer notified
       │                    → Order moves to Accepted section
       │
       └── [Reject Button] → Opens modal for rejection reason
                            → Status changes to "Rejected"
                            → Customer notified with reason

4. Accepted Orders Section
   ├── Display order details
   └── [Mark as Ready Button] → Status changes to "ready_for_collection"
                              → Customer notified to collect
                              → Order moves to Ready section

5. Ready for Collection Section
   ├── Display order details
   └── Waiting for customer to collect
```

### Customer Experience:
```
1. Login → Opens Profile Page
   ↓
2. Click "Orders" Tab
   ↓
3. See Orders Grouped By Status:
   
   a) Pending Orders (Yellow)
      ├── "Waiting for shop owner to accept your order..."
      └── Shows order amount, time placed, notes
      
   b) Rejected Orders (Red)
      ├── Shows rejection reason
      └── Shows order amount
      
   c) Ready to Collect (Green)
      ├── "Your order is accepted! Visit the shop to collect it."
      ├── Shows order amount
      └── [Go and Collect from Shop] Button
          └── Opens OrderCollectionModal
              ├── Shop Name (prominent)
              ├── Phone (clickable)
              ├── Full Address with location details
              ├── Order Amount
              └── [Go to Location] Button
                  └── Opens Google Maps with shop location
      
   d) Ready for Collection (Blue)
      ├── "Your order is confirmed and ready!"
      ├── Shows order amount
      └── [Go to Shop Location] Button
          └── Same as above
      
   e) Collected Orders (Gray, archived)
      └── Shows collected timestamp
```

---

## Database Considerations

### Current Supabase "orders" Table Schema:
```sql
- id (UUID, primary key)
- shop_id (UUID, foreign key)
- customer_id (UUID, foreign key)
- customer_name (text)
- customer_phone (text)
- order_amount (numeric)
- order_description (text, optional)
- status ('pending' | 'accepted' | 'rejected' | 'ready_for_collection' | 'collected')
- rejection_reason (text, optional)
- rejection_notes (text, optional)
- created_at (timestamp)
- updated_at (timestamp)
- accepted_at (timestamp, optional)
- rejected_at (timestamp, optional)
- ready_at (timestamp, optional)
- collected_at (timestamp, optional)
- expires_at (timestamp)
```

**Status**: ✅ All required fields already exist. No database changes needed.

---

## Implementation Summary

| Component | File | Change Type | Status |
|-----------|------|-------------|--------|
| Owner Dashboard Button | BarberPortal.tsx | Add button | ❌ TODO |
| Owner Orders Tab | OrderRequestsPanel.tsx | Add "Mark Ready" button | ❌ TODO |
| Customer Orders Tab | ProfilePage.tsx | Ensure visibility | ✅ DONE |
| Order Collection Modal | OrderCollectionModal.tsx | Already complete | ✅ DONE |
| Supabase Orders Library | supabase-orders.ts | Add markOrderReady function | ⚠️ PARTIAL |
| Shop Location Setup | ShopDetailsPage.tsx | Verify location config | ⚠️ VERIFY |

---

## Files to Modify

1. **`src/components/BarberPortal.tsx`**
   - Add "Order Requests" dashboard button
   - Show pending order count

2. **`src/components/OrderRequestsPanel.tsx`**
   - Add "Mark as Ready for Collection" button for accepted orders
   - Update status display logic

3. **`src/lib/supabase-orders.ts`**
   - Ensure `markOrderReady()` function exists (might need to add)

4. **`src/components/ShopDetailsPage.tsx`**
   - Verify owners can set Google Maps link for shop location

---

## Testing Checklist

- [ ] Owner can see pending order count on dashboard
- [ ] Owner can navigate to Orders tab via dashboard button
- [ ] Owner can Accept pending orders
- [ ] Owner can Reject orders with reason
- [ ] Owner can Mark orders as Ready for Collection
- [ ] Customer sees pending orders in their profile
- [ ] Customer sees rejected orders with rejection reason
- [ ] Customer can click "Go and Collect" for accepted orders
- [ ] Collection modal displays shop details correctly
- [ ] Google Maps link opens correctly for shop location
- [ ] Notifications work for order status changes
- [ ] All order statuses display correctly with proper colors

---

## Next Steps

1. **Review this plan** - Provide feedback if any changes needed
2. **Approve implementation** - Once approved, I'll proceed with code changes
3. **Implementation** - Modify the necessary files
4. **Testing** - Verify all functionality works correctly

