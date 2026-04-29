import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { v4 as uuidv4 } from "https://deno.land/std@0.168.0/uuid/mod.ts";

// Web OneSignal credentials
const ONESIGNAL_WEB_APP_ID =
  Deno.env.get("ONESIGNAL_WEB_APP_ID") ||
  "f2c5559b-9e99-4aa0-8924-237469824a88";
const ONESIGNAL_WEB_API_KEY =
  Deno.env.get("ONESIGNAL_WEB_API_KEY") ||
  "os_v2_app_6lcvlg46tffkbcjeen2gtaskrdv4e3u7e6cett55chp4tx5q4lddeibep5tzatwennibpbuty5ug462f7kia7vwks5ktcotovthz6ma";

// Native OneSignal credentials
const ONESIGNAL_NATIVE_APP_ID =
  Deno.env.get("ONESIGNAL_NATIVE_APP_ID") ||
  "1f14fad4-0d2f-465a-b3a8-e0e976b8729f";
const ONESIGNAL_NATIVE_API_KEY =
  Deno.env.get("ONESIGNAL_NATIVE_API_KEY") ||
  "os_v2_app_d4kpvvanf5dfvm5i4duxnodst735kymt7txulwnftdubelcq2qw5yu7acbdtxn3ye7af2qsizzhz3jtptubvm4wi46xzpqeh2wn2vvq";
