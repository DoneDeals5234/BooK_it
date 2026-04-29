# Booking Confirmation Foreground Service - Android Implementation Guide

## Overview

This document provides comprehensive instructions for implementing the foreground service on the Android side to display appointment reminders with Yes/No confirmation buttons.

## Architecture Flow

```
1. User completes booking in React app
   ↓
2. ReminderSettings component calls startForegroundAlarmService()
   ↓
3. JavaScript Bridge (window.AlarmBridge) calls native AlarmManager
   ↓
4. At scheduled time, AlarmManager triggers the Foreground Service
   ↓
5. Foreground Service displays notification with Yes/No buttons
   ↓
6. User taps Yes/No → Native code calls back to React via callback
   ↓
7. handleForegroundServiceConfirmation() or handleForegroundServiceCancellation()
   ↓
8. Owner receives notification of customer confirmation/cancellation
```

## Database Changes

The `bookings` table has been extended with:
- `reminder_time TEXT` - Time of the first reminder
- `customer_confirmation TEXT DEFAULT 'pending'` - Status: pending, confirmed, or cancelled
- `foreground_service_status TEXT DEFAULT 'not_started'` - Status: not_started, running, completed
- `customer_confirmed_at TIMESTAMP` - When customer confirmed/cancelled
- `owner_notified_confirmation BOOLEAN DEFAULT false` - Whether owner was notified

## JavaScript Bridge Interface

The React app expects these methods on `window.AlarmBridge`:

```typescript
interface AlarmBridge {
  // Start foreground service
  startForegroundAlarmService(
    triggerTimeMs: number,      // Milliseconds since epoch (when to trigger)
    bookingId: string,           // Unique booking ID
    tokenNumber: number,         // Token/queue number
    shopName: string,            // Shop display name
    timeSlot: string             // Time slot (HH:MM format)
  ): void;

  // Stop foreground service
  stopForegroundAlarmService(): void;

  // Send confirmation response back to React
  // (Called from native when user taps button)
  sendConfirmationResponse(
    bookingId: string,
    response: 'confirmed' | 'cancelled'
  ): void;
}
```

## Native Implementation Steps

### Step 1: Create ForegroundAlarmService Class

```java
import android.app.Service;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.BroadcastReceiver;
import android.content.IntentFilter;
import android.media.RingtoneManager;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.CountDownLatch;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

public class ForegroundAlarmService extends Service {
    private static final String CHANNEL_ID = "booking_reminders";
    private static final int NOTIFICATION_ID = 9999;
    
    private String bookingId;
    private int tokenNumber;
    private String shopName;
    private String timeSlot;
    private MediaPlayer mediaPlayer;
    private Thread countdownThread;
    
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            bookingId = intent.getStringExtra("bookingId");
            tokenNumber = intent.getIntExtra("tokenNumber", 0);
            shopName = intent.getStringExtra("shopName");
            timeSlot = intent.getStringExtra("timeSlot");
            long triggerTimeMs = intent.getLongExtra("triggerTimeMs", 0);
            
            // Start as foreground service
            startForeground(NOTIFICATION_ID, createNotification());
            
            // Schedule alarm check
            scheduleAlarmCheck(triggerTimeMs);
        }
        
        return START_STICKY;
    }
    
    private NotificationCompat.Builder createNotificationBuilder() {
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Booking Reminder")
            .setContentText(shopName + " at " + timeSlot)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(false)
            .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION));
        
        return builder;
    }
    
    private void scheduleAlarmCheck(long triggerTimeMs) {
        countdownThread = new Thread(() -> {
            try {
                long now = System.currentTimeMillis();
                long delayMs = triggerTimeMs - now;
                
                if (delayMs > 0) {
                    Thread.sleep(delayMs);
                }
                
                // Time to show the reminder!
                showReminderNotificationWithButtons();
                
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        });
        countdownThread.start();
    }
    
    private void showReminderNotificationWithButtons() {
        // Start ringing
        startRinging();
        
        // Create Intent for Yes button
        Intent yesIntent = new Intent(this, ConfirmationReceiver.class);
        yesIntent.setAction("BOOKING_CONFIRMED");
        yesIntent.putExtra("bookingId", bookingId);
        PendingIntent yesPendingIntent = PendingIntent.getBroadcast(
            this, 
            (bookingId + "_yes").hashCode(),
            yesIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        
        // Create Intent for No button
        Intent noIntent = new Intent(this, ConfirmationReceiver.class);
        noIntent.setAction("BOOKING_CANCELLED");
        noIntent.putExtra("bookingId", bookingId);
        PendingIntent noPendingIntent = PendingIntent.getBroadcast(
            this,
            (bookingId + "_no").hashCode(),
            noIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        
        // Build notification with Yes/No buttons
        NotificationCompat.Builder builder = createNotificationBuilder()
            .setContentTitle("Are you ready? 🔔")
            .setContentText("Token #" + tokenNumber + " - " + shopName + " at " + timeSlot)
            .addAction(android.R.drawable.ic_menu_view, "Yes, I'm Ready", yesPendingIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "No, Cancel", noPendingIntent);
        
        // Show the notification
        NotificationManager notificationManager = 
            (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        notificationManager.notify(NOTIFICATION_ID, builder.build());
    }
    
    private void startRinging() {
        try {
            // Play notification sound in a loop (max 30 seconds)
            mediaPlayer = RingtoneManager.getRingtone(
                this,
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            );
            mediaPlayer.play();
            
            // Auto-stop after 30 seconds if user doesn't tap a button
            new Thread(() -> {
                try {
                    Thread.sleep(30000);
                    if (mediaPlayer != null && mediaPlayer.isPlaying()) {
                        mediaPlayer.stop();
                    }
                } catch (InterruptedException e) {
                    e.printStackTrace();
                }
            }).start();
            
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
    
    @Override
    public void onDestroy() {
        super.onDestroy();
        if (mediaPlayer != null && mediaPlayer.isPlaying()) {
            mediaPlayer.stop();
            mediaPlayer.release();
        }
        if (countdownThread != null) {
            countdownThread.interrupt();
        }
    }
    
    @Override
    public android.os.IBinder onBind(Intent intent) {
        return null;
    }
    
    private NotificationCompat.Notification createNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Booking Service Active")
            .setContentText("Waiting for appointment time...")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build();
    }
}
```

