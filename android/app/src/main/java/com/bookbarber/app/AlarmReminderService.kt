package com.bookbarber.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat

class AlarmReminderService : Service() {
    private var soundManager: AlarmSoundManager? = null
    private var screenWakeLock: PowerManager.WakeLock? = null
    private var currentBookingId: String? = null

    private val binder = LocalBinder()

    inner class LocalBinder : Binder() {
        fun getService(): AlarmReminderService = this@AlarmReminderService
    }

    companion object {
        private const val TAG = "AlarmReminderService"
        private const val NOTIFICATION_ID = 9999
        private const val CHANNEL_ID = "alarm_reminders_service"

        const val ACTION_START_ALARM = "com.bookbarber.app.START_ALARM"
        const val ACTION_STOP_ALARM = "com.bookbarber.app.STOP_ALARM"
        const val ACTION_SNOOZE_ALARM = "com.bookbarber.app.SNOOZE_ALARM"

        const val EXTRA_BOOKING_ID = "booking_id"
        const val EXTRA_TOKEN_NUMBER = "token_number"
        const val EXTRA_SHOP_NAME = "shop_name"
        const val EXTRA_TIME_SLOT = "time_slot"
    }

    override fun onCreate() {
        super.onCreate()
        soundManager = AlarmSoundManager.getInstance(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: return START_STICKY

        when (action) {
            ACTION_START_ALARM -> handleStartAlarm(intent)
            ACTION_STOP_ALARM -> handleStopAlarm()
            ACTION_SNOOZE_ALARM -> handleSnoozeAlarm(intent)
        }

        return START_STICKY
    }

    private fun handleStartAlarm(intent: Intent) {
        currentBookingId = intent.getStringExtra(EXTRA_BOOKING_ID)
        val tokenNumber = intent.getIntExtra(EXTRA_TOKEN_NUMBER, 0)
        val shopName = intent.getStringExtra(EXTRA_SHOP_NAME) ?: ""
        val timeSlot = intent.getStringExtra(EXTRA_TIME_SLOT) ?: ""

        createNotificationChannel()
        wakeUpScreen()
        soundManager?.startAlarmSound()

        val notification = createAlarmNotification(currentBookingId ?: "", tokenNumber, shopName, timeSlot)
        startForeground(NOTIFICATION_ID, notification)

        openAppWithAlarm(currentBookingId ?: "", tokenNumber, shopName, timeSlot)
    }

    private fun handleStopAlarm() {
        soundManager?.stopAlarmSound()
        releaseScreenWakeLock()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun handleSnoozeAlarm(intent: Intent) {
        val minutes = intent.getIntExtra("minutes", 5)
        val bId = intent.getStringExtra(EXTRA_BOOKING_ID) ?: ""
        val token = intent.getIntExtra(EXTRA_TOKEN_NUMBER, 0)
        val sName = intent.getStringExtra(EXTRA_SHOP_NAME) ?: ""
        val tSlot = intent.getStringExtra(EXTRA_TIME_SLOT) ?: ""

        val snoozeTimeMillis = System.currentTimeMillis() + (minutes * 60 * 1000L)
        AlarmReceiver.scheduleAlarm(this, bId, token, sName, tSlot, snoozeTimeMillis)
        BootReceiver.saveAlarmForBoot(this, bId, token, sName, tSlot, snoozeTimeMillis)
        
        handleStopAlarm()
    }

    private fun wakeUpScreen() {
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        screenWakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK or PowerManager.ON_AFTER_RELEASE, "BookBarber:ScreenWakeLock").apply {
            acquire(60000)
        }
    }

    private fun releaseScreenWakeLock() {
        if (screenWakeLock?.isHeld == true) screenWakeLock?.release()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "Appointment Alarms", NotificationManager.IMPORTANCE_MAX).apply {
                enableLights(true)
                enableVibration(true)
                setSound(null, null)
            }
            getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
        }
    }

    private fun createAlarmNotification(bookingId: String, token: Int, shop: String, slot: String): Notification {
        val dismissIntent = Intent(this, AlarmReminderService::class.java).apply {
            action = ACTION_STOP_ALARM
            putExtra(EXTRA_BOOKING_ID, bookingId)
        }
        val dismissPendingIntent = PendingIntent.getService(this, (bookingId + "_dismiss").hashCode(), dismissIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

        val snoozeIntent = Intent(this, AlarmReminderService::class.java).apply {
            action = ACTION_SNOOZE_ALARM
            putExtra(EXTRA_BOOKING_ID, bookingId)
            putExtra(EXTRA_TOKEN_NUMBER, token)
            putExtra(EXTRA_SHOP_NAME, shop)
            putExtra(EXTRA_TIME_SLOT, slot)
            putExtra("minutes", 5)
        }
        val snoozePendingIntent = PendingIntent.getService(this, (bookingId + "_snooze").hashCode(), snoozeIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

        val appIntent = Intent(this, MainActivity::class.java).apply {
            action = AlarmReceiver.ACTION_ALARM
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            putExtra(EXTRA_BOOKING_ID, bookingId)
            putExtra(EXTRA_TOKEN_NUMBER, token)
            putExtra(EXTRA_SHOP_NAME, shop)
            putExtra(EXTRA_TIME_SLOT, slot)
        }
        val appPendingIntent = PendingIntent.getActivity(this, bookingId.hashCode(), appIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("🔔 Booking Request")
            .setContentText("Are you free at $slot?")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setFullScreenIntent(appPendingIntent, true)
            .setContentIntent(appPendingIntent)
            .setAutoCancel(true)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "No", dismissPendingIntent)
            .addAction(android.R.drawable.ic_dialog_info, "Yes", snoozePendingIntent)
            .build()
    }

    private fun openAppWithAlarm(bookingId: String, token: Int, shop: String, slot: String) {
        val appIntent = Intent(this, MainActivity::class.java).apply {
            action = AlarmReceiver.ACTION_ALARM
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            putExtra(EXTRA_BOOKING_ID, bookingId)
            putExtra(EXTRA_TOKEN_NUMBER, token)
            putExtra(EXTRA_SHOP_NAME, shop)
            putExtra(EXTRA_TIME_SLOT, slot)
        }
        startActivity(appIntent)
    }

    override fun onDestroy() {
        soundManager?.stopAlarmSound()
        releaseScreenWakeLock()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder = binder
}
