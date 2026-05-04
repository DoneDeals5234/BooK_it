package com.bookbarber.app

import android.app.AlarmManager
import android.app.DownloadManager
import android.app.PendingIntent
import android.content.*
import android.net.Uri
import org.json.JSONArray
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.util.Log
import android.webkit.JavascriptInterface
import android.widget.Toast
import androidx.core.app.ActivityCompat
import com.getcapacitor.BridgeActivity
import com.onesignal.OneSignal
import java.util.*
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import android.location.Location
import java.lang.Exception
import com.bookbarber.app.AlarmReceiver
import com.bookbarber.app.ForegroundAlarmService
import com.bookbarber.app.LocalNotificationScheduler
import com.bookbarber.app.OrderAlarmService
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

class MainActivity : BridgeActivity() {
    private var lastBackPressTime: Long = 0L
    private var backToast: Toast? = null
    internal lateinit var fusedLocationClient: FusedLocationProviderClient

    companion object {
        private const val TAG = "MainActivity"
        @JvmStatic
        var isAtHomeState: Boolean = false // Default to FALSE for safety
        @JvmStatic
        var pendingAlarmData: AlarmData? = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Add JavaScript bridge
        addJavascriptBridge()

        // Initialize OneSignal
        OneSignal.initWithContext(this, "1f14fad4-0d2f-465a-b3a8-e0e976b8729f")

        // ✅ Kotlin-native player_id capture (replaces unreliable React/JS approach)
        OneSignalPlayerIdManager.initialize(this)

        // Initialize Location Client
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

        // Handle intent if app was opened from alarm
        handleAlarmIntent(intent)
    }