const ONESIGNAL_API_URL = "https://onesignal.com/api/v1/notifications";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://database.donedeals.shop";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("OK", { status: 200, headers: corsHeaders() });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
  }

  try {
    const body = await req.json();
    const { playerId, bookingId, shopName, tokenNumber, userName, timeSlot, shopId, bookingDate, reminderTime, timezoneOffsetHours } = body;

    if (!playerId || !bookingId) {
      return new Response(
        JSON.stringify({ error: "playerId and bookingId are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    // Calculate when to send the reminder based on the absolute reminder time
    let sendAfterTimestamp: number | undefined;
    if (bookingDate && reminderTime) {
      try {
        // Parse booking date (format: YYYY-MM-DD) and reminder time (format: HH:MM)
        // User enters time in their local timezone, we need to convert to UTC for OneSignal
        const [year, month, day] = bookingDate.split('-').map(Number);
        const [reminderHour, reminderMinute] = reminderTime.split(':').map(Number);

        const userTimezoneOffsetHours = timezoneOffsetHours || 0;

        // Create a date object at UTC midnight for the given date
        // Then add the hours and minutes
        // This ensures we're working with absolute dates
        const utcDate = new Date(Date.UTC(year, month - 1, day, reminderHour, reminderMinute, 0, 0));

        // Convert from user's local time to UTC
        // If user is in UTC+5:30 and enters 02:55, that's 21:25 UTC the previous day
        // So we subtract the timezone offset to get the UTC time
        const offsetMs = userTimezoneOffsetHours * 60 * 60 * 1000;
        const utcTimeMs = utcDate.getTime() - offsetMs;
        sendAfterTimestamp = Math.floor(utcTimeMs / 1000);

        // Calculate time difference for logging
        const now = Math.floor(Date.now() / 1000);
        const secondsFromNow = sendAfterTimestamp - now;
        const hoursFromNow = Math.round(secondsFromNow / 3600 * 10) / 10;

        // Log the actual UTC datetime for debugging
        const utcDateTime = new Date(sendAfterTimestamp * 1000);
        const localDateTime = new Date(utcDate.getTime());

        console.log(`⏰ User timezone: UTC${userTimezoneOffsetHours > 0 ? '+' : ''}${userTimezoneOffsetHours}`);
        console.log(`   Booking date: ${bookingDate}, Reminder time: ${reminderTime} (user local time)`);
        console.log(`   User local datetime: ${localDateTime.toISOString().replace('Z', '')} (client timezone)`);
        console.log(`   Converted to UTC timestamp: ${sendAfterTimestamp} (${utcDateTime.toISOString()})`);
        console.log(`   Will be sent in: ${hoursFromNow} hours (${secondsFromNow} seconds from now)`);

        // Validate the timestamp is in the future
        if (secondsFromNow < 0) {
          console.warn('⚠️ Calculated reminder time is in the past! Make sure to use future reminder times.');
        } else if (secondsFromNow > 86400 * 30) {
          console.warn('⚠️ Calculated reminder time is more than 30 days in the future');
        }
      } catch (err) {
        console.warn(`⚠️ Failed to calculate reminder send time:`, err);
        sendAfterTimestamp = undefined;
      }
    }

    // Check if player ID belongs to a native device
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    let isNativeDevice = false;
    let appId = ONESIGNAL_WEB_APP_ID;
    let apiKey = ONESIGNAL_WEB_API_KEY;

    try {
      const { data: nativeDevices, error } = await supabase
        .from("native_devices")
        .select("player_id")
        .eq("player_id", playerId)
        .limit(1);

      if (!error && nativeDevices && nativeDevices.length > 0) {
        isNativeDevice = true;
        appId = ONESIGNAL_NATIVE_APP_ID;
        apiKey = ONESIGNAL_NATIVE_API_KEY;
        console.log(`📱 Player ID detected as native device, using native OneSignal app`);
      } else {
        console.log(`🌐 Player ID detected as web device, using web OneSignal app`);
      }
    } catch (err) {
      console.warn(`⚠️ Failed to check device type, defaulting to web:`, err);
      appId = ONESIGNAL_WEB_APP_ID;
      apiKey = ONESIGNAL_WEB_API_KEY;
    }

    console.log(`📤 Sending reminder notification to player ${playerId}${sendAfterTimestamp ? ` (scheduled for ${sendAfterTimestamp})` : ''}`);
    console.log(`📋 Booking details: bookingId=${bookingId}, userName=${userName}, shopName=${shopName}, timeSlot=${timeSlot}`);

    const basePayload: Record<string, unknown> = {
      app_id: appId,
      include_player_ids: [playerId],
      headings: { en: "🔔 Appointment Reminder" },
      contents: {
        en: `Are you ready to come to ${shopName} for your appointment at ${timeSlot}?`,
      },
      data: {
        bookingId: bookingId,
        tokenNumber: String(tokenNumber),
        shopName: shopName,
        userName: userName,
        timeSlot: timeSlot,
        shopId: shopId,
        actionType: "reminder",
      },
      // Unified buttons for web and native
      buttons: [
        {
          id: `yes-${bookingId}`,
          text: "Yes, I'm Coming",
        },
        {
          id: `no-${bookingId}`,
          text: "No, Cancel",
        },
      ],
      // Channel configuration
      isAndroid: true,
      isIos: true,
      isWebPush: true,
      // Android heads-up notification settings with HIGHEST priority
      android_importance: 5, // MAXIMUM (5) - Shows as heads-up notification with sound/vibration
      android_priority: 10, // MAXIMUM (10) - For older Android versions
      android_small_icon: "scissors", // 🔪 Custom scissor icon instead of default bell
      // iOS settings
      ios_sound: "default",
      ios_badged: true,
      // Web push settings
      android_sound: "default",
      // Additional high-priority settings
      big_picture: true,
      ios_critical_sound: true,
    };

    // Send 3 notifications at 10-second intervals
    const notificationIntervalSeconds = 10;
    const notificationCount = 3;
    const sendResults = [];

    for (let i = 0; i < notificationCount; i++) {
      const payload = { ...basePayload } as Record<string, unknown>;

      // Calculate send time for each notification
      if (sendAfterTimestamp) {
        // Add 10 seconds * i to the base timestamp
        payload.send_after = sendAfterTimestamp + (notificationIntervalSeconds * i);
        console.log(`🔔 Notification ${i + 1}/${notificationCount} scheduled for timestamp: ${payload.send_after}`);
      }

      // Generate a unique UUID for each notification (valid UUID format for OneSignal idempotency_key)
      const uniqueNotificationId = uuidv4();
      payload.external_id = uniqueNotificationId;

      // Add unique content variations to ensure distinct notifications
      const notificationHeading = i === 0
        ? "🔔 Appointment Reminder"
        : i === 1
        ? "⏰ Appointment Reminder (Final Call)"
        : "🚨 Last Reminder - Your Appointment Now!";

      payload.headings = { en: notificationHeading };

      // Add sequence info to the notification with original bookingId
      payload.data = {
        ...basePayload.data,
        notificationSequence: `${i + 1}/3`,
        reminderIndex: i + 1,
        originalBookingId: bookingId,
      };

      try {
        const response = await fetch(ONESIGNAL_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            Authorization: `Basic ${apiKey}`,
          },
          body: JSON.stringify(payload),
        });

        const responseText = await response.text();

        if (!response.ok) {
          console.error(`❌ OneSignal API Error for notification ${i + 1}:`, responseText);
          sendResults.push({
            notificationNumber: i + 1,
            success: false,
            error: responseText,
          });
        } else {
          console.log(`✅ Notification ${i + 1}/${notificationCount} sent successfully`);
          sendResults.push({
            notificationNumber: i + 1,
            success: true,
          });
        }
      } catch (error) {
        console.error(`❌ Error sending notification ${i + 1}:`, error);
        sendResults.push({
          notificationNumber: i + 1,
          success: false,
          error: String(error),
        });
      }
    }

    // Check if at least one notification was successful
    const successCount = sendResults.filter((r) => r.success).length;
    if (successCount === 0) {
      return new Response(
        JSON.stringify({
          error: "Failed to send all reminder notifications",
          details: sendResults,
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `${successCount}/${notificationCount} reminder notifications sent successfully`,
        details: sendResults,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders() } }
    );
  }
});
