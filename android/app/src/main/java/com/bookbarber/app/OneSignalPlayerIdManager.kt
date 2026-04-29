package com.bookbarber.app

import android.content.Context
import android.util.Log
import com.onesignal.OneSignal
import com.onesignal.user.subscriptions.IPushSubscriptionObserver
import com.onesignal.user.subscriptions.PushSubscriptionChangedState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

/**
 * OneSignalPlayerIdManager (Kotlin Native)
 *
 * Yeh class React/JS ko completely bypass karta hai.
 * Directly OneSignal Android SDK v5 se player_id uthata hai
 * aur Supabase ke native_devices table mein save karta hai.
 *
 * Flow:
 * 1. MainActivity.onCreate() → OneSignalPlayerIdManager.initialize() call hota hai
 * 2. Yeh OneSignal subscription listener set karta hai
 * 3. Jab bhi player_id milta hai, wo Supabase mein save ho jaata hai
 * 4. React layer ki zaroorat nahi!
 */
object OneSignalPlayerIdManager {

    private const val TAG = "PlayerIdManager"

    // --- Supabase Config (hardcoded for reliability in background) ---
    private const val SUPABASE_URL = "https://database.donedeals.shop"
    private const val SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlLWRlbW8iLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTc5OTUzNTYwMH0.PKKL6ybphx1DLBXw8xxpLZzEMbumsFJQ23nSnwmrVzE"
    private const val SAVE_DEVICE_ENDPOINT = "$SUPABASE_URL/functions/v1/save-native-device"

    private var initialized = false
    private lateinit var appContext: Context
    
    private const val PREFS_NAME = "OneSignalPlayerIdPrefs"
    private const val KEY_USER_ID = "user_id"
    private const val KEY_EMAIL = "email"
    private const val KEY_PASSWORD = "password"

    /**
     * Isko MainActivity.onCreate() ke baad call karo
     * OneSignal.initWithContext() ke turant baad call karna
     */
    fun initialize(context: Context) {
        if (initialized) {
            Log.d(TAG, "Already initialized, skipping")
            return
        }
        this.appContext = context.applicationContext
        initialized = true
        Log.d(TAG, "🚀 Initializing Kotlin-native player_id capture...")

        // Subscription observer register karo (OneSignal v5 API)
        OneSignal.User.pushSubscription.addObserver(object : IPushSubscriptionObserver {
            override fun onPushSubscriptionChange(state: PushSubscriptionChangedState) {
                val playerId = state.current.id
                val optedIn = state.current.optedIn

                Log.d(TAG, "🔔 Subscription changed → player_id: $playerId | optedIn: $optedIn")
                
                if (!playerId.isNullOrEmpty()) {
                    Log.d(TAG, "✅ Valid player_id captured: $playerId")
                    
                    val prefs = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    val userId = prefs.getString(KEY_USER_ID, null)
                    val email = prefs.getString(KEY_EMAIL, "") ?: ""
                    val password = prefs.getString(KEY_PASSWORD, null)

                    if (userId != null) {
                        savePlayerIdToSupabase(playerId, userId, email, password)
                    } else {
                        Log.w(TAG, "⏳ player_id captured but no userId stored yet - waiting for login...")
                    }
                } else {
                    Log.w(TAG, "⚠️ player_id is still empty")
                }
            }
        })

        Log.d(TAG, "✅ Subscription observer registered")

        // Turant bhi check karo — shayad player_id pehle se hi ho
        tryCapturPlayerIdNow()
    }

    /**
     * React side se call hota hai jab user login/signup karta hai
     */
    fun onUserLoggedIn(userId: String, email: String, password: String? = null) {
        Log.d(TAG, "👤 User logged in: $userId, $email")
        
        // Save to SharedPreferences for persistence
        val prefs = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().apply {
            putString(KEY_USER_ID, userId)
            putString(KEY_EMAIL, email)
            if (password != null) {
                putString(KEY_PASSWORD, password)
            }
            apply()
        }
        
        tryCapturPlayerIdNow()
    }

