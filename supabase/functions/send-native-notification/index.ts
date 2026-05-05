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
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

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
    const {
      include_player_ids,
      playerIds,
      title,
      body: messageBody,
      data,
      image,
      big_picture,
      actionButtons,
      excludeCurrentUser,
      currentUserPlayerId,
      userIds,
    } = body;

    console.log("📱 Native notification request received:", {
      title,
      messageBody,
      playerIds: playerIds?.length || 0,
      userIds: userIds?.length || 0,
      hasData: !!data,
      excludeCurrentUser,
    });

    let finalPlayerIds = include_player_ids || playerIds || [];

    // If userIds provided, fetch their player IDs from native_devices table
    if (userIds && userIds.length > 0) {
      console.log("🔍 Fetching player IDs for userIds:", userIds);
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

      const { data: nativeDevices, error: fetchError } = await supabase
        .from("native_devices")
        .select("player_id")
        .in("user_id", userIds)
        .not("player_id", "is", null);

      if (fetchError) {
        console.error("❌ Error fetching native devices:", fetchError);
      } else {
        const fetchedPlayerIds = nativeDevices
          .map((d: any) => d.player_id)
          .filter((id): id is string => id !== null && id !== undefined);
        finalPlayerIds = [...new Set([...finalPlayerIds, ...fetchedPlayerIds])];
        console.log(`📱 Found ${fetchedPlayerIds.length} native device(s) for these users`);
      }
    }

    // Exclude current user's device if requested
    if (excludeCurrentUser && currentUserPlayerId && Array.isArray(finalPlayerIds)) {
      const originalLength = finalPlayerIds.length;
      finalPlayerIds = finalPlayerIds.filter((id) => id !== currentUserPlayerId);
      if (finalPlayerIds.length < originalLength) {
        console.log("⏭️ Excluded current user from notification");
      }
    }

    if (!finalPlayerIds || finalPlayerIds.length === 0) {
      console.error("❌ No player IDs provided for native devices");
      return new Response(
        JSON.stringify({ error: "playerIds, userIds, or include_player_ids required" }),
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

    const payload: Record<string, unknown> = {
      app_id: ONESIGNAL_APP_ID,
      headings: { en: title },
      contents: { en: messageBody },
      include_player_ids: finalPlayerIds,
      // 🔔 Android: Heads-up notification settings
      android_importance: 5, // HIGH - Shows as heads-up notification (critical for heads-up!)
      android_priority: 10, // For older Android versions
      android_small_icon: "scissors", // 🔪 Custom scissor icon instead of default bell
      // 🔔 iOS: High priority for immediate delivery
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
    if (actionButtons?.length) {
      // For native (Android/iOS), use buttons format
      payload.buttons = actionButtons;
      console.log("🔘 Native action buttons:", actionButtons);
    }

    console.log("📡 Sending payload to OneSignal for native devices (with HIGH importance for heads-up):", JSON.stringify(payload, null, 2));

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

    console.log("✅ Native notification sent successfully");
    return new Response(
      JSON.stringify({
        success: true,
        message: "Native notification sent successfully",
        playerIdsCount: finalPlayerIds.length,
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
