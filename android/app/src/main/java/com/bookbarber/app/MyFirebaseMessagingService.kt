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
        super.onMessageReceived(remoteMessage)
        
        Log.d(TAG, "🔥 FCM Message Received from: ${remoteMessage.from}")
        
        // 1. Check for notification data
        remoteMessage.notification?.let {
            Log.d(TAG, "🔔 Message Notification Title: ${it.title}")
            Log.d(TAG, "🔔 Message Notification Body: ${it.body}")
        }

        // 2. Check for custom data payload
        val data = remoteMessage.data
        if (data.isNotEmpty()) {
            Log.d(TAG, "📋 Message data payload: $data")
            
            val type = data["type"]
            if (type == "new_order" || type == "order_received") {
                Log.d(TAG, "🆕 New Order detected! Checking shop status...")
                
                // Only ring if shop is online (Foreground Service is running)
                if (isServiceRunning(this, ShopOnlineService::class.java)) {
                    Log.d(TAG, "🟢 Shop is Online! Starting OrderAlarmService (Ringing)...")
                    
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
                        Log.d(TAG, "✅ OrderAlarmService triggered")
                    } catch (e: Exception) {
                        Log.e(TAG, "❌ Failed to start OrderAlarmService", e)
                    }
                } else {
                    Log.d(TAG, "⚪ Shop is Offline. Skipping ringing.")
                }
            }
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