### Step 2: Create ConfirmationReceiver BroadcastReceiver

```java
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;
import com.getcapacitor.JSObject;

public class ConfirmationReceiver extends BroadcastReceiver {
    
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        String bookingId = intent.getStringExtra("bookingId");
        
        Log.d("ConfirmationReceiver", "Action: " + action + ", BookingId: " + bookingId);
        
        if ("BOOKING_CONFIRMED".equals(action)) {
            // User tapped "Yes"
            sendResponseToJavaScript(bookingId, "confirmed");
        } else if ("BOOKING_CANCELLED".equals(action)) {
            // User tapped "No"
            sendResponseToJavaScript(bookingId, "cancelled");
        }
        
        // Stop the foreground service
        context.stopService(new Intent(context, ForegroundAlarmService.class));
    }
    
    private void sendResponseToJavaScript(String bookingId, String response) {
        // This needs to be bridged to the React app
        // Using the AlarmBridge JavaScript interface
        JSObject data = new JSObject();
        data.put("bookingId", bookingId);
        data.put("response", response);
        
        // Call JavaScript through WebView bridge
        // (Implementation depends on your Capacitor setup)
        Log.d("ConfirmationReceiver", "Booking " + bookingId + ": " + response);
    }
}
```

### Step 3: Register in AndroidManifest.xml

```xml
<!-- ForegroundAlarmService -->
<service
    android:name=".services.ForegroundAlarmService"
    android:exported="false"
    android:foregroundServiceType="reminder" />

<!-- ConfirmationReceiver -->
<receiver
    android:name=".receivers.ConfirmationReceiver"
    android:exported="false">
    <intent-filter>
        <action android:name="BOOKING_CONFIRMED" />
        <action android:name="BOOKING_CANCELLED" />
    </intent-filter>
</receiver>
```

### Step 4: Add Permissions to AndroidManifest.xml

```xml
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />
<uses-permission android:name="android.permission.VIBRATE" />
```

### Step 5: Implement JavaScript Bridge in MainActivity

