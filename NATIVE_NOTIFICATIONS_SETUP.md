# Native Notifications Setup Guide

This guide explains how the native notification system works and how to use it in your app.

## Overview

The native notification system has been set up to detect whether your app is running in a native (Capacitor) environment or a web environment, and routes notifications accordingly.

### Key Components

1. **`save-native-device`** - Supabase edge function that registers/updates native devices
2. **`send-native-notification`** - Supabase edge function that sends notifications to native devices
3. **`detect-and-route-notification`** - Supabase edge function that intelligently routes notifications to native or web devices
4. **`native_devices` table** - Stores native device information (userId, email, playerId)
5. **`supabase-native-devices.ts`** - Client utility library for managing native devices

## Database Schema

You need to create a `native_devices` table in your Supabase database:

```sql
CREATE TABLE native_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  email TEXT,
  player_id TEXT NOT NULL,
  device_type TEXT DEFAULT 'native',
  last_active TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX idx_native_devices_user_id ON native_devices(user_id);
CREATE INDEX idx_native_devices_player_id ON native_devices(player_id);
CREATE INDEX idx_native_devices_user_player ON native_devices(user_id, player_id);
```

## How It Works

### 1. User Login Flow (Native)

When a user logs in on a native device:
1. Firebase authenticates the user
2. The app initializes OneSignal and gets a playerId
3. `ensurePushSubscribed()` retrieves the playerId from OneSignal
4. `saveNativeDevice()` saves the user's info with playerId to the `native_devices` table
5. Push notifications can now be sent to this device

### 2. User Login Flow (Web)

When a user logs in on web:
1. Firebase authenticates the user
2. The app initializes OneSignal and gets a subscription ID
3. `ensurePushSubscribed()` retrieves the subscription ID
4. `saveUserDevice()` saves the user's info to the `user_devices` table (existing system)
5. Push notifications can be sent to this device

### 3. Sending Notifications

#### Send to Native Devices Only

```typescript
import { supabase } from '@/lib/supabase';

const response = await supabase.functions.invoke('send-native-notification', {
  body: {
    title: '🔔 New Booking',
    body: 'You have a new booking!',
    userIds: ['user123', 'user456'], // Optional: if you have userIds
    nativePlayerIds: ['player-id-1', 'player-id-2'], // Or provide playerIds directly
    data: {
      bookingId: '123',
      shopName: 'My Barber',
    },
    excludeCurrentUser: true,
    currentUserPlayerId: 'current-player-id',
  }
});
```

#### Send to Web Devices Only

```typescript
const response = await supabase.functions.invoke('send-notification', {
  body: {
    title: '🔔 New Booking',
    body: 'You have a new booking!',
    playerIds: ['sub-id-1', 'sub-id-2'],
    data: {
      bookingId: '123',
      shopName: 'My Barber',
    },
  }
});
```

#### Smart Routing (Auto-detect Platform)

Use the `detect-and-route-notification` function to automatically route to both native and web devices:

```typescript
const response = await supabase.functions.invoke('detect-and-route-notification', {
  body: {
    targetPlatform: 'both', // 'both', 'native', or 'web'
    title: '🔔 New Booking',
    body: 'You have a new booking!',
    playerIds: ['web-sub-id-1', 'web-sub-id-2'], // Web subscription IDs
    nativePlayerIds: ['native-player-id-1'], // Native player IDs
    userIds: ['user123'], // Or fetch playerIds from userIds
    data: {
      bookingId: '123',
      shopName: 'My Barber',
    },
    excludeCurrentUser: true,
    currentUserPlayerId: 'current-player-id',
  }
});
```

## Client-Side Utilities

### saveNativeDevice()

```typescript
import { saveNativeDevice } from '@/lib/supabase-native-devices';

await saveNativeDevice({
  userId: 'user123',
  email: 'user@example.com',
  playerId: 'onesignal-player-id',
});
```

### getNativeDevicesByUserId()

```typescript
const devices = await getNativeDevicesByUserId('user123');
// Returns array of native device records for the user
```

### updateNativeDevicePlayerId()

```typescript
const success = await updateNativeDevicePlayerId('user123', 'new-player-id');
```

### getAllNativeDevices()

```typescript
const allDevices = await getAllNativeDevices();
// Returns all registered native devices
```

## Environment Detection

The system uses the Capacitor `isNativePlatform()` check to determine the environment:

```typescript
import { isCapacitor } from '@/lib/capacitor-notifications';

if (isCapacitor()) {
  // Running in native environment (iOS/Android)
  await saveNativeDevice({ userId, email, playerId });
} else {
  // Running in web environment
  await saveUserDevice({ userId, email, playerId });
}
```

## Integration with BookingModal

When sending booking notifications, the system now supports both platforms:

```typescript
// Native shop owners will receive notifications via the native_devices table
// Web shop owners will receive notifications via the user_devices table
// The notification flow automatically routes based on device type

sendNotificationToCurrentDevice({
  title: '🆕 New Token Booking!',
  body: `New booking from ${user.displayName || 'Guest'} at ${shop.name}`,
});
```

## Important Notes

1. **Table Creation**: You must create the `native_devices` table in Supabase before using these functions
2. **OneSignal Configuration**: Ensure OneSignal is properly configured for native apps in your Capacitor setup
3. **Environment Variables**: Make sure `ONESIGNAL_APP_ID` and `ONESIGNAL_API_KEY` are set in Supabase
4. **Player ID Persistence**: Player IDs must be persisted and updated whenever the user logs in
5. **Error Handling**: Always wrap function calls in try-catch blocks

## Troubleshooting

### Native device not receiving notifications

1. Verify the playerId is correctly saved: Check the `native_devices` table
2. Ensure OneSignal is initialized: Check browser console for initialization logs
3. Check notification permissions: Ensure the app has notification permissions on the device
4. Verify user is logged in: Player ID is only available after OneSignal initialization

### Player ID not being saved

1. Check if app is running in native mode: Use `isCapacitor()` to verify
2. Verify OneSignal is initialized before saving: Check logs
3. Check Supabase permissions: Ensure the function has access to the native_devices table
4. Check network connectivity: Verify function requests are reaching Supabase

### Web and native notifications not being sent

1. Use `detect-and-route-notification` function for unified handling
2. Verify both web and native player IDs/subscription IDs are provided
3. Check CORS headers in edge functions
4. Verify OneSignal API key is correct
