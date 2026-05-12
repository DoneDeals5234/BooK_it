import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch pending notifications from queue (limit to 10 per run)
    const { data: pendingNotifications, error: fetchError } = await supabase
      .from("booking_notification_queue")
      .select("*")
      .eq("status", "pending")
      .lt("retry_count", 3)
      .order("created_at", { ascending: true })
      .limit(10);

    if (fetchError) {
      throw new Error(`Failed to fetch notifications: ${fetchError.message}`);
    }

    if (!pendingNotifications || pendingNotifications.length === 0) {
      return new Response(
        JSON.stringify({ message: "No pending notifications", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${pendingNotifications.length} pending notifications`);

    let successCount = 0;
    let failureCount = 0;

    // Process each notification
    for (const notification of pendingNotifications) {
      try {
        // TRIGGER FCM NOTIFICATION
        console.log(`🔔 Sending FCM trigger to user ${notification.shop_owner_user_id}...`);
        
        const notifyUrl = `${supabaseUrl}/functions/v1/send-notification-by-userid`;
        const resp = await fetch(notifyUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            user_ids: [notification.shop_owner_user_id],
            title: notification.notification_title,
            body: notification.notification_body,
            data: notification.notification_data || {}
          }),
        });

        if (!resp.ok) {
          const errorBody = await resp.text();
          throw new Error(`FCM error: ${resp.status} - ${errorBody}`);
        }

        const result = await resp.json();
        console.log(`Notification sent successfully via FCM.`);

        // Mark notification as sent
        const { error: updateError } = await supabase
          .from("booking_notification_queue")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
          })
          .eq("id", notification.id);

        if (updateError) {
          console.error(`Failed to update notification status: ${updateError.message}`);
          failureCount++;
        } else {
          successCount++;
        }
      } catch (error) {
        console.error(
          `Error processing notification ${notification.id}:`,
          error.message
        );

        // Increment retry count
        const { error: updateError } = await supabase
          .from("booking_notification_queue")
          .update({
            retry_count: (notification.retry_count || 0) + 1,
            status: notification.retry_count >= 2 ? "failed" : "pending",
          })
          .eq("id", notification.id);

        if (updateError) {
          console.error(`Failed to update retry count: ${updateError.message}`);
        }

        failureCount++;
      }
    }

    return new Response(
      JSON.stringify({
        message: "Notifications processed",
        processed: pendingNotifications.length,
        success: successCount,
        failed: failureCount,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in process-booking-notifications:", error.message);

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

