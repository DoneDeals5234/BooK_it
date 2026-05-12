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

    // 2. BROADCAST: Insert into campaign_broadcasts table for Realtime listeners
    console.log("📡 Inserting into campaign_broadcasts for Realtime trigger");
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
      console.error("⚠️ Realtime broadcast insert failed:", broadcastError.message);
    } else {
      console.log("✅ Realtime broadcast record created");
    }

    // 3. FCM: Fetch matching user IDs from user_profiles based on target geography
    let userIds: string[] = [];
    try {
      // Fetch targets from campaign_targets table
      const { data: targets } = await supabase
        .from("campaign_targets")
        .select("*")
        .eq("campaign_id", campaign_id);
      
      const campaignTarget = targets?.[0] || target;
      console.log(`🎯 Targeting criteria:`, JSON.stringify(campaignTarget));

      let hasFilters = campaignTarget && (campaignTarget.country || campaignTarget.state || campaignTarget.district || campaignTarget.village);

      if (hasFilters) {
        let query = supabase.from("user_profiles").select("user_id");
        if (campaignTarget.country) query = query.eq("country", campaignTarget.country);
        if (campaignTarget.state) query = query.eq("state", campaignTarget.state);
        if (campaignTarget.district) query = query.eq("district", campaignTarget.district);
        if (campaignTarget.village) query = query.eq("village", campaignTarget.village);

        const { data: matchedUsers } = await query;
        userIds = (matchedUsers || []).map((u: any) => u.user_id).filter(Boolean);
        console.log(`🎯 Matched ${userIds.length} users by geography`);
      }

      // If no geography filter matched or no filters provided, fall back to ALL users with FCM tokens
      if (userIds.length === 0) {
        console.log("⚠️ No geographic match or no filters — broadcasting to ALL users with FCM tokens");
        const { data: allDevices } = await supabase
          .from("native_devices")
          .select("user_id")
          .not("fcm_token", "is", null);
        
        userIds = [...new Set((allDevices || []).map((d: any) => d.user_id))];
        console.log(`📱 Total broadcast target: ${userIds.length} users`);
      }
    } catch (e) {
      console.error("❌ Error fetching target users:", e);
    }

    // 4. Send FCM notification directly via send-native-notification
    let fcmResult: any = null;
    if (userIds.length > 0) {
      console.log(`🔥 Sending campaign FCM to ${userIds.length} users...`);
      const fcmResp = await fetch(`${supabaseUrl}/functions/v1/send-native-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({
          userIds,
          title: campaign.title,
          body: campaign.message,
          data: {
            type: "campaign",
            campaign_id,
            route: "/",
            ...(campaign.image_url ? { imageUrl: campaign.image_url } : {}),
            ...(campaign.shop_id ? { shop_id: campaign.shop_id } : {})
          }
        })
      });
      fcmResult = await fcmResp.json();
      console.log(`✅ FCM campaign result: ${fcmResp.status} —`, JSON.stringify(fcmResult));
    } else {
      console.warn("⚠️ No users to send campaign to");
    }

    // 5. Update campaign status
    await supabase
      .from("campaigns")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", campaign_id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Campaign broadcast initiated",
        campaign_id,
        users_targeted: userIds.length,
        fcm_result: fcmResult
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
