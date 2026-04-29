# Production-Ready Booking Negotiation System

## Overview

The new booking system implements a real-time negotiation flow between customers and shop owners with the following features:

- **Real-time Communication**: Customers and owners can negotiate booking times using in-app alarms
- **1-Minute Response Timeouts**: Owner has 1 minute to respond; customer has 1 minute to accept offers
- **2-Minute Overall Deadline**: Entire negotiation must complete within 2 minutes
- **Smart Notifications**: OneSignal push notifications + native Android alarms
- **Fallback Handling**: If owner doesn't respond, customer can call or cancel

## Architecture

### Database Schema
- `booking_requests`: Tracks the customer's booking request with status
- `booking_negotiations`: Tracks offers and counter-offers with expiration times
- Added `booking_request_id` column to `bookings` table for negotiation history

### Core Components

#### Customer Side
1. **CustomerTimeSlotSelection** (`src/components/ProductionBooking/CustomerTimeSlotSelection.tsx`)
   - Displays available time slots
   - Customer selects a time and submits
   - Shows 60-second "Please wait for owner response" screen with countdown

2. **OwnerNotRespondingPopup** (`src/components/ProductionBooking/OwnerNotRespondingPopup.tsx`)
   - Appears if owner doesn't respond within 1 minute
   - Options: Call owner or cancel booking

3. **CustomerOfferResponse** (`src/components/ProductionBooking/CustomerOfferResponse.tsx`)
   - Appears when owner offers alternative times
   - 1-minute countdown to accept or reject
   - Shows alarms to keep user engaged

#### Owner Side
1. **OwnerBookingNotification** (`src/components/ProductionBooking/OwnerBookingNotification.tsx`)
   - Shows incoming booking request with 1-minute countdown
   - Animated alarm UI to grab attention
   - Options: Confirm, Reject, or Offer Alternative Time

2. **OwnerOfferTimeSelection** (`src/components/ProductionBooking/OwnerOfferTimeSelection.tsx`)
   - Owner can pick from available slots OR type custom time
   - Sends offer to customer

### State Management
- **RealTimeNegotiationContext** (`src/contexts/RealTimeNegotiationContext.tsx`)
  - Manages negotiation state across components
  - Tracks deadlines, responses, and timeouts
  - Methods for each state transition

### Utilities
- **useCountdownTimer** (`src/lib/use-countdown-timer.ts`)
  - Countdown timer hook for alarms
  - Auto-expiration triggers callbacks

- **useNegotiationSubscription** (`src/lib/use-negotiation-subscription.ts`)
  - Real-time Supabase subscriptions
  - Automatic timeout scheduling

- **booking-negotiation-notifications** (`src/lib/booking-negotiation-notifications.ts`)
  - Centralized notification orchestration
  - OneSignal + native alarm coordination

## How to Use

### For Customers

1. Click "Book" on a shop
2. Select service and enter contact details
3. **Select a time slot** from the available options
4. Click "Confirm Time" to send to owner
5. **Wait (60 seconds)** for owner to respond with loader screen
6. Owner responds:
   - **If Confirmed**: Booking is saved, you'll see confirmation
   - **If Offered Alternative**: You have 1 minute to accept or reject
   - **If No Response**: After 1 minute, you can Call or Cancel

### For Owners

1. Receive **in-app alarm notification** when customer requests a time
2. **Alarm has 1-minute countdown** with customer details
3. Click one of three options:
   - **✓ Confirm**: Approve the requested time (booking saved)
   - **✗ Reject**: Decline the booking
   - **⏱ Offer Time**: Suggest alternative time(s)
4. If offering alternative:
   - Pick from available slots OR type custom time
   - Customer gets 1-minute alarm to accept/reject
5. If customer accepts: Booking confirmed
6. If customer rejects: Negotiation ends

## Integration Points

### Adding ProductionBookingFlow to Existing UI

```tsx
import { ProductionBookingFlow } from '@/components/ProductionBooking/ProductionBookingFlow';

// In your booking button handler:
<ProductionBookingFlow
  shop={selectedShop}
  service={selectedService}
  availableTimeSlots={slots}
  customerName={customerName}
  customerPhone={customerPhone}
  ownerPhone={ownerPhone}
  isOwner={isOwner}
  onClose={() => setShowBooking(false)}
  onBookingConfirmed={(bookingId) => {
    // Handle successful booking
  }}
/>
```

### Notification Flow

```
Customer selects time
  ↓
[OneSignal + 1-min native alarm to Owner]
  ↓
Owner responds within 1 min
  ├─ Confirm → [Notification to Customer] → Booking Created
  ├─ Offer → [OneSignal + 1-min native alarm to Customer]
  │   └─ Customer accepts/rejects within 1 min
  └─ Reject → [Notification to Customer] → Negotiation Ends
  
If Owner doesn't respond in 1 min
  └─ [Popup to Customer: Call or Cancel]
```

## Features Implemented

