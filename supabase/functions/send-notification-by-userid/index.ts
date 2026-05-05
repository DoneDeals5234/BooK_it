import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ONESIGNAL_APP_ID =
  Deno.env.get("ONESIGNAL_NATIVE_APP_ID") ||
  "1f14fad4-0d2f-465a-b3a8-e0e976b8729f";
const ONESIGNAL_API_KEY =
  Deno.env.get("ONESIGNAL_NATIVE_API_KEY") ||
  "os_v2_app_d4kpvvanf5dfvm5i4duxnodst5kkr67zyxkuwj44vlvi2y6pjyotclk455gx4phg4ou4w7pf3qed6af3imveg4gj55nt4ohgc3kyd4a";
const ONESIGNAL_API_URL = "https://onesignal.com/api/v1/notifications";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://database.donedeals.shop";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

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
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const {
      user_ids,
      userIds,
      title,
      body: messageBody,
      data,
      image,
      big_picture,
      large_icon,
      actionButtons,
    } = body;

    // Support both snake_case and camelCase
    const finalUserIds = user_ids || userIds || [];

    console.log("📱 Send notification by External ID (user_id) request received:", {
      title,
      messageBody,
      userIds: finalUserIds,
      hasData: !!data,
    });

    if (!finalUserIds || finalUserIds.length === 0) {
      console.error("❌ No user IDs (External IDs) provided");
      return new Response(
        JSON.stringify({ error: "user_ids or userIds array is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    if (!title || !messageBody) {
      console.error("❌ Missing title or message body");
      return new Response(
        JSON.stringify({ error: "title and body are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    // Filter out null/undefined values
    const validUserIds = finalUserIds.filter((id: any): id is string => 
      id !== null && id !== undefined && String(id).trim().length > 0
    );

    if (validUserIds.length === 0) {
      console.error("❌ No valid user IDs after filtering");
      return new Response(
        JSON.stringify({ error: "No valid user IDs provided" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    // PRIMARY: Fetch player IDs from user_devices table (where Kotlin saves them)
    console.log(`🔍 Looking up Player IDs for ${validUserIds.length} users in user_devices...`);
    const { data: userDevices } = await supabase
      .from("user_devices")
      .select("player_id, user_id")
      .in("user_id", validUserIds);

    // FALLBACK: Also check native_devices table
    const { data: nativeDevicesFallback } = await supabase
      .from("native_devices")
      .select("player_id, user_id")
      .in("user_id", validUserIds);

    // Combine both, deduplicate
    const allDevices = [...(userDevices || []), ...(nativeDevicesFallback || [])];
    const devices = allDevices;

    const playerIds = devices
      ?.map((d: any) => d.player_id)
      .filter((id: string) => id && id.length > 5 && id !== "null");
    
    // Deduplicate player IDs
    const uniquePlayerIds = [...new Set(playerIds)];

    console.log(`🎯 Hybrid targeting: ${validUserIds.length} External IDs and ${uniquePlayerIds?.length || 0} Subscription IDs`);
    console.log(`   (${(userDevices || []).length} from user_devices, ${(nativeDevicesFallback || []).length} from native_devices)`);

    // Use OneSignal's include_aliases to target users by their External ID
    // In OneSignal, External IDs are treated as aliases with label "external_id"
    // OneSignal.login(userId) sets the External ID which becomes an alias
    // IMPORTANT: When using include_aliases, must specify target_channel
    const payload: Record<string, unknown> = {
      app_id: ONESIGNAL_APP_ID,
      headings: { en: title },
      contents: { en: messageBody },
      include_aliases: {
        external_id: validUserIds, // Target by external_id alias
      },
      include_player_ids: playerIds, // Hybrid targeting
      target_channel: "push", // REQUIRED when using include_aliases
      // 🔔 Android: Heads-up notification settings (CRITICAL!)
      android_importance: 5, // HIGH - Shows as heads-up notification
      android_priority: 10, // For older Android versions
      android_small_icon: "scissors", // 🔪 Custom scissor icon instead of default bell
      // 🔔 iOS: High priority settings
      ios_badged: true,
      ios_sound: "default",
      ios_priority: 10, // HIGH priority for iOS
      mutable_content: true, // Allow iOS apps to modify the notification (needed for rich media)
    };

    if (data) {
      payload.data = data;
      console.log("📦 Attached data:", data);
    }
    // Images: Use for both small inline icon and big expanded picture
    if (image) {
      payload.image = image;
      payload.large_icon = image; // 🔪 Small inline image (Android)
    }
    if (big_picture) {
      payload.big_picture = big_picture;
      if (!image) {
        payload.large_icon = big_picture; // 🔪 Use as small icon if no separate image provided
      }
    }
    if (large_icon) {
      payload.large_icon = large_icon; // 🔪 Explicit large icon (Android) - takes precedence
    }
    if (actionButtons?.length) {
      payload.buttons = actionButtons;
      console.log("🔘 Action buttons:", actionButtons);
    }

    console.log("📡 Sending payload to OneSignal with External ID aliases (include_aliases):", JSON.stringify(payload, null, 2));

    const response = await fetch(ONESIGNAL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Basic ${ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();

    console.log(`📋 OneSignal response status: ${response.status}`);
    console.log(`📋 OneSignal response: ${responseText}`);

    if (!response.ok) {
      console.error("❌ OneSignal API Error:", responseText);
      return new Response(
        JSON.stringify({
          error: "Failed to send notification",
          details: responseText,
        }),
        { status: response.status, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    // Parse OneSignal response to get notification ID and check for errors
    let onesignalResponse: any;
    try {
      onesignalResponse = JSON.parse(responseText);
    } catch (e) {
      onesignalResponse = { body: responseText };
    }

    const notificationId = onesignalResponse.id || onesignalResponse.notification_id || "processed";
    const hasErrors = !!onesignalResponse.errors;

    if (hasErrors) {
      console.warn("⚠️ OneSignal reported partial errors:", JSON.stringify(onesignalResponse.errors, null, 2));
    }

    console.log(`✅ Notification processed for ${validUserIds.length} user(s)`);
    console.log(`✅ OneSignal notification ID: ${notificationId}`);

    return new Response(
      JSON.stringify({
        success: !hasErrors,
        partial_success: hasErrors,
        message: hasErrors 
          ? `Notification processed but OneSignal reported errors (likely invalid user IDs)` 
          : `Notification sent successfully to ${validUserIds.length} user(s) via External ID`,
        userIdsCount: validUserIds.length,
        notification_id: notificationId,
        errors: onesignalResponse.errors
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } }
    );
  } catch (error) {
    console.error("❌ Error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders() } }
    );
  }
});
