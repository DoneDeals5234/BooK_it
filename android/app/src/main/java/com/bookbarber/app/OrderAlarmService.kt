package com.bookbarber.app

import android.app.*
import android.content.Context
import android.content.Intent
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import android.util.Log
import android.os.PowerManager

class OrderAlarmService : Service() {
    private var mediaPlayer: MediaPlayer? = null
    private var currentOrderId: String? = null
    private var wakeLock: PowerManager.WakeLock? = null

    companion object {
        const val TAG = "OrderAlarmService"
        const val CHANNEL_ID = "order_alarm_channel"
        const val NOTIFICATION_ID = 2000
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "Starting OrderAlarmService")
        
        currentOrderId = intent?.getStringExtra("order_id")
        val customerName = intent?.getStringExtra("customer_name") ?: "Customer"
        val amount = intent?.getStringExtra("amount") ?: "0"
        val quantity = intent?.getStringExtra("quantity") ?: "1"
        val deliveryType = intent?.getStringExtra("delivery_type") ?: "pickup"

        // Start playing alarm sound
        startAlarmSound()

        // Create the notification with buttons
        val notification = createNotification(customerName, amount, quantity, deliveryType)
        startForeground(NOTIFICATION_ID, notification)

        return START_NOT_STICKY
    }

    private fun startAlarmSound() {
        try {
            // Acquire WakeLock to turn on screen
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = powerManager.newWakeLock(
                PowerManager.SCREEN_BRIGHT_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP or PowerManager.ON_AFTER_RELEASE,
                "BookBarber:OrderAlarm"
            )
            wakeLock?.acquire(30000) // 30 seconds

            val alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            mediaPlayer = MediaPlayer.create(this, alarmUri)
            mediaPlayer?.isLooping = true
            mediaPlayer?.start()
        } catch (e: Exception) {
            Log.e(TAG, "Error playing alarm sound", e)
        }
    }

    private fun createNotification(
        customerName: String,
        amount: String,
        quantity: String,
        deliveryType: String
    ): Notification {
        val deliveryLabel = if (deliveryType == "delivery") "🚚 HOME DELIVERY" else "🛍️ SHOP PICKUP"
        val detailText = "$deliveryLabel | ₹$amount ($quantity items)"

        val acceptIntent = Intent(this, OrderActionReceiver::class.java).apply {
            action = OrderActionReceiver.ACTION_ACCEPT
            putExtra("order_id", currentOrderId)
        }
        val rejectIntent = Intent(this, OrderActionReceiver::class.java).apply {
            action = OrderActionReceiver.ACTION_REJECT
            putExtra("order_id", currentOrderId)
        }

        val acceptPendingIntent = PendingIntent.getBroadcast(
            this, 0, acceptIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val rejectPendingIntent = PendingIntent.getBroadcast(
            this, 1, rejectIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val fullScreenIntent = Intent(this, MainActivity::class.java).apply {
            putExtra("order_id", currentOrderId)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val fullScreenPendingIntent = PendingIntent.getActivity(
            this, 0, fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("New Order from $customerName")
            .setContentText(detailText)
            .setSmallIcon(R.drawable.ic_notification_b)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setOngoing(true)
            .setAutoCancel(false)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setStyle(NotificationCompat.BigTextStyle().bigText("Details: $detailText\n\nPlease accept or reject the order now."))
            .addAction(R.drawable.ic_notification_b, "Accept", acceptPendingIntent)
            .addAction(R.drawable.ic_notification_b, "Reject", rejectPendingIntent)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Order Alarms",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for incoming orders with alarm sound"
                setSound(null, null) // We handle sound via MediaPlayer
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        mediaPlayer?.stop()
        mediaPlayer?.release()
        if (wakeLock?.isHeld == true) {
            wakeLock?.release()
        }
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
