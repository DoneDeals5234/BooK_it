package com.bookbarber.app

import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.annotation.Keep
import com.onesignal.notifications.INotificationReceivedEvent
import com.onesignal.notifications.INotificationServiceExtension
import org.json.JSONObject

@Keep
class OrderNotificationExtension : INotificationServiceExtension {
    companion object {
        private const val TAG = "OrderNotificationExtension"
    }

    override fun onNotificationReceived(event: INotificationReceivedEvent) {
        val notification = event.notification
        val additionalData = notification.additionalData
        
        Log.d(TAG, "🔔 Background Notification Received: ${notification.title}")
        Log.d(TAG, "📋 Additional Data: $additionalData")

        if (additionalData != null && additionalData.has("type")) {
            val type = additionalData.optString("type")
            Log.d(TAG, "🎯 Notification Type: $type")

            if (type == "new_order" || type == "order_received" || type == "start_foreground_service") {
                Log.d(TAG, "🆕 Notification Trigger detected ($type)! Starting OrderAlarmService...")
                
                val context = event.context
                val serviceIntent = Intent(context, OrderAlarmService::class.java)
                
                // Extract all details for the ringing notification
                serviceIntent.putExtra("order_id", additionalData.optString("order_id"))
                serviceIntent.putExtra("customer_name", additionalData.optString("customer_name"))
                serviceIntent.putExtra("amount", additionalData.optString("amount"))
                serviceIntent.putExtra("quantity", additionalData.optString("quantity"))
                serviceIntent.putExtra("delivery_type", additionalData.optString("delivery_type"))

                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        context.startForegroundService(serviceIntent)
                    } else {
                        context.startService(serviceIntent)
                    }
                    Log.d(TAG, "✅ OrderAlarmService started successfully")
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Failed to start OrderAlarmService", e)
                }
            }
        }
        
        // Let the notification display normally after we've triggered our alarm
        // Unless we want to prevent it, then we'd call event.preventDefault()
    }
}
