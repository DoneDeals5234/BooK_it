import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

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

        // TRIGGER FCM NOTIFICATION
        try {
          console.log(`🔔 Sending FCM reminder for user ${reminder.user_id}...`);
          
          const notifyUrl = `${SUPABASE_URL}/functions/v1/send-notification-by-userid`;
          const resp = await fetch(notifyUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
            },
            body: JSON.stringify({
              user_ids: [reminder.user_id],
              title: "🔔 Appointment Reminder",
              body: `Are you ready to come to ${reminder.shop_name} for your appointment at ${reminder.time_slot}?`,
              data: {
                bookingId: reminder.booking_id,
                tokenNumber: String(reminder.token_number),
                shopName: reminder.shop_name,
                userName: reminder.user_name,
                timeSlot: reminder.time_slot,
                shopId: reminder.shop_id,
                actionType: "reminder",
              }
            }),
          });

          const respData = await resp.json();
          console.log(`✅ FCM reminder sent for ${reminder.id}:`, respData);

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
              status: "sent_but_not_marked",
              error: "Database update failed",
            });
            failureCount++;
          } else {
            successCount++;
            results.push({
              reminderId: reminder.id,
              status: "sent",
              fcm_response: respData
            });
          }
        } catch (fcmError) {
          console.error(`❌ FCM reminder failed for ${reminder.id}:`, fcmError);
          failureCount++;
          results.push({
            reminderId: reminder.id,
            status: "error",
            error: String(fcmError),
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



