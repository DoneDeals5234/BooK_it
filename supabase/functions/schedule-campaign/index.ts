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
    console.log("⏰ schedule-campaign function called - processing scheduled campaign");

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { campaign_id, scheduled_at } = body;

    if (!campaign_id || !scheduled_at) {
      return new Response(
        JSON.stringify({ error: "campaign_id and scheduled_at are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    // Verify the date is in the future
    const scheduledDate = new Date(scheduled_at);
    if (scheduledDate <= new Date()) {
      return new Response(
        JSON.stringify({ error: "Scheduled time must be in the future" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    console.log(`⏰ Scheduling campaign ${campaign_id} for ${scheduled_at}`);

    // Fetch campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaign_id)
      .single();

    if (campaignError || !campaign) {
      console.error("Campaign not found or unauthorized:", campaignError);
      return new Response(
        JSON.stringify({ error: "Campaign not found or unauthorized" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    // Update campaign status to scheduled
    const { error: updateError } = await supabase
      .from("campaigns")
      .update({
        status: "scheduled",
        scheduled_at: scheduledDate.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaign_id);

    if (updateError) {
      console.error("Error updating campaign:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to schedule campaign" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    console.log(`✅ Campaign ${campaign_id} scheduled for ${scheduled_at}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Campaign scheduled successfully",
        campaign_id,
        scheduled_at: scheduledDate.toISOString(),
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
