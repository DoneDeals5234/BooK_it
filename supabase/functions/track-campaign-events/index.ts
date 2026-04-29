import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";

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
    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { event, data } = body;

    console.log(`📊 Campaign event received: ${event}`, data);

    if (!event || !data) {
      return new Response(
        JSON.stringify({ error: "event and data are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    const { notification_id, external_user_id, campaign_id, timestamp } = data;

    if (!notification_id || !external_user_id || !campaign_id) {
      console.log("⚠️ Missing required fields for event tracking");
      return new Response(
        JSON.stringify({ success: true, message: "Event received but missing fields" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    // Find the campaign log entry
    const { data: logEntry, error: findError } = await supabase
      .from("campaign_logs")
      .select("id")
      .eq("campaign_id", campaign_id)
      .eq("user_id", external_user_id)
      .eq("onesignal_notification_id", notification_id)
      .single();

    if (findError || !logEntry) {
      console.log("⚠️ Campaign log not found, skipping update");
      return new Response(
        JSON.stringify({ success: true, message: "Log entry not found" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    // Map event type to status
    let status = "sent";
    let updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

    switch (event) {
      case "delivered":
        status = "delivered";
        updateData.status = "delivered";
        updateData.delivered_at = new Date(timestamp).toISOString();
        break;
      case "opened":
        status = "opened";
        updateData.status = "opened";
        updateData.opened_at = new Date(timestamp).toISOString();
        break;
      case "failed":
        status = "failed";
        updateData.status = "failed";
        break;
      case "bounced":
        status = "bounced";
        updateData.status = "bounced";
        break;
      default:
        console.log(`⚠️ Unknown event type: ${event}`);
        return new Response(
          JSON.stringify({ success: true, message: "Event recorded but type unknown" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } }
        );
    }

    // Update campaign log with new status
    const { error: updateError } = await supabase
      .from("campaign_logs")
      .update(updateData)
      .eq("id", logEntry.id);

    if (updateError) {
      console.error("Error updating campaign log:", updateError);
      return new Response(
        JSON.stringify({ error: "Error updating campaign log" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    // Update campaign analytics (recalculate counts)
    const { data: analytics } = await supabase
      .from("campaign_logs")
      .select("status")
      .eq("campaign_id", campaign_id);

    if (analytics) {
      const counts = {
        total_sent: analytics.length,
        total_delivered: analytics.filter((log) => log.status === "delivered" || log.status === "opened").length,
        total_opened: analytics.filter((log) => log.status === "opened").length,
        total_failed: analytics.filter((log) => log.status === "failed").length,
      };

      const deliveryRate = counts.total_sent > 0 ? (counts.total_delivered / counts.total_sent * 100).toFixed(2) : "0";
      const openRate = counts.total_sent > 0 ? (counts.total_opened / counts.total_sent * 100).toFixed(2) : "0";

      await supabase
        .from("campaign_analytics")
        .update({
          total_sent: counts.total_sent,
          total_delivered: counts.total_delivered,
          total_opened: counts.total_opened,
          total_failed: counts.total_failed,
          delivery_rate: parseFloat(deliveryRate),
          open_rate: parseFloat(openRate),
          updated_at: new Date().toISOString(),
        })
        .eq("campaign_id", campaign_id);
    }

    console.log(`✅ Campaign event ${event} tracked for ${external_user_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Event ${event} tracked successfully`,
        campaign_id,
        event,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders() } }
    );
  }
});