    private fun addJavascriptBridge() {
        try {
            val androidBridge = AndroidBridge()
            bridge.webView.addJavascriptInterface(androidBridge, "AndroidBridge")
            bridge.webView.addJavascriptInterface(androidBridge, "AlarmBridge")
            Log.d(TAG, "✅ Native Bridges (AndroidBridge & AlarmBridge) registered")
        } catch (e: Exception) {
            Log.e(TAG, "Error adding JS bridge", e)
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleAlarmIntent(intent)
    }

    private fun handleAlarmIntent(intent: Intent?) {
        if (intent != null && AlarmReceiver.ACTION_ALARM == intent.action) {
            val bookingId = intent.getStringExtra(AlarmReceiver.EXTRA_BOOKING_ID)
            val tokenNumber = intent.getIntExtra(AlarmReceiver.EXTRA_TOKEN_NUMBER, 0)
            val shopName = intent.getStringExtra(AlarmReceiver.EXTRA_SHOP_NAME)
            val timeSlot = intent.getStringExtra(AlarmReceiver.EXTRA_TIME_SLOT)

            if (bookingId != null) {
                pendingAlarmData = AlarmData(bookingId, tokenNumber, shopName ?: "", timeSlot ?: "")
            }
        }
    }

    // --- Back Button Management ---

    override fun onBackPressed() {
        val currentTime = System.currentTimeMillis()
        
        // Home states: 
        // 1. Force set via JS bridge (setAtHome)
        // 2. URL matches root /
        val webView = bridge.webView
        val currentUrl = webView.url ?: ""
        val uri = Uri.parse(currentUrl)
        val path = uri.path ?: ""
        val isRootPath = path == "" || path == "/" || path == "/index.html"
        val isFullyHome = isAtHomeState && isRootPath

        Log.i(TAG, "onBackPressed: isAtHomeState=$isAtHomeState, isRootPath=$isRootPath, isFullyHome=$isFullyHome")

        if (isFullyHome) {
            // Double-click to exit logic
            if (currentTime - lastBackPressTime < 2000) {
                backToast?.cancel()
                super.onBackPressed() // Exit App
            } else {
                backToast = Toast.makeText(this, "Press back again to exit", Toast.LENGTH_SHORT)
                backToast?.show()
                lastBackPressTime = currentTime
                
                // Also notify JS in case it has open menus
                bridge.triggerJSEvent("backbutton", "document")
            }
        } else {
            // Not at Home - send to JS for router navigation
            Log.i(TAG, "onBackPressed: Not at home. Notifying JS.")
            bridge.triggerJSEvent("backbutton", "document")
            
            // Fail-safe: if JS doesn't handle it, we might want to try webView.goBack() 
            // but for react-router navigate(-1) from a JS listener is better.
            lastBackPressTime = 0 // Reset exit timer
        }
    }

    // --- Permission Requests ---

    fun requestAlarmPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(
                    android.Manifest.permission.SCHEDULE_EXACT_ALARM,
                    android.Manifest.permission.READ_CALENDAR,
                    android.Manifest.permission.WRITE_CALENDAR
                ),
                9001
            )
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(
                    android.Manifest.permission.READ_CALENDAR,
                    android.Manifest.permission.WRITE_CALENDAR
                ),
                9001
            )
        }
    }

    fun requestLocationPermissions() {
        ActivityCompat.requestPermissions(
            this,
            arrayOf(
                android.Manifest.permission.ACCESS_FINE_LOCATION,
                android.Manifest.permission.ACCESS_COARSE_LOCATION
            ),
            9002
        )
    }

    // --- Native UI Helpers ---

    fun openSystemTimer(durationSeconds: Int, label: String) {
        try {
            val timerIntent = Intent("android.intent.action.SET_TIMER").apply {
                putExtra("android.intent.extra.alarm.LENGTH", durationSeconds)
                putExtra("android.intent.extra.alarm.SKIP_UI", false)
                setPackage("com.android.deskclock")
            }
            try {
                startActivity(timerIntent)
            } catch (e: Exception) {
                timerIntent.setPackage(null)
                startActivity(timerIntent)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error opening timer", e)
        }
    }

    fun openSystemClockForAlarm(hour: Int, minute: Int, label: String) {
        try {
            val alarmIntent = Intent("android.intent.action.SET_ALARM").apply {
                putExtra("android.intent.extra.alarm.HOUR", hour)
                putExtra("android.intent.extra.alarm.MINUTES", minute)
                putExtra("android.intent.extra.alarm.MESSAGE", label)
                putExtra("android.intent.extra.alarm.SKIP_UI", false)
                setPackage("com.android.deskclock")
            }
            try {
                startActivity(alarmIntent)
            } catch (e: Exception) {
                alarmIntent.setPackage(null)
                startActivity(alarmIntent)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error opening clock", e)
        }
    }

    // --- JS Bridge Class (Kotlin Version) ---
    // --- JS Bridge Class (Kotlin Version) ---
    inner class AndroidBridge {
        @JavascriptInterface
        fun scheduleAlarm(bookingId: String, reminderTime: String, bookingDate: String,
                          tokenNumber: Int, shopName: String, timeSlot: String) {
            try {
                this@MainActivity.requestAlarmPermissions()
                
                val timeParts = reminderTime.split(":")
                val dateParts = bookingDate.split("-")
                
                val calendar = Calendar.getInstance().apply {
                    set(dateParts[0].toInt(), dateParts[1].toInt() - 1, dateParts[2].toInt(),
                        timeParts[0].toInt(), timeParts[1].toInt(), 0)
                }
                
                AlarmReceiver.scheduleAlarm(this@MainActivity, bookingId, tokenNumber, shopName, timeSlot, calendar.timeInMillis)
            } catch (e: Exception) {
                Log.e(TAG, "Error scheduling alarm", e)
            }
        }

        @JavascriptInterface
        fun cancelAlarm(bookingId: String) {
            AlarmReceiver.cancelAlarm(this@MainActivity, bookingId)
        }

        @JavascriptInterface
        fun testAlarm(bookingId: String, delaySeconds: Int) {
            val calendar = Calendar.getInstance().apply { add(Calendar.SECOND, delaySeconds) }
            AlarmReceiver.scheduleAlarm(this@MainActivity, bookingId, 99, "Test Shop", "Test Time", calendar.timeInMillis)
        }

        @JavascriptInterface
        fun openSystemTimer(durationSeconds: Int, label: String) {
            this@MainActivity.openSystemTimer(durationSeconds, label)
        }

        @JavascriptInterface
        fun openSystemClockForAlarm(hour: Int, minute: Int, label: String) {
            this@MainActivity.openSystemClockForAlarm(hour, minute, label)
        }

        @JavascriptInterface
        fun getPendingAlarmData(): String {
            pendingAlarmData?.let {
                val json = """{"bookingId":"${it.bookingId}","tokenNumber":${it.tokenNumber},"shopName":"${it.shopName}","timeSlot":"${it.timeSlot}"}"""
                pendingAlarmData = null
                return json
            }
            return ""
        }

        @JavascriptInterface
        fun startForegroundAlarmService(triggerTimeMs: Long, bookingId: String,
                                       tokenNumber: Int, shopName: String, timeSlot: String) {
            val intent = Intent(this@MainActivity, ForegroundAlarmService::class.java).apply {
                action = ForegroundAlarmService.ACTION_START_TIMER
                putExtra(ForegroundAlarmService.EXTRA_TRIGGER_TIME_MS, triggerTimeMs)
                putExtra(ForegroundAlarmService.EXTRA_BOOKING_ID, bookingId)
                putExtra(ForegroundAlarmService.EXTRA_TOKEN_NUMBER, tokenNumber)
                putExtra(ForegroundAlarmService.EXTRA_SHOP_NAME, shopName)
                putExtra(ForegroundAlarmService.EXTRA_TIME_SLOT, timeSlot)
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                this@MainActivity.startForegroundService(intent)
            } else {
                this@MainActivity.startService(intent)
            }
        }

        @JavascriptInterface
        fun startShopOnlineService() {
            Log.d(TAG, "🟢 Starting ShopOnlineService from React")
            val intent = Intent(this@MainActivity, ShopOnlineService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                this@MainActivity.startForegroundService(intent)
            } else {
                this@MainActivity.startService(intent)
            }
        }

        @JavascriptInterface
        fun stopShopOnlineService() {
            Log.d(TAG, "🔴 Stopping ShopOnlineService from React")
            val intent = Intent(this@MainActivity, ShopOnlineService::class.java)
            this@MainActivity.stopService(intent)
        }

        @JavascriptInterface
        fun stopForegroundAlarmService() {
            val intent = Intent(this@MainActivity, ForegroundAlarmService::class.java).apply {
                action = ForegroundAlarmService.ACTION_STOP_TIMER
            }
            this@MainActivity.startService(intent)
        }

        // --- NEW TEST METHODS ---

        @JavascriptInterface
        fun sendTestNotification() {
            Log.d(TAG, "🔔 Calling sendTestNotification from React")
            LocalNotificationScheduler.sendTestNotification(this@MainActivity)
        }

        @JavascriptInterface
        fun startOrderAlarm() {
            Log.d(TAG, "⏰ Calling startOrderAlarm from React")
            val intent = Intent(this@MainActivity, OrderAlarmService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                this@MainActivity.startForegroundService(intent)
            } else {
                this@MainActivity.startService(intent)
            }
        }

        @JavascriptInterface
        fun setAtHome(atHome: Boolean) {
            MainActivity.isAtHomeState = atHome
            Log.i(TAG, "🏠 Home state updated from JS: $atHome")
        }

        // ✅ Called from React when user logs in — links player_id to user
        @JavascriptInterface
        fun onUserLogin(userId: String, email: String, password: String? = null) {
            Log.d("MainActivity", "👤 User logged in via bridge: $userId, $email")
            
            // Step 1: Tell OneSignal to link this device to the User ID (Identity)
            try {
                OneSignal.login(userId)
                Log.d(TAG, "✅ OneSignal.login($userId) called")
            } catch (e: Exception) {
                Log.e(TAG, "❌ OneSignal.login failed", e)
            }

            // Step 2: Save credentials and trigger Player ID sync
            OneSignalPlayerIdManager.onUserLoggedIn(userId, email, password)
        }

        // ✅ Called from React when user logs out
        @JavascriptInterface
        fun onUserLogout() {
            Log.d(TAG, "🚪 onUserLogout called from React")
            OneSignalPlayerIdManager.onUserLoggedOut()
            try {
                OneSignal.logout()
            } catch (e: Exception) {
                Log.e(TAG, "Error clearing OneSignal External ID", e)
            }
        }

        // ✅ Debug: Get current player_id from Kotlin
        @JavascriptInterface
        fun getCurrentPlayerId(): String {
            return OneSignalPlayerIdManager.getCurrentPlayerId() ?: ""
        }

        @JavascriptInterface
        fun getOneSignalStatus(): String {
            val playerId = OneSignal.User.pushSubscription.id
            val optedIn = OneSignal.User.pushSubscription.optedIn
            return "ID: $playerId, OptedIn: $optedIn"
        }

        @JavascriptInterface
        fun promptForNotifications() {
            Log.d(TAG, "🔔 Requesting OneSignal notification permission...")
            lifecycleScope.launch {
                try {
                    val result = OneSignal.Notifications.requestPermission(true)
                    Log.d(TAG, "🔔 Permission result: $result")
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Error requesting notification permission", e)
                }
            }
        }

        @JavascriptInterface
        fun getCurrentLocation() {
            Log.d(TAG, "📍 Requesting current location...")
            
            if (ActivityCompat.checkSelfPermission(this@MainActivity, android.Manifest.permission.ACCESS_FINE_LOCATION) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                Log.w(TAG, "📍 Location permission not granted, requesting...")
                this@MainActivity.requestLocationPermissions()
                this@MainActivity.bridge.triggerJSEvent("locationError", "document", "{\"message\": \"Permission Required\"}")
                return
            }

            val cts = CancellationTokenSource()
            this@MainActivity.fusedLocationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cts.token)
                .addOnSuccessListener { loc: Location? ->
                    if (loc != null) {
                        Log.d(TAG, "📍 Location found: ${loc.latitude}, ${loc.longitude}")
                        val result = "{\"lat\": ${loc.latitude}, \"lng\": ${loc.longitude}}"
                        this@MainActivity.bridge.triggerJSEvent("locationReceived", "document", result)
                    } else {
                        Log.w(TAG, "📍 Location is null")
                        this@MainActivity.bridge.triggerJSEvent("locationError", "document", "{\"message\": \"Location unavailable\"}")
                    }
                }
                .addOnFailureListener { e: Exception ->
                    Log.e(TAG, "📍 Error getting location", e)
                    this@MainActivity.bridge.triggerJSEvent("locationError", "document", "{\"message\": \"${e.message}\"}")
                }
        }

        @JavascriptInterface
        fun downloadImagesToGallery(urlsJson: String) {
            try {
                Log.d(TAG, "📥 downloadImagesToGallery called with: $urlsJson")
                val urls = JSONArray(urlsJson)
                val downloadManager = this@MainActivity.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                
                // On Android 10+ (API 29+), we don't need WRITE_EXTERNAL_STORAGE for DownloadManager 
                // to save to public directories like DIRECTORY_PICTURES
                
                for (i in 0 until urls.length()) {
                    val url = urls.getString(i)
                    val uri = Uri.parse(url)
                    
                    // Extract extension or default to png
                    val extension = if (url.contains(".jpg") || url.contains(".jpeg")) "jpg" else "png"
                    val fileName = "bookit_order_${System.currentTimeMillis()}_$i.$extension"
                    
                    val request = DownloadManager.Request(uri)
                        .setTitle("Order Image ${i + 1}")
                        .setDescription("Saving to Book It Gallery folder")
                        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                        .setDestinationInExternalPublicDir(Environment.DIRECTORY_PICTURES, "BookItOrders/$fileName")
                        .setAllowedOverMetered(true)
                        .setAllowedOverRoaming(true)
                    
                    downloadManager.enqueue(request)
                }
                
                this@MainActivity.runOnUiThread {
                    Toast.makeText(this@MainActivity, "Downloading ${urls.length()} images to 'Pictures/BookItOrders' folder", Toast.LENGTH_LONG).show()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error downloading images", e)
                this@MainActivity.runOnUiThread {
                    Toast.makeText(this@MainActivity, "Download failed: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }

        @JavascriptInterface
        fun downloadAndInstallApk(url: String) {
            try {
                Log.d(TAG, "📥 downloadAndInstallApk called: $url")
                val uri = Uri.parse(url)
                val downloadManager = this@MainActivity.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                
                val request = DownloadManager.Request(uri)
                    .setTitle("App Update")
                    .setDescription("Downloading latest version of Book It")
                    .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "bookit_update.apk")
                
                downloadManager.enqueue(request)
                
                this@MainActivity.runOnUiThread {
                    Toast.makeText(this@MainActivity, "Downloading update... check notifications", Toast.LENGTH_LONG).show()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error downloading APK", e)
            }
        }
    }

    data class AlarmData(
        val bookingId: String,
        val tokenNumber: Int,
        val shopName: String,
        val timeSlot: String
    )
}
