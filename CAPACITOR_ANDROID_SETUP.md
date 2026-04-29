# Capacitor Android App Setup Guide

## What has been configured

✅ **Capacitor Configuration** - `capacitor.config.ts` updated with OneSignal plugin settings
✅ **Android Manifest** - Added required permissions for notifications (POST_NOTIFICATIONS, ACCESS_NETWORK_STATE)
✅ **MainActivity** - Updated to initialize OneSignal and create notification channels
✅ **Notification Helper** - Android helper class to manage notification channels
✅ **Web Bridge** - Created `src/lib/capacitor-notifications.ts` to bridge native and web notifications
✅ **OneSignal Integration** - Updated to auto-detect Capacitor environment and use native OneSignal

## Next Steps

### 1. Install OneSignal Gradle Dependencies

Update `android/app/build.gradle` - add the OneSignal dependency in the `dependencies` section:

```gradle
dependencies {
    // ... existing dependencies ...
    implementation 'com.onesignal:OneSignal:[5.0, 6.0)'
}
```

The file is located at: `android/app/build.gradle`

### 2. Get Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use existing): **barber-booking**
3. Enable Cloud Messaging (FCM)
4. Generate Android app credentials
5. Download `google-services.json`
6. Place it in: `android/app/google-services.json`

### 3. Configure OneSignal FCM Settings

1. Go to [OneSignal Dashboard](https://onesignal.com/)
2. Navigate to: **Settings > Keys & IDs > Google Android (GCM/FCM)**
3. Paste your FCM Server Key from Firebase Console
4. Paste your FCM Sender ID

### 4. Build and Run

```bash
# Rebuild and sync Android project
npm run build
npx cap sync android

# Open Android Studio
npx cap open android
```

Then in Android Studio:
- Click **Build > Build Bundle(s) / APK(s) > Build APKs**
- Or click the Run button (Play icon) to deploy to emulator/device

### 5. Test Push Notifications

**From OneSignal Dashboard:**
1. Go to **Campaigns > New Push**
2. Select **Android** platform
3. Create a test notification
4. Send to your device

**The notification should:**
- Display on the native Android device
- Be bridged to the web app through the Capacitor bridge
- Be handled by your reminder notification system if it contains booking data

## Architecture

```
┌─────────────────────────────────────┐
│  OneSignal Cloud                    │
│  (Sends push notification)          │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  Android Native Layer               │
│  (OneSignal SDK receives)           │
│  - MainActivity.java (initializes)  │
│  - NotificationHelper.java          │
│  - Creates notification channels    │
└────────────┬────────────────────���───┘
             │
             ▼
┌─────────────────────────────────────┐
│  Capacitor Bridge                   │
│  (capacitor-notifications.ts)       │
│  - Listens to native notifications  │
│  - Dispatches web events            │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  Web App (React)                    │
│  - onesignal-messaging.ts           │
│  - Handles notification actions     │
│  - Updates UI/Database              │
└─────────────────────────────────────┘
```

## File Changes Summary

### Modified Files
- ✅ `capacitor.config.ts` - OneSignal plugin configuration
- ✅ `android/app/src/main/AndroidManifest.xml` - Added notification permissions
- ✅ `src/lib/onesignal-messaging.ts` - Detect Capacitor and use native OneSignal

### New Files
- ✅ `src/lib/capacitor-notifications.ts` - Capacitor/native bridge
- ✅ `android/app/src/main/java/com/barberbooking/app/NotificationHelper.java` - Android notification channel helper
- ✅ `android/app/src/main/java/com/barberbooking/app/MainActivity.java` - Updated main activity

## Important Notes

1. **FCM Setup is Required** - Push notifications won't work without Firebase Cloud Messaging configuration
2. **App ID** - The OneSignal App ID is hardcoded as `f2c5559b-9e99-4aa0-8924-237469824a88` - ensure this matches your OneSignal app
3. **Notification Permissions** - Android 13+ requires runtime notification permissions (handled automatically by OneSignal)
4. **WebView Settings** - Capacitor automatically handles WebView configuration for your PWA

## Troubleshooting

### Notifications not appearing?
1. Check Firebase Console - ensure FCM is enabled and credentials are correct
2. Check OneSignal Dashboard - verify FCM keys are configured
3. In Android Studio, check **Logcat** for OneSignal logs:
   ```
   OneSignal
   ```

### Build fails?
1. Ensure `google-services.json` is in `android/app/`
2. Run: `npx cap sync android` to sync latest changes
3. In Android Studio: **File > Sync Now**

### WebView not loading?
1. Check `capacitor.config.ts` - `webDir: 'dist'` must exist
2. Ensure app is built: `npm run build`
3. Check Android Studio Logcat for errors

## Next: Deploy to Google Play

When ready to release:
1. Generate signed APK/Bundle in Android Studio
2. Upload to Google Play Console
3. Configure OneSignal production settings
4. Test on real devices before launch

---

For more info: https://capacitorjs.com/docs/getting-started
