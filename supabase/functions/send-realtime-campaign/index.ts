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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { campaign_id, target } = body;

    if (!campaign_id) {
      return new Response(JSON.stringify({ error: "campaign_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    console.log(`🚀 Processing hybrid campaign: ${campaign_id}`);

    // 1. Fetch Campaign Data
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaign_id)
      .single();

    if (campaignError || !campaign) {
      throw new Error(`Campaign not found: ${campaignError?.message}`);
    }

    // 2. BROADCAST: Insert into campaign_broadcasts table
    // This table is watched by all clients via Supabase Realtime (postgres_changes)
    console.log("📡 Inserting into campaign_broadcasts table for Realtime trigger");
    
    const { error: broadcastError } = await supabase
      .from("campaign_broadcasts")
      .insert({
        campaign_id: campaign.id,
        title: campaign.title,
        message: campaign.message,
        image_url: campaign.image_url,
        shop_id: campaign.shop_id,
        target: target || {}
      });

    if (broadcastError) {
      console.error("⚠️ Realtime broadcast insert failed:", broadcastError.message, broadcastError.code);
      console.error("Details:", JSON.stringify(broadcastError, null, 2));
      // We continue to OneSignal even if this fails
    } else {
      console.log("✅ Realtime broadcast record created successfully");
    }
    
    // 3. BACKUP: Trigger OneSignal (via existing send-campaign logic)
    console.log(`🏹 Triggering OneSignal backup via: ${supabaseUrl}/functions/v1/send-campaign`);
    const onesignalFunctionUrl = `${supabaseUrl}/functions/v1/send-campaign`;
    
    try {
      const resp = await fetch(onesignalFunctionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({ campaign_id })
      });
      
      const respData = await resp.text();
      console.log(`✅ OneSignal backup response: ${resp.status}`);
      console.log(`📋 Backup response body: ${respData}`);
    } catch (err) {
      console.error("❌ OneSignal backup failed to trigger (fetch error):", err.message);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Campaign broadcast initiated and backup triggered",
        campaign_id 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } }
    );
  } catch (error) {
    console.error("❌ Error in send-realtime-campaign:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders() } }
    );
  }
});
