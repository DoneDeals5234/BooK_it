package com.bookbarber.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.*
import android.util.Log
import androidx.core.app.NotificationCompat

class ForegroundAlarmService : Service() {
    private var timerHandler: Handler? = null
    private var timerRunnable: Runnable? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var alarmTriggerTimeMs: Long = 0
    private var currentBookingId: String = ""
    private var currentTokenNumber: Int = 0
    private var currentShopName: String = ""
    private var currentTimeSlot: String = ""

    private val binder = LocalBinder()

    inner class LocalBinder : Binder() {
        fun getService(): ForegroundAlarmService = this@ForegroundAlarmService
    }

    companion object {
        private const val TAG = "ForegroundAlarmService"
        private const val NOTIFICATION_ID = 10000
        private const val CHANNEL_ID = "foreground_alarm_service"
        private const val PREFS_NAME = "foreground_alarm_prefs"
        private const val CHECK_INTERVAL: Long = 1000

        const val ACTION_START_TIMER = "com.bookbarber.app.START_FOREGROUND_TIMER"
        const val ACTION_STOP_TIMER = "com.bookbarber.app.STOP_FOREGROUND_TIMER"
        const val ACTION_TRIGGER_ALARM = "com.bookbarber.app.TRIGGER_FOREGROUND_ALARM"

        const val EXTRA_BOOKING_ID = "booking_id"
        const val EXTRA_TOKEN_NUMBER = "token_number"
        const val EXTRA_SHOP_NAME = "shop_name"
        const val EXTRA_TIME_SLOT = "time_slot"
        const val EXTRA_TRIGGER_TIME_MS = "trigger_time_ms"
    }

    override fun onCreate() {
        super.onCreate()
        timerHandler = Handler(Looper.getMainLooper())
        createNotificationChannel()
        acquireWakeLock()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: return START_STICKY

        when (action) {
            ACTION_START_TIMER -> handleStartTimer(intent)
            ACTION_STOP_TIMER -> handleStopTimer()
            ACTION_TRIGGER_ALARM -> handleTriggerAlarm(intent)
        }

        return START_STICKY
    }

    private fun handleStartTimer(intent: Intent) {
        alarmTriggerTimeMs = intent.getLongExtra(EXTRA_TRIGGER_TIME_MS, 0)
        currentBookingId = intent.getStringExtra(EXTRA_BOOKING_ID) ?: ""
        currentTokenNumber = intent.getIntExtra(EXTRA_TOKEN_NUMBER, 0)
        currentShopName = intent.getStringExtra(EXTRA_SHOP_NAME) ?: ""
        currentTimeSlot = intent.getStringExtra(EXTRA_TIME_SLOT) ?: ""

        if (alarmTriggerTimeMs <= 0 || currentBookingId.isEmpty()) return

        savePersistenceData()
        startForeground(NOTIFICATION_ID, createForegroundNotification(alarmTriggerTimeMs - System.currentTimeMillis()))
        startAlarmTimer()
    }

    private fun startAlarmTimer() {
        timerRunnable?.let { timerHandler?.removeCallbacks(it) }
        timerRunnable = object : Runnable {
            override fun run() {
                val currentTimeMs = System.currentTimeMillis()
                val timeUntilAlarm = alarmTriggerTimeMs - currentTimeMs

                if (currentTimeMs % 10000 < 1000) {
                    val manager = getSystemService(NotificationManager::class.java)
                    manager?.notify(NOTIFICATION_ID, createForegroundNotification(timeUntilAlarm))
                }

                if (currentTimeMs >= alarmTriggerTimeMs) {
                    triggerAlarmSound()
                    return
                }
                timerHandler?.postDelayed(this, CHECK_INTERVAL)
            }
        }
        timerHandler?.post(timerRunnable!!)
    }

    private fun handleStopTimer() {
        timerRunnable?.let { timerHandler?.removeCallbacks(it) }
        clearPersistenceData()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun handleTriggerAlarm(intent: Intent) {
        val bId = intent.getStringExtra(EXTRA_BOOKING_ID) ?: ""
        val token = intent.getIntExtra(EXTRA_TOKEN_NUMBER, 0)
        val sName = intent.getStringExtra(EXTRA_SHOP_NAME) ?: ""
        val tSlot = intent.getStringExtra(EXTRA_TIME_SLOT) ?: ""
        triggerAlarmSoundWithDetails(bId, token, sName, tSlot)
    }

    private fun triggerAlarmSound() {
        triggerAlarmSoundWithDetails(currentBookingId, currentTokenNumber, currentShopName, currentTimeSlot)
    }

    private fun triggerAlarmSoundWithDetails(bookingId: String, token: Int, shop: String, slot: String) {
        val alarmIntent = Intent(this, AlarmReminderService::class.java).apply {
            action = AlarmReminderService.ACTION_START_ALARM
            putExtra(AlarmReminderService.EXTRA_BOOKING_ID, bookingId)
            putExtra(AlarmReminderService.EXTRA_TOKEN_NUMBER, token)
            putExtra(AlarmReminderService.EXTRA_SHOP_NAME, shop)
            putExtra(AlarmReminderService.EXTRA_TIME_SLOT, slot)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(alarmIntent)
        } else {
            startService(alarmIntent)
        }
        handleStopTimer()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "Foreground Timer", NotificationManager.IMPORTANCE_LOW)
            getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
        }
    }

    private fun createForegroundNotification(timeUntilAlarmMs: Long): Notification {
        val timeText = if (timeUntilAlarmMs <= 0) "Alarm triggered!" 
                      else "Alarm in ${timeUntilAlarmMs / 60000}:${(timeUntilAlarmMs % 60000 / 1000).toString().padStart(2, '0')} min"
        
        val stopIntent = Intent(this, ForegroundAlarmService::class.java).apply { action = ACTION_STOP_TIMER }
        val stopPendingIntent = PendingIntent.getService(this, 0, stopIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("⏰ Timer Running")
            .setContentText(timeText)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop", stopPendingIntent)
            .build()
    }

    private fun acquireWakeLock() {
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "ForegroundAlarmService:WakeLock").apply {
            acquire()
        }
    }

    private fun savePersistenceData() {
        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().apply {
            putLong("alarm_trigger_time", alarmTriggerTimeMs)
            putString("booking_id", currentBookingId)
            putInt("token_number", currentTokenNumber)
            putString("shop_name", currentShopName)
            putString("time_slot", currentTimeSlot)
            putBoolean("is_active", true)
            apply()
        }
    }

    private fun clearPersistenceData() {
        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().putBoolean("is_active", false).apply()
    }

    override fun onDestroy() {
        timerRunnable?.let { timerHandler?.removeCallbacks(it) }
        if (wakeLock?.isHeld == true) wakeLock?.release()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?) = binder
}
