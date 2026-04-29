package com.bookbarber.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.util.Log

class BootReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "BootReceiver"
        private const val PREFS_NAME = "alarm_reminders_prefs"

        @JvmStatic
        fun saveAlarmForBoot(context: Context, bookingId: String, tokenNumber: Int,
                             shopName: String, timeSlot: String, triggerAtMillis: Long) {
            try {
                val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                val alarmId = "alarm_$bookingId"
                prefs.edit().apply {
                    putString("${alarmId}_bookingId", bookingId)
                    putInt("${alarmId}_tokenNumber", tokenNumber)
                    putString("${alarmId}_shopName", shopName)
                    putString("${alarmId}_timeSlot", timeSlot)
                    putLong("${alarmId}_triggerAtMillis", triggerAtMillis)
                    
                    val pendingAlarms = prefs.getStringSet("pending_alarms", HashSet<String>())?.toMutableSet() ?: mutableSetOf()
                    pendingAlarms.add(bookingId)
                    putStringSet("pending_alarms", pendingAlarms)
                    apply()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error saving alarm for boot", e)
            }
        }

        @JvmStatic
        fun removeAlarmFromPrefs(context: Context, bookingId: String) {
            try {
                val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                val alarmId = "alarm_$bookingId"
                prefs.edit().apply {
                    remove("${alarmId}_bookingId")
                    remove("${alarmId}_tokenNumber")
                    remove("${alarmId}_shopName")
                    remove("${alarmId}_timeSlot")
                    remove("${alarmId}_triggerAtMillis")
                    
                    val pendingAlarms = prefs.getStringSet("pending_alarms", HashSet<String>())?.toMutableSet() ?: mutableSetOf()
                    pendingAlarms.remove(bookingId)
                    putStringSet("pending_alarms", pendingAlarms)
                    apply()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error removing alarm from prefs", e)
            }
        }
    }

    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action == Intent.ACTION_BOOT_COMPLETED) {
            Log.d(TAG, "Device boot completed - rescheduling alarms")
            rescheduleAllAlarms(context)
        }
    }

    private fun rescheduleAllAlarms(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val alarmIds = prefs.getStringSet("pending_alarms", null) ?: return

        for (bookingId in alarmIds) {
            val prefKey = "alarm_$bookingId"
            val triggerAtMillis = prefs.getLong("${prefKey}_triggerAtMillis", 0)
            
            if (triggerAtMillis > System.currentTimeMillis()) {
                val tokenNumber = prefs.getInt("${prefKey}_tokenNumber", 0)
                val shopName = prefs.getString("${prefKey}_shopName", "") ?: ""
                val timeSlot = prefs.getString("${prefKey}_timeSlot", "") ?: ""
                
                AlarmReceiver.scheduleAlarm(context, bookingId, tokenNumber, shopName, timeSlot, triggerAtMillis)
            } else {
                removeAlarmFromPrefs(context, bookingId)
            }
        }
        restoreForegroundAlarmService(context)
    }

    private fun restoreForegroundAlarmService(context: Context) {
        val prefs = context.getSharedPreferences("foreground_alarm_prefs", Context.MODE_PRIVATE)
        if (prefs.getBoolean("is_active", false)) {
            val alarmTime = prefs.getLong("alarm_trigger_time", 0)
            val bookingId = prefs.getString("booking_id", "") ?: ""
            
            if (alarmTime > System.currentTimeMillis() && bookingId.isNotEmpty()) {
                val intent = Intent(context, ForegroundAlarmService::class.java).apply {
                    action = ForegroundAlarmService.ACTION_START_TIMER
                    putExtra(ForegroundAlarmService.EXTRA_TRIGGER_TIME_MS, alarmTime)
                    putExtra(ForegroundAlarmService.EXTRA_BOOKING_ID, bookingId)
                    putExtra(ForegroundAlarmService.EXTRA_TOKEN_NUMBER, prefs.getInt("token_number", 0))
                    putExtra(ForegroundAlarmService.EXTRA_SHOP_NAME, prefs.getString("shop_name", ""))
                    putExtra(ForegroundAlarmService.EXTRA_TIME_SLOT, prefs.getString("time_slot", ""))
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            }
        }
    }
}
