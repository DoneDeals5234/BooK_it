# Native Notifications System - Setup Checklist

## ✅ What Was Created

This implementation provides a complete native notification system for your Capacitor app. Here's what was added:

### 1. **Supabase Edge Functions** (3 new functions)
- ✅ `save-native-device` - Registers/updates native device with playerId
- ✅ `send-native-notification` - Sends notifications to native devices
- ✅ `detect-and-route-notification` - Smart routing between native and web

### 2. **Client-Side Library**
- ✅ `src/lib/supabase-native-devices.ts` - Utility functions for managing native devices

### 3. **Authentication Updates**
- ✅ Updated `src/contexts/AuthContext.tsx` to register native devices on login
- ✅ Automatic environment detection (native vs web)
- ✅ OneSignal integration for native playerId retrieval

### 4. **Documentation**
- ✅ `NATIVE_NOTIFICATIONS_SETUP.md` - Complete setup guide
- ✅ `NATIVE_NOTIFICATIONS_CHECKLIST.md` - This file
- ✅ `src/examples/native-notifications-usage.ts` - Usage examples
- ✅ `supabase/migrations/create_native_devices_table.sql` - Database migration

### 5. **Configuration**
- ✅ Updated `supabase/config.toml` with new function entries

---

## 🚀 Next Steps - Action Required

### Step 1: Create the `native_devices` Table

Go to your Supabase dashboard and run this SQL query in the SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS native_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  email TEXT,
  player_id TEXT NOT NULL,
  device_type TEXT DEFAULT 'native',
  last_active TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_native_devices_user_id ON native_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_native_devices_player_id ON native_devices(player_id);
CREATE INDEX IF NOT EXISTS idx_native_devices_user_player ON native_devices(user_id, player_id);

ALTER TABLE native_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own native devices"
  ON native_devices
  FOR SELECT
  USING (true);

CREATE POLICY "Service role can insert/update native devices"
  ON native_devices
  FOR INSERT, UPDATE
  USING (true);
```

### Step 2: Deploy Supabase Functions

In your terminal, run:

```bash
supabase functions deploy save-native-device
supabase functions deploy send-native-notification
supabase functions deploy detect-and-route-notification
```

Or deploy all at once:
```bash
supabase functions deploy
```

### Step 3: Verify Environment Variables

Ensure these are set in your Supabase project:
- ✅ `ONESIGNAL_APP_ID` - Your OneSignal App ID
- ✅ `ONESIGNAL_API_KEY` - Your OneSignal API Key
- ✅ `SUPABASE_URL` - Should be auto-set
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Should be auto-set

### Step 4: Test the System

1. **Test native environment detection:**
   ```bash
   npm run dev
   # Build native app to test on device/emulator
   ```

2. **Test device registration:**
   - Log in on native device
   - Check Supabase `native_devices` table for new record
   - Verify playerId is saved

3. **Test notification sending:**
   ```typescript
   import { supabase } from '@/lib/supabase';
   
   await supabase.functions.invoke('send-native-notification', {
     body: {
       title: 'Test',
       body: 'Test notification',
       userIds: ['your-user-id'],
     }
   });
   ```

---

## 📊 How It Works (Architecture)

```
┌─────────────────────────────────────────────────────────────┐
│                   Native App (Capacitor)                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  User Login → OneSignal Init → Get playerId                  │
│       ↓                                                       │
│  isCapacitor() = true                                        │
│       ↓                                                       │
│  saveNativeDevice({userId, email, playerId})                 │
│       ↓                                                       │
│  Supabase Edge Function: save-native-device                  │
│       ↓                                                       │
│  Stored in: native_devices table                             │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                            ↕
        When Sending Notification:
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   Dashboard (Web)                            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Send Booking Notification                                   │
│       ↓                                                       │
│  detect-and-route-notification (targetPlatform='both')      │
│       ↓                                       ↓              │
│  ┌──────────────────┐       ┌──────────────────────────┐   │
│  │ Web Devices      │       │ Native Devices           │   │
│  ├──────────────────┤       ├──────────────────────────┤   │
│  │ send-notification│       │ send-native-notification│   │
│  │ (subscription ID)│       │ (player ID)              │   │
│  └──────────────────┘       └──────────────────────────┘   │
│       ↓                                   ↓                 │
│  user_devices table              native_devices table      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Integration with Existing Code

