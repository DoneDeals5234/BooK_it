package com.bookbarber.app

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class MyFirebaseMessagingService : FirebaseMessagingService() {

    companion object {
        private const val TAG = "MyFCMService"
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        Log.d(TAG, "🔥 FCM Message Received from: ${remoteMessage.from}")
        
        val notification = remoteMessage.notification
        val data = remoteMessage.data
        val title = notification?.title ?: data["title"] ?: "New Notification"
        val body = notification?.body ?: data["body"] ?: ""
        val imageUrl = notification?.imageUrl?.toString() ?: data["image"]
        
        Log.d(TAG, "🔔 Notification Content: $title / $body (Image: $imageUrl)")

        // 1. Handle Order Ringing (Loud Alarm) - ALWAYS trigger if conditions met
        if (data.isNotEmpty()) {
            val type = data["type"]
            if (type == "new_order" || type == "order_received") {
                if (isServiceRunning(this, ShopOnlineService::class.java)) {
                    Log.d(TAG, "🟢 Shop Online! Starting loud alarm...")
                    triggerOrderAlarm(data)
                }
            }
        }

        // 2. Display Notification
        // Rule: If app is in FOREGROUND, system suppresses notification. We must show it manually.
        // If app is in BACKGROUND, system usually shows it IF 'notification' block exists.
        // However, to be 100% sure (since user says background is also failing), 
        // we will show it manually if it's a DATA message or if it's a high-priority chat.
        
        val isForeground = isAppInForeground()
        Log.d(TAG, "📱 App in Foreground: $isForeground")
        
        if (isForeground || notification == null) {
            Log.d(TAG, "🛠 Showing manual notification (Foreground or Data-only)")
            showTrayNotification(title, body, data, imageUrl)
        } else {
            Log.d(TAG, "⏭️ App in background, letting System/Capacitor handle notification block")
        }
        
        super.onMessageReceived(remoteMessage)
    }

    private fun isAppInForeground(): Boolean {
        val activityManager = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val appProcesses = activityManager.runningAppProcesses ?: return false
        val packageName = packageName
        for (appProcess in appProcesses) {
            if (appProcess.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND && 
                appProcess.processName == packageName) {
                return true
            }
        }
        return false
    }

    private fun showTrayNotification(title: String, body: String, data: Map<String, String>, imageUrl: String? = null) {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
        
        val type = data["type"] ?: ""
        val isChat = type.contains("chat")
        val channelId = if (isChat) "chat_popup_v3" else "high_priority_v3"
        
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            for ((key, value) in data) {
                putExtra(key, value)
            }
        }
        
        val pendingIntent = android.app.PendingIntent.getActivity(
            this, System.currentTimeMillis().toInt(), intent,
            android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
        )

        val builder = androidx.core.app.NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setPriority(androidx.core.app.NotificationCompat.PRIORITY_HIGH)
            .setDefaults(androidx.core.app.NotificationCompat.DEFAULT_ALL)
            .setContentIntent(pendingIntent)
            .setVisibility(androidx.core.app.NotificationCompat.VISIBILITY_PUBLIC)

        // --- 🖼️ Enhanced Image Download for "Big Picture Style" ---
        if (!imageUrl.isNullOrEmpty() && imageUrl.startsWith("http")) {
            Log.d(TAG, "🖼️ Attempting to download image: $imageUrl")
            val thread = Thread {
                try {
                    val url = java.net.URL(imageUrl)
                    val connection = url.openConnection() as java.net.HttpURLConnection
                    connection.doInput = true
                    connection.connectTimeout = 5000 // 5 seconds timeout
                    connection.readTimeout = 5000
                    connection.connect()
                    
                    val input = connection.inputStream
                    val bitmap = android.graphics.BitmapFactory.decodeStream(input)
                    
                    if (bitmap != null) {
                        Log.d(TAG, "✅ Image downloaded successfully (${bitmap.width}x${bitmap.height})")
                        builder.setLargeIcon(bitmap)
                        builder.setStyle(androidx.core.app.NotificationCompat.BigPictureStyle()
                            .bigPicture(bitmap)
                            .setBigContentTitle(title)
                            .setSummaryText(body))
                    } else {
                        Log.w(TAG, "⚠️ Bitmap decoding failed for URL: $imageUrl")
                        builder.setStyle(androidx.core.app.NotificationCompat.BigTextStyle().bigText(body))
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Error in image download thread: ${e.message}")
                    builder.setStyle(androidx.core.app.NotificationCompat.BigTextStyle().bigText(body))
                } finally {
                    // ALWAYS notify at the end of the thread
                    val notificationId = (System.currentTimeMillis() % 10000).toInt()
                    notificationManager.notify(notificationId, builder.build())
                }
            }
            thread.start()
        } else {
            // No image or invalid URL - Show text only immediately
            Log.d(TAG, "📄 No image URL provided, showing text-only notification")
            builder.setStyle(androidx.core.app.NotificationCompat.BigTextStyle().bigText(body))
            val notificationId = (System.currentTimeMillis() % 10000).toInt()
            notificationManager.notify(notificationId, builder.build())
        }
    }

    private fun triggerOrderAlarm(data: Map<String, String>) {
        val serviceIntent = Intent(this, OrderAlarmService::class.java).apply {
            putExtra("order_id", data["order_id"])
            putExtra("customer_name", data["customer_name"])
            putExtra("amount", data["amount"])
            putExtra("quantity", data["quantity"])
            putExtra("delivery_type", data["delivery_type"])
        }
        
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent)
            } else {
                startService(serviceIntent)
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to start OrderAlarmService", e)
        }
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "🔑 Refreshed FCM token: $token")
        // Token is typically handled by the Capacitor plugin and saved to Supabase from JS
    }

    private fun isServiceRunning(context: Context, serviceClass: Class<*>): Boolean {
        val manager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        @Suppress("DEPRECATION")
        for (service in manager.getRunningServices(Int.MAX_VALUE)) {
            if (serviceClass.name == service.service.className) {
                return true
            }
        }
        return false
    }
}
