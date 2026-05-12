import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";

// ── Supabase config ──────────────────────────────────────────────────────────
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("OK", { status: 200, headers: corsHeaders() });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const body = await req.json();
    const { campaign_id } = body;

    if (!campaign_id) {
      return new Response(JSON.stringify({ error: "campaign_id is required" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders() } });
    }

    console.log(`📢 Processing FCM campaign: ${campaign_id}`);

    // 1. Fetch campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaign_id)
      .single();

    if (campaignError || !campaign) {
      return new Response(JSON.stringify({ error: "Campaign not found" }), { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders() } });
    }

    // 2. Fetch targets
    const { data: targets } = await supabase.from("campaign_targets").select("*").eq("campaign_id", campaign_id);
    const target = targets?.[0];

    if (!target) {
      return new Response(JSON.stringify({ error: "No targets defined" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders() } });
    }

    // 3. Find matching users
    let query = supabase.from("user_profiles").select("user_id").eq("country", target.country);
    if (target.state) query = query.eq("state", target.state);
    if (target.district) query = query.eq("district", target.district);
    if (target.village) query = query.eq("village", target.village);

    const { data: matchedUsers } = await query;
    if (!matchedUsers || matchedUsers.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "No users matched criteria" }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } });
    }

    const userIds = matchedUsers.map(u => u.user_id);
    console.log(`🎯 Matched ${userIds.length} users. Sending FCM...`);

    // 4. Send via send-native-notification function
    const nativeNotifyUrl = `${SUPABASE_URL}/functions/v1/send-native-notification`;
    const resp = await fetch(nativeNotifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}` },
      body: JSON.stringify({
        userIds,
        title: campaign.title,
        body: campaign.message,
        data: { campaign_id, type: "campaign" }
      })
    });

    const respData = await resp.json();

    // 5. Update campaign status
    await supabase.from("campaigns").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", campaign_id);

    return new Response(JSON.stringify({ 
      success: true, 
      matched_count: userIds.length, 
      fcm_response: respData 
    }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } });

  } catch (error) {
    console.error("❌ Error:", error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders() } });
  }
});
