package com.bookbarber.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import android.util.Log

object LocalNotificationScheduler {
    private const val CHANNEL_ID = "offline_notifications"
    private const val TAG = "LocalNotification"

    fun sendTestNotification(context: Context) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        
        createChannel(manager)

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setContentTitle("Test Offline Notification 📴")
            .setContentText("This notification was sent locally without internet.")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .build()

        manager.notify(3000, notification)
        Log.d(TAG, "Test notification sent")
    }

    private fun createChannel(manager: NotificationManager) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Offline Notifications",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Used for local/offline alerts"
            }
            manager.createNotificationChannel(channel)
        }
    }
}
