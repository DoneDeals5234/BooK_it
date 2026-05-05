import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const ONESIGNAL_APP_ID =
  Deno.env.get("ONESIGNAL_NATIVE_APP_ID") ||
  "1f14fad4-0d2f-465a-b3a8-e0e976b8729f";
const ONESIGNAL_API_KEY =
  Deno.env.get("ONESIGNAL_NATIVE_API_KEY") ||
  "os_v2_app_d4kpvvanf5dfvm5i4duxnodst5kkr67zyxkuwj44vlvi2y6pjyotclk455gx4phg4ou4w7pf3qed6af3imveg4gj55nt4ohgc3kyd4a";
const ONESIGNAL_API_URL = "https://onesignal.com/api/v1/notifications";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://database.donedeals.shop";
const SUPABASE_SERVICE_KEY = Deno.env.get("SERVICE_ROLE_KEY") || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ta3JmZWh1dmZ0bnR1cWpteHFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTkwNDM4MywiZXhwIjoyMDc3NDgwMzgzfQ.XGaLped_nvzTiQnycJHnodgYGb2QIA5N_-f3Qe8K3Xo";

const IST_OFFSET_HOURS = 5.5; // IST is UTC+5:30

console.log("🔔 Be Alert Reminders function loaded (checks every 1 minute via cron)");

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

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
    console.log("⏰ Starting reminder check at", new Date().toISOString());

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Get all pending reminders that are due NOW
    // The scheduled_for field should be stored in UTC
    const now = new Date();
    console.log(`🔍 Current UTC time: ${now.toISOString()}`);
    console.log(`🔍 Current IST time: ${new Date(now.getTime() + IST_OFFSET_HOURS * 60 * 60 * 1000).toISOString()}`);

    const { data: pendingReminders, error: queryError } = await supabase
      .from("alert_reminders")
      .select("*")
      .eq("sent", false)
      .lte("scheduled_for", now.toISOString())
      .order("scheduled_for", { ascending: true });

    if (queryError) {
      console.error("❌ Error querying pending reminders:", queryError);
      return new Response(
        JSON.stringify({ error: "Failed to query reminders", details: queryError }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    if (!pendingReminders || pendingReminders.length === 0) {
      console.log("✅ No pending reminders at this time");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No pending reminders",
          processedCount: 0,
          timestamp: now.toISOString(),
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    console.log(`📬 Found ${pendingReminders.length} reminder(s) to send`);

    let successCount = 0;
    let failureCount = 0;
    const results = [];

    // Process each pending reminder
    for (const reminder of pendingReminders) {
      try {
        console.log(
          `📤 Processing reminder ${reminder.id} for booking ${reminder.booking_id} to user ${reminder.user_id}`
        );

        // Build base notification payload using include_aliases pattern (like send-notification-by-userid)
        const basePayload: Record<string, unknown> = {
          app_id: ONESIGNAL_APP_ID,
          headings: { en: "🔔 Appointment Reminder" },
          contents: {
            en: `Are you ready to come to ${reminder.shop_name} for your appointment at ${reminder.time_slot}?`,
          },
          include_aliases: {
            external_id: [reminder.user_id], // Target by external_id alias
          },
          target_channel: "push", // ✅ Required when using targeting by alias
          data: {
            bookingId: reminder.booking_id,
            tokenNumber: String(reminder.token_number),
            shopName: reminder.shop_name,
            userName: reminder.user_name,
            timeSlot: reminder.time_slot,
            shopId: reminder.shop_id,
            actionType: "reminder",
          },
          // Unified buttons for web and native - allows users to respond directly from notification
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
          isAndroid: true,
          isIos: true,
          // Android heads-up notification settings with MAXIMUM priority
          android_importance: 5, // MAXIMUM (5) - Shows as heads-up notification with sound/vibration
          android_priority: 10, // MAXIMUM (10) - For older Android versions
          // 🔔 Android: Custom 6-second alarm sound
          android_sound: "https://cdn.builder.io/o/assets%2Feb9adfe1406b4af7a3d0ffeb05e4f67c%2F33c43978ea664c249ea07a12740e2204?alt=media&token=f4aada56-14c4-4a27-a5f6-1b9838a08133&apiKey=eb9adfe1406b4af7a3d0ffeb05e4f67c",
          // 🔔 iOS: Keep default single blink sound
          ios_sound: "default",
          ios_badged: true,
          // Additional high-priority settings
          big_picture: true,
          ios_critical_sound: true,
        };

        console.log(`📡 Sending 3 reminder notifications to OneSignal for user ${reminder.user_id}`);
        console.log(`   Booking: ${reminder.shop_name} at ${reminder.time_slot}`);

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
              console.error(
                `❌ Failed to send reminder ${reminder.id} notification ${i + 1}:`,
                responseText
              );
            } else {
              console.log(
                `✅ Notification ${i + 1}/${notificationCount} sent successfully to OneSignal for reminder ${reminder.id}`
              );
              notificationsSent++;
            }
          } catch (error) {
            console.error(`❌ Error sending notification ${i + 1}:`, error);
          }
        }

        if (notificationsSent === 0) {
          console.error(
            `❌ Failed to send any reminder notifications for reminder ${reminder.id}`
          );
          results.push({
            reminderId: reminder.id,
            bookingId: reminder.booking_id,
            userId: reminder.user_id,
            status: "failed",
            error: "All notification sends failed",
          });
          failureCount++;
          continue;
        }

        console.log(
          `✅ ${notificationsSent} notification(s) sent successfully to OneSignal for reminder ${reminder.id}`
        );

        // Mark reminder as sent in database
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
          results.push({
            reminderId: reminder.id,
            bookingId: reminder.booking_id,
            userId: reminder.user_id,
            status: "sent_but_not_marked",
            error: "Database update failed",
            notificationsSent,
          });
          failureCount++;
        } else {
          console.log(`✅ Reminder ${reminder.id} marked as sent in database`);
          successCount++;
          results.push({
            reminderId: reminder.id,
            bookingId: reminder.booking_id,
            userId: reminder.user_id,
            status: "sent",
            notificationsSent,
          });
        }
      } catch (error) {
        console.error(`❌ Error processing reminder ${reminder.id}:`, error);
        failureCount++;
        results.push({
          reminderId: reminder.id,
          bookingId: reminder.booking_id,
          userId: reminder.user_id,
          status: "error",
          error: String(error),
        });
      }
    }

    console.log(
      `📊 Processing complete: ${successCount} sent, ${failureCount} failed`
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: "Scheduled reminders processed",
        totalPending: pendingReminders.length,
        successCount,
        failureCount,
        results,
        timestamp: now.toISOString(),
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } }
    );
  } catch (error) {
    console.error("❌ Error in be-alert-reminders:", error);
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
