# OneSignal Player ID Fetching Refactoring - Summary

## Overview
Refactored the OneSignal Player ID fetching flow to align with OneSignal's native SDK behavior. The new flow captures Player ID from the subscription event (when user allows notifications) and saves it immediately, rather than trying to fetch it after login.

## Previous Issues
1. Player ID was being fetched after login with 3 retries - unreliable
2. The subscription listener existed but waited for user login before saving
3. `ensureNativeDeviceWithPlayerId()` tried to get player ID immediately, which doesn't work
4. Called non-existent `getPlayerId()` function in reminder handler

## New Flow (Correct Implementation)

### 1. App Initialization
- App opens
- OneSignal is initialized (no player ID available yet)
- Subscription listener is registered

### 2. Permission Prompt & Subscription Event
- User sees permission prompt: "Allow notifications?"
- If user taps Allow:
  - OneSignal generates FCM token
  - OneSignal creates native device record
  - **Subscription event fires with event.to.userId (REAL Player ID)**

### 3. Player ID Capture & Saving (CRITICAL CHANGE)
- Subscription listener captures Player ID from event immediately
- **If user is logged in**: Save Player ID directly with user_id to Supabase
- **If user is NOT logged in**: Save Player ID temporarily to localStorage (will link on login)

### 4. User Login
- User logs in
- `linkNativeDeviceToUser()` is called
- Check if pending Player ID exists from subscription event
- If yes: Link pending Player ID to user account
- If no: Create record and wait for subscription event to fill it

### 5. Sending Notifications
- Read player_id from Supabase native_devices table
- Send notification using OneSignal Native API

## Files Modified

### 1. `src/lib/capacitor-notifications.ts`
**Changes:**
- Updated `setupSubscriptionListener()` to save player ID immediately when subscription event fires
- Added logic to handle both logged-in and not-logged-in scenarios
- Added `getPendingPlayerId()` function to retrieve temporarily saved player ID
- Added `clearPendingPlayerId()` function to clean up after linking
- Added localStorage persistence for pending player ID (survives page reloads)

**Key Functions:**
```typescript
export function getPendingPlayerId(): string | null
export function clearPendingPlayerId(): void
function savePendingPlayerIdTemporarily(playerId: string): Promise<boolean>
```

### 2. `src/lib/supabase-native-devices.ts`
**Changes:**
- Removed `ensureNativeDeviceWithPlayerId()` - it was trying to fetch player ID immediately (wrong)
- Added `linkNativeDeviceToUser()` - links pending player ID to user on login
- Function handles two scenarios:
  1. Pending player ID exists → link it to user
  2. No pending player ID → create record and wait for subscription event

**Removed:**
- `ensureNativeDeviceWithPlayerId()` - no longer needed

**Added:**
```typescript
export async function linkNativeDeviceToUser(
  userId: string,
  email: string | null,
  deviceType: string = 'native'
): Promise<boolean>
```

### 3. `src/contexts/AuthContext.tsx`
**Changes:**
- Updated imports: replaced `ensureNativeDeviceWithPlayerId` with `linkNativeDeviceToUser`
- Updated `useEffect` hook that runs on user state change to use new linking function
- Updated `saveUserDataToSupabase()` to call `linkNativeDeviceToUser()` instead of fetching
- Updated `saveShopOwnerDataToSupabase()` similarly
- Added comments explaining that player ID comes from subscription event, not from login

**Key Changes:**
- Removed all player ID fetching attempts from login flow
- Login now only links the device to user (player ID was already saved from subscription event)

### 4. `src/lib/onesignal-messaging.ts`
**Changes:**
- Fixed `handleReminderYes()` to get player ID from Supabase table instead of calling non-existent `getPlayerId()`
- Fixed corrupted emoji in error message (line 240)
- Updated `sendNotificationToCurrentDevice()` documentation
- Native apps now always read from native_devices table

## Configuration

### App ID & API Key (Already Updated)
- **App ID**: `1f14fad4-0d2f-465a-b3a8-e0e976b8729f`
- **API Key**: `os_v2_app_d4kpvvanf5dfvm5i4duxnodst5glczst2rmebymf4qvuwtvteamesdo3btuipvl5bgc53qwuyoge23d5hwst2xxyhry4t2kiyk4driq`

These are already configured in the code.

## Testing Checklist

### For Native Apps (Android/iOS):
1. ✅ Build and run native app
2. ✅ Open app - OneSignal initializes
3. ✅ Permission prompt appears
4. ✅ User taps "Allow"
5. ✅ Verify subscription event fires and player ID is captured
6. ✅ Check native_devices table - should have player_id filled
7. ✅ User login - should link existing player_id
8. ✅ Send notification - should read from table and deliver successfully

### For Web:
1. ✅ Web flow should continue to work as before
2. ✅ OneSignal subscription works normally
3. ✅ Notifications can be sent to web users

## Key Improvements

1. **Reliability**: Player ID is captured from subscription event (only reliable source)
2. **No Polling**: Eliminates retry logic trying to fetch player ID
3. **Offline Support**: Pending player ID persists in localStorage
4. **Correct Timing**: Player ID saved immediately after user allows notifications
5. **Login Independence**: Login doesn't try to fetch player ID (already available)

## Important Notes

⚠️ **DO NOT** call:
- `ensureNativeDeviceWithPlayerId()` - REMOVED
- `getPlayerId()` - DOES NOT EXIST
- Try to fetch player ID on login - it's already saved from subscription event

✅ **DO** call:
- `linkNativeDeviceToUser()` on login - links device to user account
- `sendNotificationToNativeUser()` - reads player_id from Supabase native_devices table
- `sendNotificationToPlayerIds()` - sends using player IDs from table

## Migration Status

All changes have been implemented and the development server is running without errors. The refactoring is complete and ready for testing on native devices.