```java
import com.getcapacitor.JSObject;
import com.getcapacitor.plugin.PushNotificationsHandler;
import android.webkit.JavascriptInterface;

public class AlarmBridgePlugin extends Plugin {
    
    @PluginMethod
    public void startForegroundAlarmService(PluginCall call) {
        long triggerTimeMs = call.getLong("triggerTimeMs", 0);
        String bookingId = call.getString("bookingId", "");
        int tokenNumber = call.getInt("tokenNumber", 0);
        String shopName = call.getString("shopName", "");
        String timeSlot = call.getString("timeSlot", "");
        
        Intent intent = new Intent(getContext(), ForegroundAlarmService.class);
        intent.putExtra("triggerTimeMs", triggerTimeMs);
        intent.putExtra("bookingId", bookingId);
        intent.putExtra("tokenNumber", tokenNumber);
        intent.putExtra("shopName", shopName);
        intent.putExtra("timeSlot", timeSlot);
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }
        
        call.resolve();
    }
    
    @PluginMethod
    public void stopForegroundAlarmService(PluginCall call) {
        Intent intent = new Intent(getContext(), ForegroundAlarmService.class);
        getContext().stopService(intent);
        call.resolve();
    }
}
```

### Step 6: Handle Confirmation Response in React (JavaScript Bridge)

In `src/lib/capacitor-notifications.ts`, add:

```typescript
export async function handleBookingConfirmation(bookingId: string, response: 'confirmed' | 'cancelled'): Promise<void> {
  try {
    const { processForegroundServiceResponse } = await import('@/lib/foreground-service-handlers');
    
    const result = await processForegroundServiceResponse(bookingId, response);
    
    if (result.success) {
      console.log(`✅ ${result.message}`);
    } else {
      console.error(`❌ ${result.message}`);
    }
  } catch (error) {
    console.error('Error handling booking response:', error);
  }
}
```

## Testing Checklist

- [ ] Foreground service starts when booking is confirmed
- [ ] Notification appears at the scheduled time with Yes/No buttons
- [ ] Tapping "Yes" calls handleForegroundServiceConfirmation()
- [ ] Tapping "No" calls handleForegroundServiceCancellation()
- [ ] Owner receives notification of confirmation/cancellation
- [ ] Booking status updates in database
- [ ] Foreground service stops after user responds
- [ ] Service handles edge cases (app killed, reboots, etc.)

## API Endpoints

### Handle Booking Confirmation (Edge Function)

**Endpoint:** `POST /functions/v1/handle-booking-confirmation`

**Request Body:**
```json
{
  "booking_id": "uuid",
  "action": "confirmed" | "cancelled"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Booking confirmed - owner notified",
  "booking_id": "uuid",
  "status": "confirmed"
}
```

## Database Queries

Check booking confirmation status:
```sql
SELECT id, user_name, customer_confirmation, foreground_service_status, customer_confirmed_at
FROM bookings
WHERE id = 'booking-id';
```

Get all pending confirmations for a user:
```sql
SELECT id, user_name, time_slot, service_name, token_number, customer_confirmation
FROM bookings
WHERE user_id = 'user-id' AND customer_confirmation = 'pending';
```

## Notification Flow

### When Customer Confirms (Taps "Yes")
1. Native code sends confirmation to JavaScript
2. `handleForegroundServiceConfirmation()` updates booking status to 'confirmed'
3. Function sends notification to owner with message: "✅ Customer Confirmed - {name} confirmed they're coming! Token #{token} will arrive at {time}"
4. Foreground service stops
5. Notification is dismissed

### When Customer Cancels (Taps "No")
1. Native code sends cancellation to JavaScript
2. `handleForegroundServiceCancellation()` updates booking status to 'cancelled'
3. Function sends notification to owner with message: "❌ Customer Cancelled - {name} cancelled their booking for {service} at {time}"
4. Booking record may be deleted from database
5. Foreground service stops
6. Notification is dismissed

## Troubleshooting

### Foreground Service doesn't start
- Check if `startForegroundService()` is called correctly
- Verify `ForegroundServiceType` in manifest
- Ensure `createNotification()` returns a valid notification

### Yes/No buttons don't trigger
- Verify BroadcastReceiver is registered in manifest
- Check PendingIntent flags (use FLAG_IMMUTABLE for Android 12+)
- Ensure JavaScript bridge is properly connected

### Owner doesn't receive notification
- Verify owner's user ID is correctly fetched from database
- Check OneSignal configuration and API keys
- Ensure owner has OneSignal external_id set

### Notification doesn't ring at scheduled time
- Verify `triggerTimeMs` is correctly calculated in React
- Check if device is in Do Not Disturb mode
- Verify notification permissions are granted
