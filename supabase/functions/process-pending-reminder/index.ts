import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const ONESIGNAL_APP_ID =
  Deno.env.get("ONESIGNAL_NATIVE_APP_ID") ||
  "1f14fad4-0d2f-465a-b3a8-e0e976b8729f";
const ONESIGNAL_API_KEY =
  Deno.env.get("ONESIGNAL_NATIVE_API_KEY") ||
  "os_v2_app_d4kpvvanf5dfvm5i4duxnodst735kymt7txulwnftdubelcq2qw5yu7acbdtxn3ye7af2qsizzhz3jtptubvm4wi46xzpqeh2wn2vvq";
const ONESIGNAL_API_URL = "https://onesignal.com/api/v1/notifications";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://database.donedeals.shop";
const SUPABASE_SERVICE_KEY = Deno.env.get("SERVICE_ROLE_KEY") || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ta3JmZWh1dmZ0bnR1cWpteHFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTkwNDM4MywiZXhwIjoyMDc3NDgwMzgzfQ.XGaLped_nvzTiQnycJHnodgYGb2QIA5N_-f3Qe8K3Xo";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

/**
 * Process a single reminder - called immediately when reminder is set
 * This function will keep running and checking every 1 minute until the reminder is sent
 */
serve(async (req: Request) => {
  // Handle preflight CORS
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
    const { bookingId } = await req.json() as { bookingId: string };

    if (!bookingId) {
      return new Response(
        JSON.stringify({ error: "Missing bookingId" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    console.log(`🎯 Processing reminder for booking: ${bookingId}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Get the reminder for this booking
    const { data: reminder, error: fetchError } = await supabase
      .from("alert_reminders")
      .select("*")
      .eq("booking_id", bookingId)
      .single();

    if (fetchError || !reminder) {
      console.error("❌ Reminder not found:", fetchError);
      return new Response(
        JSON.stringify({ error: "Reminder not found", details: fetchError }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    console.log(`📍 Found reminder: ${reminder.id}`);
    console.log(`   Scheduled for: ${reminder.scheduled_for}`);
    console.log(`   User: ${reminder.user_id}`);

    // If already sent, don't process again
    if (reminder.sent) {
      console.log("✅ Reminder already sent, skipping");
      return new Response(
        JSON.stringify({
          success: true,
          message: "Reminder already sent",
          reminderId: reminder.id,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    const now = new Date();
    const scheduledForTime = new Date(reminder.scheduled_for);

    console.log(`⏰ Current time: ${now.toISOString()}`);
    console.log(`⏰ Scheduled time: ${scheduledForTime.toISOString()}`);
    console.log(`⏰ Time remaining: ${(scheduledForTime.getTime() - now.getTime()) / 1000} seconds`);

    // Check if it's time to send
    if (scheduledForTime > now) {
      console.log("⏳ Not yet time to send - will retry next check");
      return new Response(
        JSON.stringify({
          success: true,
          message: "Not yet time to send",
          reminderId: reminder.id,
          timeRemaining: scheduledForTime.getTime() - now.getTime(),
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    // Time to send!
    console.log("🔔 It's time to send the reminder! Sending 3 notifications with 10-second intervals...");

    const basePayload: Record<string, unknown> = {
      app_id: ONESIGNAL_APP_ID,
      headings: { en: "🔔 Appointment Reminder" },
      contents: {
        en: `Are you ready to come to ${reminder.shop_name} for your appointment at ${reminder.time_slot}?`,
      },
      include_aliases: {
        external_id: [reminder.user_id],
      },
      data: {
        bookingId: reminder.booking_id,
        tokenNumber: String(reminder.token_number),
        shopName: reminder.shop_name,
        userName: reminder.user_name,
        timeSlot: reminder.time_slot,
        shopId: reminder.shop_id,
        actionType: "reminder",
      },
      // Unified buttons for web and native
      buttons: [
        {
          id: `yes-${reminder.booking_id}`,
          text: "Yes, I'm Coming",
        },
        {
          id: `no-${reminder.booking_id}`,
          text: "No, Cancel",
        },
      ],
      // Android and iOS configuration with MAXIMUM priority
      isAndroid: true,
      isIos: true,
      // Android heads-up notification settings with MAXIMUM priority
      android_importance: 5, // MAXIMUM (5) - Shows as heads-up notification with sound/vibration
      android_priority: 10, // MAXIMUM (10) - For older Android versions
      android_sound: "default",
      ios_sound: "default",
      ios_badged: true,
      // Additional high-priority settings
      big_picture: true,
      ios_critical_sound: true,
    };

    // Send 3 notifications at 10-second intervals
    const notificationIntervalSeconds = 10;
    const notificationCount = 3;
    let notificationsSent = 0;

    for (let i = 0; i < notificationCount; i++) {
      const payload = { ...basePayload } as Record<string, unknown>;

      // Add delay for subsequent notifications
      if (i > 0) {
        // Schedule the 2nd and 3rd notifications with send_after delays
        payload.send_after = Math.floor(Date.now() / 1000) + (notificationIntervalSeconds * i);
        console.log(`   🔔 Notification ${i + 1}/${notificationCount} scheduled for ${notificationIntervalSeconds * i} seconds from now`);
      } else {
        console.log(`   🔔 Notification ${i + 1}/${notificationCount} sending immediately`);
      }

      // Add unique identifier to prevent OneSignal deduplication
      payload.id = `${reminder.id}-seq-${i + 1}`;

      // Add unique content variations to ensure distinct notifications
      const notificationHeading = i === 0
        ? "🔔 Appointment Reminder"
        : i === 1
        ? "⏰ Appointment Reminder (Final Call)"
        : "🚨 Last Reminder - Your Appointment Now!";

      payload.headings = { en: notificationHeading };

      // Add sequence info to the notification
      payload.data = {
        ...basePayload.data,
        notificationSequence: `${i + 1}/3`,
        reminderIndex: i + 1,
      };

      try {
        const response = await fetch(ONESIGNAL_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            Authorization: `Basic ${ONESIGNAL_API_KEY}`,
          },
          body: JSON.stringify(payload),
        });

        const responseText = await response.text();

        if (!response.ok) {
          console.error(`❌ Failed to send notification ${i + 1}:`, responseText);
        } else {
          console.log(`✅ Notification ${i + 1}/${notificationCount} sent successfully`);
          notificationsSent++;
        }
      } catch (error) {
        console.error(`❌ Error sending notification ${i + 1}:`, error);
      }
    }

    if (notificationsSent === 0) {
      console.error(`❌ Failed to send any reminder notifications`);
      return new Response(
        JSON.stringify({
          success: false,
          message: "Failed to send any reminder notifications",
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    console.log(`✅ ${notificationsSent}/${notificationCount} notifications sent successfully for reminder ${reminder.id}`);

    // Mark reminder as sent
    const { error: updateError } = await supabase
      .from("alert_reminders")
      .update({
        sent: true,
        sent_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", reminder.id);

    if (updateError) {
      console.error(`⚠️ Failed to mark reminder as sent:`, updateError);
      return new Response(
        JSON.stringify({
          success: true,
          message: "Notifications sent but database update failed",
          reminderId: reminder.id,
          notificationsSent,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    console.log(`✅ Reminder ${reminder.id} marked as sent`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Reminder sent (${notificationsSent} notifications) and marked as complete`,
        reminderId: reminder.id,
        bookingId: reminder.booking_id,
        notificationsSent,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } }
    );
  } catch (error) {
    console.error("❌ Error processing reminder:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: "Internal server error",
        error: String(error),
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders() } }
    );
  }
});