✅ **Real-time State Management**
- Context-based state tracking
- Deadline management (1-min, 60-sec, 2-min total)

✅ **Alarm System**
- OneSignal push notifications (web + mobile)
- Native Android full-screen alarms
- Automatic expiration

✅ **Negotiation Flow**
- Customer → Owner (time request)
- Owner → Customer (confirm/reject/offer)
- Customer → Owner (accept/reject offer)

✅ **Timeout Handling**
- 1-minute response deadlines
- 60-second customer wait screen
- 2-minute overall deadline

✅ **Notification Coordination**
- Centralized notification orchestration
- Graceful handling of platform differences

## Configuration

### Alarm Durations (Configurable)
- Owner response deadline: 1 minute (60,000ms)
- Customer offer response: 1 minute (60,000ms)  
- Customer wait screen: 60 seconds (60,000ms)
- Overall negotiation: 2 minutes (120,000ms)

To change durations, edit the timeout values in:
- `src/contexts/RealTimeNegotiationContext.tsx`
- `src/lib/use-countdown-timer.ts`
- `src/components/ProductionBooking/*.tsx` (timer initialization)

### OneSignal Integration
The system uses existing OneSignal setup from `src/lib/onesignal-messaging.ts`:
- Player IDs for direct notifications
- User ID tagging for batch sends
- Native alarm scheduling bridge

### Native Alarm Setup
Requires Android native code configured in:
- `android/app/src/main/java/com/bookbarber/app/AlarmBridge.java`
- `capacitor.config.ts` for AlarmBridge plugin registration

## Testing Checklist

### Setup
- [ ] Both shop owner and customer accounts created
- [ ] Owner phone number stored in shop record
- [ ] OneSignal configured and tested
- [ ] Native alarms working (Android)

### Customer Flow
- [ ] Can see available time slots
- [ ] Can select a slot and submit
- [ ] Sees 60-second "Please wait" screen with countdown
- [ ] Can cancel while waiting
- [ ] Receives "Owner not responding" popup after 1 minute if no response
- [ ] Can call owner from popup
- [ ] Can accept/reject owner's time offer within 1 minute
- [ ] Receives confirmation notification when booking is confirmed

### Owner Flow
- [ ] Receives in-app alarm when customer requests time
- [ ] Sees 1-minute countdown on notification
- [ ] Can confirm booking
- [ ] Can reject booking
- [ ] Can offer alternative time(s)
- [ ] Can pick from available slots OR type custom time
- [ ] Customer receives alarm for offered time
- [ ] Booking is created when all parties agree

### Edge Cases
- [ ] Owner ignores alarm → customer sees "not responding" popup
- [ ] Customer ignores offer → negotiation expires, booking cancelled
- [ ] Owner offers multiple times → customer sees all options
- [ ] Negotiation exceeds 2 minutes → automatic expiration
- [ ] Network disconnection → graceful fallback

## Troubleshooting

### Alarms Not Showing
- Check OneSignal configuration in `index.html` and `capacitor.config.ts`
- Verify player IDs are being set correctly in `AuthContext.tsx`
- For native Android: verify AlarmBridge is registered in capacitor.config

### Timeouts Not Working
- Check browser console for timer errors
- Verify `useCountdownTimer` is receiving correct duration
- Ensure `useNegotiationSubscription` effect dependencies are correct

### Notifications Not Reaching Owner
- Verify owner's `native_devices` or `user_devices` record has player ID
- Check OneSignal campaign delivery status
- Ensure notification data structure matches OneSignal API

### Real-time Updates Not Syncing
- Verify Supabase real-time subscriptions are enabled
- Check network connectivity
- Review browser console for subscription errors

## API Integration Points

### Supabase Functions Used
- `createProductionBookingRequest()`: Save customer request
- `updateBookingRequestStatus()`: Update request status
- `createOwnerCounterOffer()`: Save time offer
- `getLatestNegotiation()`: Fetch latest offer
- `subscribeToOwnerBookingRequests()`: Real-time owner updates
- `subscribeToCustomerNegotiationUpdates()`: Real-time customer updates

### OneSignal Functions Used
- `sendNotificationToPlayerIds()`: Direct device notification
- `sendNotificationByUserId()`: User ID-based notification
- `sendNotificationToCurrentDevice()`: Current session notification

### Native Bridge
- `window.AlarmBridge.scheduleAlarm()`: Schedule Android alarm

## Future Enhancements

- [ ] SMS fallback for alarm notifications
- [ ] Email confirmation for bookings
- [ ] Customer-initiated re-negotiation
- [ ] Analytics on negotiation success rates
- [ ] AI-powered time suggestions for owners
- [ ] Webhook integration for external systems

## Support & Debugging

For issues:
1. Check browser console for JS errors
2. Review Supabase logs for DB errors
3. Check OneSignal dashboard for delivery status
4. Verify native alarm service is running (Android)
5. Test with simple logging in state update functions
