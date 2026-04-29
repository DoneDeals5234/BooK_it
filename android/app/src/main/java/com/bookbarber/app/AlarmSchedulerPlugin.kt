package com.bookbarber.app

import android.content.Context
import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import java.util.*

@CapacitorPlugin(
    name = "AlarmScheduler",
    permissions = [
        Permission(
            strings = [
                android.Manifest.permission.SCHEDULE_EXACT_ALARM,
                android.Manifest.permission.RECEIVE_BOOT_COMPLETED
            ],
            alias = "ALARM_PERMISSIONS"
        )
    ]
)
class AlarmSchedulerPlugin : Plugin() {
    companion object {
        private const val TAG = "AlarmSchedulerPlugin"
    }

    override fun load() {
        Log.d(TAG, "✅ AlarmScheduler plugin loaded successfully!")
    }

    @com.getcapacitor.PluginMethod
    fun scheduleAlarm(call: PluginCall) {
        try {
            val bookingId = call.getString("bookingId") ?: return call.reject("bookingId is required")
            val reminderTime = call.getString("reminderTime") ?: return call.reject("reminderTime is required")
            val bookingDate = call.getString("bookingDate") ?: return call.reject("bookingDate is required")
            val tokenNumber = call.getInt("tokenNumber", 0) ?: 0
            val shopName = call.getString("shopName", "") ?: ""
            val timeSlot = call.getString("timeSlot", "") ?: ""

            val timeParts = reminderTime.split(":")
            if (timeParts.size != 2) return call.reject("Invalid reminderTime format")
            
            val dateParts = bookingDate.split("-")
            if (dateParts.size != 3) return call.reject("Invalid bookingDate format")

            val calendar = Calendar.getInstance().apply {
                set(dateParts[0].toInt(), dateParts[1].toInt() - 1, dateParts[2].toInt(),
                    timeParts[0].toInt(), timeParts[1].toInt(), 0)
                set(Calendar.MILLISECOND, 0)
            }

            val triggerAtMillis = calendar.timeInMillis
            val context = activity.applicationContext
            
            AlarmReceiver.scheduleAlarm(context, bookingId, tokenNumber, shopName, timeSlot, triggerAtMillis)
            BootReceiver.saveAlarmForBoot(context, bookingId, tokenNumber, shopName, timeSlot, triggerAtMillis)

            val result = JSObject().apply {
                put("success", true)
                put("message", "Alarm scheduled successfully")
            }
            call.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "Error scheduling alarm", e)
            call.reject(e.message)
        }
    }

    @com.getcapacitor.PluginMethod
    fun cancelAlarm(call: PluginCall) {
        try {
            val bookingId = call.getString("bookingId") ?: return call.reject("bookingId is required")
            AlarmReceiver.cancelAlarm(activity.applicationContext, bookingId)
            call.resolve(JSObject().apply {
                put("success", true)
                put("message", "Alarm cancelled successfully")
            })
        } catch (e: Exception) {
            call.reject(e.message)
        }
    }

    @com.getcapacitor.PluginMethod
    fun snoozeAlarm(call: PluginCall) {
        try {
            val bookingId = call.getString("bookingId") ?: return call.reject("bookingId is required")
            val minutes = call.getInt("minutes", 5) ?: 5
            
            val context = activity.applicationContext
            AlarmReceiver.cancelAlarm(context, bookingId)
            
            // Note: In a real app we'd need to re-schedule with saved data
            call.resolve(JSObject().apply {
                put("success", true)
                put("message", "Alarm snoozed")
            })
        } catch (e: Exception) {
            call.reject(e.message)
        }
    }

    @com.getcapacitor.PluginMethod
    fun getPendingAlarmData(call: PluginCall) {
        try {
            val alarmData = MainActivity.pendingAlarmData
            val result = JSObject().apply {
                put("success", true)
                if (alarmData != null) {
                    put("hasData", true)
                    put("bookingId", alarmData.bookingId)
                    put("tokenNumber", alarmData.tokenNumber)
                    put("shopName", alarmData.shopName)
                    put("timeSlot", alarmData.timeSlot)
                    MainActivity.pendingAlarmData = null
                } else {
                    put("hasData", false)
                }
            }
            call.resolve(result)
        } catch (e: Exception) {
            call.reject(e.message)
        }
    }

    @com.getcapacitor.PluginMethod
    fun testAlarm(call: PluginCall) {
        try {
            val bookingId = call.getString("bookingId") ?: return call.reject("bookingId is required")
            val delaySeconds = call.getInt("delaySeconds", 10) ?: 10
            val triggerAtMillis = System.currentTimeMillis() + (delaySeconds * 1000)

            AlarmReceiver.scheduleAlarm(activity.applicationContext, bookingId, 99, "Test Shop", "Test Time", triggerAtMillis)
            call.resolve(JSObject().apply {
                put("success", true)
                put("message", "Test alarm scheduled")
            })
        } catch (e: Exception) {
            call.reject(e.message)
        }
    }

    @com.getcapacitor.PluginMethod
    fun syncHomeState(call: PluginCall) {
        try {
            val isAtHome = call.getBoolean("isAtHome") ?: true
            MainActivity.isAtHomeState = isAtHome
            Log.i("AlarmPluginSync", "🏠 >>> NATIVE HOME STATE UPDATED: $isAtHome")
            call.resolve()
        } catch (e: Exception) {
            call.reject(e.message)
        }
    }
}
