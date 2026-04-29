package com.bookbarber.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import android.widget.Toast
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread
import org.json.JSONObject

class OrderActionReceiver : BroadcastReceiver() {
    companion object {
        const val TAG = "OrderActionReceiver"
        const val ACTION_ACCEPT = "com.bookbarber.app.ACTION_ACCEPT"
        const val ACTION_REJECT = "com.bookbarber.app.ACTION_REJECT"
        
        // Supabase Config - Hardcoded for reliability in background service
        private const val SUPABASE_URL = "https://database.donedeals.shop"
        private const val SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlLWRlbW8iLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTc5OTUzNTYwMH0.PKKL6ybphx1DLBXw8xxpLZzEMbumsFJQ23nSnwmrVzE"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        val orderId = intent.getStringExtra("order_id")

        Log.d(TAG, "Received action: $action for order: $orderId")

        if (orderId != null) {
            val apiAction = if (action == ACTION_ACCEPT) "accept" else "reject"
            processOrderAction(context, orderId, apiAction)
        } else {
            Log.e(TAG, "Order ID is null in ActionReceiver")
            Toast.makeText(context, "Error: Order ID not found", Toast.LENGTH_SHORT).show()
        }

        // Stop the alarm service after interaction
        val serviceIntent = Intent(context, OrderAlarmService::class.java)
        context.stopService(serviceIntent)
    }

    private fun processOrderAction(context: Context, orderId: String, action: String) {
        val toastMsg = if (action == "accept") "Accepting order..." else "Rejecting order..."
        Toast.makeText(context, toastMsg, Toast.LENGTH_SHORT).show()

        thread {
            try {
                val url = URL("$SUPABASE_URL/functions/v1/handle-order-action")
                val connection = url.openConnection() as HttpURLConnection
                connection.requestMethod = "POST"
                connection.setRequestProperty("Content-Type", "application/json")
                connection.setRequestProperty("Authorization", "Bearer $SUPABASE_ANON_KEY")
                connection.setRequestProperty("apikey", SUPABASE_ANON_KEY)
                connection.doOutput = true

                val jsonBody = JSONObject().apply {
                    put("orderId", orderId)
                    put("action", action)
                }

                connection.outputStream.use { os ->
                    val input = jsonBody.toString().toByteArray(Charsets.UTF_8)
                    os.write(input, 0, input.size)
                }

                val responseCode = connection.responseCode
                Log.d(TAG, "API Response Code: $responseCode")

                if (responseCode == 200) {
                    Log.d(TAG, "Successfully processed order action")
                } else {
                    val errorBody = connection.errorStream?.bufferedReader()?.use { it.readText() }
                    Log.e(TAG, "Failed to process order action: $errorBody")
                }
                connection.disconnect()
            } catch (e: Exception) {
                Log.e(TAG, "Error in processOrderAction", e)
            }
        }
    }
}
