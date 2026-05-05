import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";

const ONESIGNAL_NATIVE_APP_ID =
  Deno.env.get("ONESIGNAL_NATIVE_APP_ID") ||
  "1f14fad4-0d2f-465a-b3a8-e0e976b8729f";
const ONESIGNAL_NATIVE_API_KEY =
  Deno.env.get("ONESIGNAL_NATIVE_API_KEY") ||
  "os_v2_app_d4kpvvanf5dfvm5i4duxnodst5kkr67zyxkuwj44vlvi2y6pjyotclk455gx4phg4ou4w7pf3qed6af3imveg4gj55nt4ohgc3kyd4a";

const ONESIGNAL_WEB_APP_ID =
  Deno.env.get("ONESIGNAL_WEB_APP_ID") ||
  "f2c5559b-9e99-4aa0-8924-237469824a88";
const ONESIGNAL_WEB_API_KEY =
  Deno.env.get("ONESIGNAL_WEB_API_KEY") ||
  "os_v2_app_6lcvlg46tffkbcjeen2gtaskrdv4e3u7e6cett55chp4tx5q4lddeibep5tzatwennibpbuty5ug462f7kia7vwks5ktcotovthz6ma";
const ONESIGNAL_API_URL = "https://onesignal.com/api/v1/notifications";

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
    // Initialize Supabase with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("📨 send-campaign function called - processing campaign");

    const body = await req.json();
    const { campaign_id } = body;

    if (!campaign_id) {
      return new Response(
        JSON.stringify({ error: "campaign_id is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    console.log(`📢 Starting campaign send: ${campaign_id}`);

    // 1. Fetch campaign
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

    console.log(`✅ Campaign found: ${campaign.title}`);

    // 2. Fetch campaign targets
    const { data: targets, error: targetsError } = await supabase
      .from("campaign_targets")
      .select("*")
      .eq("campaign_id", campaign_id);

    if (targetsError) {
      console.error("Error fetching targets:", targetsError);
      return new Response(
        JSON.stringify({ error: "Error fetching campaign targets" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    console.log(`📍 Found ${targets.length} target(s)`);

    // 3. Query user_profiles to find matching users based on campaign targets
    console.log(`📊 Finding matching users from user_profiles table...`);

    let query = supabase
      .from("user_profiles")
      .select("user_id, country, state, district, village, address");

    const target = targets.length > 0 ? targets[0] : null;

    if (target) {
      console.log(`🎯 Target location filters:`, {
        country: target.country,
        state: target.state || 'not specified',
        district: target.district || 'not specified',
        village: target.village || 'not specified'
      });

      // Build query with filters
      if (target.country) {
        console.log(`  → Filtering by country: "${target.country}"`);
        query = query.eq("country", target.country);
      }
      if (target.state) {
        console.log(`  → Filtering by state: "${target.state}"`);
        query = query.eq("state", target.state);
      }
      if (target.district) {
        console.log(`  → Filtering by district: "${target.district}"`);
        query = query.eq("district", target.district);
      }
      if (target.village) {
        console.log(`  → Filtering by village: "${target.village}"`);
        query = query.eq("village", target.village);
      }
    } else {
      console.warn(`⚠️ No campaign targets found - will send to no users`);
    }

    console.log(`📤 Executing query on user_profiles table...`);
    const { data: matchedUsers, error: usersError } = await query;

    if (usersError) {
      console.error("❌ Error fetching matched users:", usersError);
      console.error("  Code:", usersError.code);
      console.error("  Message:", usersError.message);
      return new Response(
        JSON.stringify({
          error: "Error fetching matched users",
          details: `${usersError.code}: ${usersError.message}`,
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    console.log(`📊 Query result: ${matchedUsers?.length || 0} matching user(s) found`);

    if (matchedUsers && matchedUsers.length > 0) {
      console.log(`✅ Sample of matched user IDs: ${matchedUsers.slice(0, 5).map(u => u.user_id).join(', ')}`);
    }

    if (!matchedUsers || matchedUsers.length === 0) {
      return new Response(
        JSON.stringify({
          error: "No devices found for matched users",
          details: "The target location did not match any users in the database",
          target_requested: target ? `${target.village || '?'}/${target.district || '?'}/${target.state || '?'}/${target.country || '?'}` : "none"
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    console.log(`✅ Matched users:`, matchedUsers.map(u => ({
      userId: u.user_id,
      location: `${u.village || '?'}/${u.district || '?'}/${u.state || '?'}/${u.country || '?'}`,
    })));

    // 4. Store matched users in campaign_matched_users table for record-keeping
    console.log(`💾 Storing matched users in campaign_matched_users table...`);
    const campaignMatchedUsers = matchedUsers.map((user) => ({
      campaign_id: campaign_id,
      user_id: user.user_id,
    }));

    const { error: storeMatchedError } = await supabase
      .from("campaign_matched_users")
      .insert(campaignMatchedUsers);

    if (storeMatchedError) {
      console.error("⚠️ Warning: Failed to store matched users (non-critical):", storeMatchedError);
      // Don't fail - we still have the users, just couldn't record them
    } else {
      console.log(`✅ Stored ${campaignMatchedUsers.length} matched users`);
    }

    // 4. Get user IDs for sending notifications (extract user_id from matched users)
    const userIds = matchedUsers.map((u) => u.user_id);

    console.log(`📱 Found ${userIds.length} user(s) to send notifications to: ${userIds.join(', ')}`);

    // 5. Call send-notification-by-userid function (same approach as custom notification button)
    // This ensures consistency and proper OneSignal alias handling
    const notificationFunctionUrl = `${supabaseUrl}/functions/v1/send-notification-by-userid`;

    const notificationPayload = {
      user_ids: userIds,
      title: campaign.title,
      body: campaign.message,
      data: {
        campaign_id: campaign_id,
        type: "campaign",
      },
    };

    // Add image if available (same as custom notifications)
    if (campaign.image_url) {
      notificationPayload.big_picture = campaign.image_url;
      notificationPayload.image = campaign.image_url;
      notificationPayload.large_icon = campaign.image_url;
      console.log(`📸 Campaign includes image: ${campaign.image_url}`);
    }

    console.log(`📦 Notification Payload:`, {
      title: notificationPayload.title,
      message: notificationPayload.body,
      userIds: userIds.length,
      hasImage: !!campaign.image_url,
      imageUrl: campaign.image_url || 'none'
    });

    console.log(`📡 Calling send-notification-by-userid function to send to ${userIds.length} user(s)`);
    console.log(`📡 Function URL: ${notificationFunctionUrl}`);

    const response = await fetch(notificationFunctionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(notificationPayload),
    });

    const responseText = await response.text();
    console.log(`📋 Notification function response status: ${response.status}`);
    console.log(`📋 Notification function response body: ${responseText}`);

    if (!response.ok) {
      console.error("❌ Notification function returned error");
      console.error("  Status:", response.status);
      console.error("  Response:", responseText);

      // Try to parse error details
      let errorDetails = responseText;
      try {
        const parsedError = JSON.parse(responseText);
        errorDetails = JSON.stringify(parsedError, null, 2);
      } catch (e) {
        // Keep as is if not JSON
      }

      return new Response(
        JSON.stringify({
          error: "Failed to send campaign notifications",
          details: errorDetails,
          userIds: userIds,
          userIdsCount: userIds.length,
        }),
        { status: response.status, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    let notificationResponse;
    try {
      notificationResponse = JSON.parse(responseText);
    } catch (e) {
      notificationResponse = { message: responseText };
    }

    const notificationId = notificationResponse.notification_id || "processed";

    console.log(`✅ Campaign notification sent via send-notification-by-userid function`);
    console.log(`✅ Response:`, JSON.stringify(notificationResponse, null, 2));

    // 6. Log campaign sends to campaign_logs
    const campaignLogs = matchedUsers.map((user) => ({
      campaign_id,
      user_id: user.user_id,
      onesignal_notification_id: notificationId,
      status: "sent",
    }));

    if (campaignLogs.length > 0) {
      const { error: logsError } = await supabase
        .from("campaign_logs")
        .insert(campaignLogs);

      if (logsError) {
        console.error("Error logging campaign sends:", logsError);
      }
    }

    // 7. Update campaign status and sent_at
    const { error: updateError } = await supabase
      .from("campaigns")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .eq("id", campaign_id);

    if (updateError) {
      console.error("Error updating campaign status:", updateError);
    }

    // 8. Create/update campaign analytics
    const { error: analyticsError } = await supabase
      .from("campaign_analytics")
      .upsert({
        campaign_id,
        total_recipients: matchedUsers.length,
        total_sent: userIds.length,
        updated_at: new Date().toISOString(),
      }, { onConflict: "campaign_id" });

    if (analyticsError) {
      console.error("Error updating campaign analytics:", analyticsError);
    }

    console.log(`✅ Campaign ${campaign_id} sent successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Campaign sent to ${userIds.length} user(s)`,
        campaign_id,
        matched_count: matchedUsers.length,
        sent_count: userIds.length,
        notification_id: notificationId,
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