    /**
     * Jab user logout kare
     */
    fun onUserLoggedOut() {
        Log.d(TAG, "👤 User logged out, clearing currentUserId")
        val prefs = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().clear().apply()
    }

    /**
     * Turant player_id fetch karne ki koshish karo OneSignal v5 se
     */
    private fun tryCapturPlayerIdNow() {
        CoroutineScope(Dispatchers.IO).launch {
            // OneSignal ko ready hone ka thoda time do
            var attempts = 0
            var playerId: String? = null

            while (attempts < 8 && playerId.isNullOrEmpty()) {
                delay(1500L) // 1.5s interval
                attempts++

                try {
                    // OneSignal SDK v5: directly se player_id lo
                    playerId = OneSignal.User.pushSubscription.id
                    val optedIn = OneSignal.User.pushSubscription.optedIn

                    Log.d(TAG, "🔍 Attempt $attempts: player_id=$playerId, optedIn=$optedIn")

                    if (!playerId.isNullOrEmpty()) {
                        Log.d(TAG, "✅ Got player_id on attempt $attempts: $playerId")
                        
                        val prefs = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                        val userId = prefs.getString(KEY_USER_ID, null)
                        val email = prefs.getString(KEY_EMAIL, "") ?: ""
                        val password = prefs.getString(KEY_PASSWORD, null)

                        Log.d(TAG, "📡 Sending player_id $playerId for user $userId")

                        savePlayerIdToSupabase(playerId, userId, email, password)
                        return@launch
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "⚠️ Attempt $attempts failed: ${e.message}")
                }
            }

            if (playerId.isNullOrEmpty()) {
                Log.e(TAG, "❌ Could not capture player_id after $attempts attempts")
            }
        }
    }

    /**
     * player_id ko directly Edge Function ke zariye save karo
     * Edge Function RLS bypass karta hai aur dono tables me upsert karta hai.
     */
    private fun savePlayerIdToSupabase(
        playerId: String,
        userId: String? = null,
        email: String = "",
        password: String? = null
    ) {
        val finalUserId = userId ?: ""
        
        // ✅ CRITICAL: Do not attempt to save if userId is empty
        if (finalUserId.isEmpty()) {
            Log.w(TAG, "⚠️ Skipping savePlayerId: userId is empty (user might not be logged in)")
            return
        }

        Log.d(TAG, "💾 Saving player_id via Edge Function...")
        Log.d(TAG, "   player_id: $playerId")
        Log.d(TAG, "   user_id:   $finalUserId")

        // Kotlin is fully handling the save process now
        CoroutineScope(Dispatchers.IO).launch {
            savePlayerIdViaEdgeFunction(playerId, finalUserId, email, password)
        }
    }

    /**
     * Fallback: Edge Function ke zariye save karo (agar direct REST fail ho)
     */
    private fun savePlayerIdViaEdgeFunction(
        playerId: String, 
        userId: String, 
        email: String,
        password: String? = null
    ) {
        try {
            val json = JSONObject().apply {
                put("userId", userId)
                put("email", email)
                if (!password.isNullOrEmpty()) {
                    put("password", password)
                }
                put("playerId", playerId)
                put("deviceType", "native_android_kotlin")
            }

            val url = URL(SAVE_DEVICE_ENDPOINT)
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("apikey", SUPABASE_ANON_KEY)
            conn.setRequestProperty("Authorization", "Bearer $SUPABASE_ANON_KEY")
            conn.doOutput = true
            conn.connectTimeout = 8000
            conn.readTimeout = 8000

            OutputStreamWriter(conn.outputStream).use { it.write(json.toString()); it.flush() }

            val code = conn.responseCode
            Log.d(TAG, "📞 Fallback Edge Function response: $code")
            conn.disconnect()
        } catch (e: Exception) {
            Log.e(TAG, "❌ Fallback Edge Function also failed", e)
        }
    }


    /**
     * Current player_id turant lo (synchronous nahi, callback-based)
     * Debug ke liye useful
     */
    fun getCurrentPlayerId(): String? {
        return try {
            OneSignal.User.pushSubscription.id
        } catch (e: Exception) {
            Log.e(TAG, "Error getting current player_id", e)
            null
        }
    }
}
