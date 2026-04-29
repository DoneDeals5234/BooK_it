package com.bookbarber.app

import android.app.Activity
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.CalendarContract
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import java.util.*

object SystemClockAlarmManager {
    private const val TAG = "SystemClockAlarmManager"
    private const val ALARM_CALENDAR_NAME = "BookBarber Alarms"

    @JvmStatic
    fun addAlarmToSystemCalendar(context: Context, bookingId: String, tokenNumber: Int,
                                 shopName: String, timeSlot: String, triggerAtMillis: Long): Long {
        try {
            if (!hasCalendarPermissions(context)) return -1

            val calendarId = getOrCreateBookBarberCalendar(context)
            if (calendarId == -1L) return -1

            val eventTitle = "Booking Reminder - $shopName (Token #$tokenNumber)"
            val eventDescription = "Appointment booking reminder\nShop: $shopName\nToken: #$tokenNumber\nTime: $timeSlot\nBooking ID: $bookingId"

            val values = ContentValues().apply {
                put(CalendarContract.Events.CALENDAR_ID, calendarId)
                put(CalendarContract.Events.TITLE, eventTitle)
                put(CalendarContract.Events.DESCRIPTION, eventDescription)
                put(CalendarContract.Events.DTSTART, triggerAtMillis)
                put(CalendarContract.Events.DTEND, triggerAtMillis + (30 * 60 * 1000))
                put(CalendarContract.Events.EVENT_TIMEZONE, TimeZone.getDefault().id)
                put(CalendarContract.Events.HAS_ALARM, 1)
                put(CalendarContract.Events.ACCESS_LEVEL, CalendarContract.Events.ACCESS_PRIVATE)
                put(CalendarContract.Events.AVAILABILITY, CalendarContract.Events.AVAILABILITY_BUSY)
                put(CalendarContract.Events.CUSTOM_APP_PACKAGE, "com.bookbarber.app")
            }

            val eventUri = context.contentResolver.insert(CalendarContract.Events.CONTENT_URI, values)
            eventUri?.lastPathSegment?.let { eventId ->
                Log.d(TAG, "✅ Alarm event created: $eventId")
                addReminderToEvent(context, eventId.toLong())
                return eventId.toLong()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error adding alarm to calendar", e)
        }
        return -1
    }

    @JvmStatic
    fun removeAlarmFromSystemCalendar(context: Context, bookingId: String): Boolean {
        return try {
            if (!hasCalendarPermissions(context)) return false
            val deletedCount = context.contentResolver.delete(
                CalendarContract.Events.CONTENT_URI,
                "${CalendarContract.Events.TITLE} LIKE ?",
                arrayOf("%$bookingId%")
            )
            deletedCount > 0
        } catch (e: Exception) {
            Log.e(TAG, "Error removing alarm from calendar", e)
            false
        }
    }

    @JvmStatic
    fun hasCalendarPermissions(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val hasRead = ContextCompat.checkSelfPermission(context, android.Manifest.permission.READ_CALENDAR) == PackageManager.PERMISSION_GRANTED
            val hasWrite = ContextCompat.checkSelfPermission(context, android.Manifest.permission.WRITE_CALENDAR) == PackageManager.PERMISSION_GRANTED
            hasRead && hasWrite
        } else true
    }

    @JvmStatic
    fun requestCalendarPermissions(activity: Activity) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            ActivityCompat.requestPermissions(activity, arrayOf(android.Manifest.permission.READ_CALENDAR, android.Manifest.permission.WRITE_CALENDAR), 9001)
        }
    }

    private fun getOrCreateBookBarberCalendar(context: Context): Long {
        return try {
            val resolver = context.contentResolver
            val projection = arrayOf(CalendarContract.Calendars._ID)
            val selection = "${CalendarContract.Calendars.NAME} = ?"
            val selectionArgs = arrayOf(ALARM_CALENDAR_NAME)

            resolver.query(CalendarContract.Calendars.CONTENT_URI, projection, selection, selectionArgs, null)?.use { cursor ->
                if (cursor.moveToFirst()) return cursor.getLong(0)
            }
            getPrimaryCalendarId(context)
        } catch (e: Exception) {
            -1L
        }
    }

    private fun getPrimaryCalendarId(context: Context): Long {
        return try {
            context.contentResolver.query(CalendarContract.Calendars.CONTENT_URI, arrayOf(CalendarContract.Calendars._ID), null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) cursor.getLong(0) else -1L
            } ?: -1L
        } catch (e: Exception) {
            -1L
        }
    }

    private fun addReminderToEvent(context: Context, eventId: Long) {
        try {
            val values = ContentValues().apply {
                put(CalendarContract.Reminders.EVENT_ID, eventId)
                put(CalendarContract.Reminders.MINUTES, 5)
                put(CalendarContract.Reminders.METHOD, CalendarContract.Reminders.METHOD_ALERT)
            }
            context.contentResolver.insert(CalendarContract.Reminders.CONTENT_URI, values)
        } catch (e: Exception) {
            Log.e(TAG, "Error adding reminder", e)
        }
    }

    @JvmStatic
    fun launchClockApp(context: Context) {
        val packages = arrayOf("com.android.deskclock", "com.google.android.deskclock")
        for (pkg in packages) {
            try {
                val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER).apply {
                    setPackage(pkg)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(intent)
                return
            } catch (e: Exception) { }
        }
    }
}
