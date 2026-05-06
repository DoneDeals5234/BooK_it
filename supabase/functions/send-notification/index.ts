import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Use native app credentials for native devices, web credentials for web
const ONESIGNAL_NATIVE_APP_ID =
  Deno.env.get("ONESIGNAL_NATIVE_APP_ID") ||
  "1f14fad4-0d2f-465a-b3a8-e0e976b8729f";
const ONESIGNAL_NATIVE_API_KEY =
  "os_v2_app_d4kpvvanf5dfvm5i4duxnodst5kkr67zyxkuwj44vlvi2y6pjyotclk455gx4phg4ou4w7pf3qed6af3imveg4gj55nt4ohgc3kyd4a";

const ONESIGNAL_WEB_APP_ID =
  Deno.env.get("ONESIGNAL_WEB_APP_ID") ||
  "f2c5559b-9e99-4aa0-8924-237469824a88";
const ONESIGNAL_WEB_API_KEY =
  Deno.env.get("ONESIGNAL_WEB_API_KEY") ||
  "os_v2_app_d4kpvvanf5dfvm5i4duxnodst5kkr67zyxkuwj44vlvi2y6pjyotclk455gx4phg4ou4w7pf3qed6af3imveg4gj55nt4ohgc3kyd4a";
const ONESIGNAL_API_URL = "https://onesignal.com/api/v1/notifications";

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
    const body = await req.json();
    const { include_player_ids, include_subscription_ids, playerIds, subscriptionIds, title, body: messageBody, data, actionButtons, image, big_picture } = body;

    console.log('📋 Notification request received:', {
      title,
      messageBody,
      playerIds: playerIds?.length || 0,
      subscriptionIds: subscriptionIds?.length || 0,
      hasData: !!data,
      hasActionButtons: !!actionButtons?.length,
    });

    const finalPlayerIds = include_player_ids || playerIds;
    const finalSubscriptionIds = include_subscription_ids || subscriptionIds;

    if (!finalPlayerIds && !finalSubscriptionIds) {
      console.error('❌ No player IDs or subscription IDs provided');
      return new Response(
        JSON.stringify({ error: "playerIds or subscriptionIds required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    if (!title || !messageBody) {
      console.error('❌ Missing title or message body');
      return new Response(
        JSON.stringify({ error: "title and body are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    // Determine if this is a native or web notification
    const isNative = !!finalPlayerIds?.length;
    const appId = isNative ? ONESIGNAL_NATIVE_APP_ID : ONESIGNAL_WEB_APP_ID;
    const apiKey = isNative ? ONESIGNAL_NATIVE_API_KEY : ONESIGNAL_WEB_API_KEY;

    console.log(`🔐 Using ${isNative ? 'NATIVE' : 'WEB'} OneSignal App ID: ${appId}`);

    const payload: Record<string, unknown> = {
      app_id: appId,
      headings: { en: title },
      contents: { en: messageBody },
    };

    if (finalPlayerIds?.length) {
      payload.include_player_ids = finalPlayerIds;
      console.log(`📤 Sending to ${finalPlayerIds.length} native player(s)`, finalPlayerIds);
      // 🔔 Android: Heads-up notification settings for native devices
      payload.android_importance = 5; // HIGH - Shows as heads-up notification
      payload.android_priority = 10; // For older Android versions
      payload.android_small_icon = "scissors"; // 🔪 Custom scissor icon instead of default bell
      payload.ios_badged = true;
      payload.ios_sound = "default";
    }
    if (finalSubscriptionIds?.length) {
      payload.include_subscription_ids = finalSubscriptionIds;
      console.log(`📤 Sending to ${finalSubscriptionIds.length} web subscription(s)`, finalSubscriptionIds);
    }
    if (data) {
      payload.data = data;
      console.log('📦 Attached data:', data);
    }
    if (image) payload.image = image;
    if (big_picture) payload.big_picture = big_picture;
    if (actionButtons?.length) {
      payload.web_buttons = actionButtons;
      console.log('🔘 Action buttons:', actionButtons);
    }

    console.log('📡 Sending payload to OneSignal:', JSON.stringify(payload, null, 2));

    const response = await fetch(ONESIGNAL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Key ${apiKey}`,
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

    console.log('✅ Notification sent successfully');
    return new Response(
      JSON.stringify({ success: true, message: "Notification sent successfully" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } }
    );
  } catch (error) {
    console.error("❌ Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders() } }
    );
  }
});