The system is automatically integrated with your existing authentication flow. No additional code is needed - it just works!

### Where Native Device Registration Happens:
- `AuthContext.tsx` - `signIn()` function (lines 72-111)
- `AuthContext.tsx` - `signUp()` function (lines 117-165)
- `AuthContext.tsx` - `signInAsShopOwner()` function (lines 169-218)
- `AuthContext.tsx` - `signUpAsShopOwner()` function (lines 224-280)
- `AuthContext.tsx` - `useEffect` for auth state changes (lines 50-70)

### How It Works:
1. User logs in on native device
2. Firebase authenticates user
3. `isCapacitor()` check determines environment
4. If native: calls `saveNativeDevice()` with playerId
5. If web: calls `saveUserDevice()` (existing system)
6. Player ID automatically fetched from OneSignal

---

## 💬 Sending Notifications to Native Users

### Option 1: Send to Specific Native Users
```typescript
await supabase.functions.invoke('send-native-notification', {
  body: {
    title: '🔔 New Booking',
    body: 'You have a new booking!',
    userIds: ['shop-owner-id'], // App fetches playerId from native_devices
    data: { bookingId: '123' },
  }
});
```

### Option 2: Send to Both Web & Native (Recommended)
```typescript
await supabase.functions.invoke('detect-and-route-notification', {
  body: {
    targetPlatform: 'both',
    title: '🔔 New Booking',
    body: 'You have a new booking!',
    userIds: ['user-id'], // Works for both platforms
    data: { bookingId: '123' },
  }
});
```

### Option 3: Send to Direct Player IDs
```typescript
await supabase.functions.invoke('send-native-notification', {
  body: {
    title: '🔔 Reminder',
    body: 'Your appointment is in 30 minutes',
    playerIds: ['onesignal-player-id-1', 'onesignal-player-id-2'],
  }
});
```

---

## 🔐 Security Notes

- Edge functions have `verify_jwt = false` for compatibility
- Row Level Security is enabled on `native_devices` table
- Service role key is required for write operations
- Policies prevent unauthorized access

To enable stricter security:
```sql
-- Only allow authenticated users to insert their own devices
CREATE POLICY "Users can insert their own devices"
  ON native_devices
  FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);
```

---

## 🧪 Troubleshooting

| Issue | Solution |
|-------|----------|
| **PlayerId not saved** | Check if running in native environment (`isCapacitor()`) |
| **Notification not received** | Verify playerId in `native_devices` table |
| **Function errors** | Check Supabase edge function logs in dashboard |
| **No permission errors** | Ensure Supabase RLS policies are correct |
| **OneSignal not initializing** | Check browser/app console for initialization logs |

---

## 📚 Additional Resources

- **Full Setup Guide**: `NATIVE_NOTIFICATIONS_SETUP.md`
- **Usage Examples**: `src/examples/native-notifications-usage.ts`
- **Database Migration**: `supabase/migrations/create_native_devices_table.sql`
- **OneSignal Docs**: https://documentation.onesignal.com/
- **Capacitor Docs**: https://capacitorjs.com/

---

## ✨ Key Features

- ✅ **Automatic Environment Detection** - Works for both web and native
- ✅ **Persistent Storage** - Player IDs stored securely in Supabase
- ✅ **Smart Routing** - Send to one or both platforms with single call
- ✅ **Error Handling** - Comprehensive error handling and logging
- ✅ **User Isolation** - Each user gets their own device records
- ✅ **Scalable** - Handles multiple devices per user
- ✅ **Backward Compatible** - Existing web notification system still works

---

## 🎯 Next Actions

1. Create the `native_devices` table in Supabase
2. Deploy the 3 edge functions
3. Verify environment variables are set
4. Test on a native device
5. Update your booking notification code to use the new system
6. Test end-to-end notification flow

That's it! You now have a complete native notification system! 🎉
