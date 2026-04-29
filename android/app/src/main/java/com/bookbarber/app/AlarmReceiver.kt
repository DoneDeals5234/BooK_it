package com.bookbarber.app

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.PowerManager
import android.util.Log
import java.util.*

class AlarmReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "AlarmReceiver"
        const val ACTION_ALARM = "com.bookbarber.app.ALARM_REMINDER"
        const val EXTRA_BOOKING_ID = "booking_id"
        const val EXTRA_TOKEN_NUMBER = "token_number"
        const val EXTRA_SHOP_NAME = "shop_name"
        const val EXTRA_TIME_SLOT = "time_slot"

        @JvmStatic
        fun scheduleAlarm(context: Context, bookingId: String, tokenNumber: Int,
                          shopName: String, timeSlot: String, triggerAtMillis: Long) {
            try {
                val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
                val intent = Intent(context, AlarmReceiver::class.java).apply {
                    action = ACTION_ALARM
                    putExtra(EXTRA_BOOKING_ID, bookingId)
                    putExtra(EXTRA_TOKEN_NUMBER, tokenNumber)
                    putExtra(EXTRA_SHOP_NAME, shopName)
                    putExtra(EXTRA_TIME_SLOT, timeSlot)
                }

                val pendingIntent = PendingIntent.getBroadcast(
                    context, bookingId.hashCode(), intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    if (context.checkSelfPermission(android.Manifest.permission.SCHEDULE_EXACT_ALARM) == PackageManager.PERMISSION_GRANTED) {
                        alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
                    } else {
                        alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
                    }
                } else {
                    alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
                }

                Log.d(TAG, "⏰ Alarm scheduled for: $bookingId at ${Date(triggerAtMillis)}")
                
                // Still use the Java SystemClockAlarmManager if available
                SystemClockAlarmManager.addAlarmToSystemCalendar(context, bookingId, tokenNumber, shopName, timeSlot, triggerAtMillis)
            } catch (e: Exception) {
                Log.e(TAG, "Error scheduling alarm", e)
            }
        }

        @JvmStatic
        fun cancelAlarm(context: Context, bookingId: String) {
            try {
                val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
                val intent = Intent(context, AlarmReceiver::class.java).apply {
                    action = ACTION_ALARM
                    putExtra(EXTRA_BOOKING_ID, bookingId)
                }

                val pendingIntent = PendingIntent.getBroadcast(
                    context, bookingId.hashCode(), intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )

                alarmManager.cancel(pendingIntent)
                SystemClockAlarmManager.removeAlarmFromSystemCalendar(context, bookingId)
                BootReceiver.removeAlarmFromPrefs(context, bookingId)
            } catch (e: Exception) {
                Log.e(TAG, "Error cancelling alarm", e)
            }
        }
    }

    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        Log.d(TAG, "Alarm received with action: $action")

        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        val wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK or PowerManager.ON_AFTER_RELEASE, "BookBarber:AlarmWakeLock")
        wl.acquire(10000)

        try {
            if (action == ACTION_ALARM) {
                handleAlarmReminder(context, intent)
            }
        } finally {
            if (wl.isHeld) wl.release()
        }
    }

    private fun handleAlarmReminder(context: Context, intent: Intent) {
        val bookingId = intent.getStringExtra(EXTRA_BOOKING_ID) ?: ""
        val tokenNumber = intent.getIntExtra(EXTRA_TOKEN_NUMBER, 0)
        val shopName = intent.getStringExtra(EXTRA_SHOP_NAME) ?: ""
        val timeSlot = intent.getStringExtra(EXTRA_TIME_SLOT) ?: ""

        val serviceIntent = Intent(context, AlarmReminderService::class.java).apply {
            action = AlarmReminderService.ACTION_START_ALARM
            putExtra(AlarmReminderService.EXTRA_BOOKING_ID, bookingId)
            putExtra(AlarmReminderService.EXTRA_TOKEN_NUMBER, tokenNumber)
            putExtra(AlarmReminderService.EXTRA_SHOP_NAME, shopName)
            putExtra(AlarmReminderService.EXTRA_TIME_SLOT, timeSlot)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent)
        } else {
            context.startService(serviceIntent)
        }

        BootReceiver.removeAlarmFromPrefs(context, bookingId)
        Log.d(TAG, "✅ Alarm service started")
    }
}
