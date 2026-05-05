import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ONESIGNAL_APP_ID =
  Deno.env.get("ONESIGNAL_NATIVE_APP_ID") ||
  "1f14fad4-0d2f-465a-b3a8-e0e976b8729f";
const ONESIGNAL_NATIVE_API_KEY =
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
      shopId,
      ownerUserIds,
      customerName,
      serviceName,
      timeSlot,
      bookingRequestId,
      customerPhone,
    } = body;

    console.log("📱 Trigger foreground service request received:", {
      shopId,
      ownerUserIds: ownerUserIds?.length || 0,
      customerName,
      serviceName,
      timeSlot,
      bookingRequestId,
    });

    if (!shopId || !ownerUserIds || ownerUserIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "shopId and ownerUserIds are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    // Get Supabase client with service role for backend operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // APPROACH 1: Check which owners have granted permission for automatic foreground service
    console.log("🔐 Checking owner permissions for automatic foreground service...");
    const { data: ownerPermissions, error: permError } = await supabase
      .from("native_shop_owners")
      .select("user_id, auto_start_foreground_service")
      .eq("shop_id", shopId)
      .in("user_id", ownerUserIds);

    if (permError) {
      console.error("❌ Error checking permissions:", permError);
      // Continue anyway - we'll notify all owners but only those with permission will auto-start
    }

    // Filter to only owners who have granted permission
    const authorizedOwnerIds = (ownerPermissions || [])
      .filter((owner: any) => owner.auto_start_foreground_service === true)
      .map((owner: any) => owner.user_id);

    console.log(`🔐 Authorized owners with permission: ${authorizedOwnerIds.length} of ${ownerUserIds.length}`);
    console.log(`   Authorized: ${authorizedOwnerIds.join(", ") || "none"}`);
    console.log(`   Unauthorized: ${ownerUserIds.filter((id: string) => !authorizedOwnerIds.includes(id)).join(", ") || "none"}`);

    if (authorizedOwnerIds.length === 0) {
      console.warn("⚠️ No owners have granted permission for automatic foreground service");
      return new Response(
        JSON.stringify({
          success: false,
          message: "No owners have granted permission for automatic foreground service",
          playerIdsCount: 0,
          authorizedCount: 0,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    // PRIMARY: Fetch player IDs for authorized owners from user_devices table
    console.log("🔍 Fetching player IDs for authorized owner users from user_devices:", authorizedOwnerIds);
    const { data: userDevices } = await supabase
      .from("user_devices")
      .select("player_id, user_id")
      .in("user_id", authorizedOwnerIds)
      .not("player_id", "is", null);

    // FALLBACK: Also check native_devices table
    const { data: nativeDevicesFallback } = await supabase
      .from("native_devices")
      .select("player_id, user_id")
      .in("user_id", authorizedOwnerIds)
      .not("player_id", "is", null);

    // Combine and deduplicate
    const allDevices = [...(userDevices || []), ...(nativeDevicesFallback || [])];
    
    const playerIds = [...new Set(
      allDevices
        .map((d: any) => d.player_id)
        .filter((id): id is string => id !== null && id !== undefined && id !== "" && id !== "null")
    )];

    console.log(`📱 Found ${playerIds.length} unique native device(s) for authorized owner(s)`);
    console.log(`   (${userDevices?.length || 0} from user_devices, ${nativeDevicesFallback?.length || 0} from native_devices)`);

    if (playerIds.length === 0) {
      console.warn("⚠️ No native devices found for authorized owner users - foreground service cannot be triggered");
      return new Response(
        JSON.stringify({
          success: false,
          message: "No native devices found for authorized owner users",
          playerIdsCount: 0,
          authorizedCount: authorizedOwnerIds.length,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    // Send notification to owner's device with foreground service trigger
    const payload: Record<string, unknown> = {
      app_id: ONESIGNAL_APP_ID,
      headings: { en: `🔔 New Booking - ${customerName}` },
      contents: { en: `${serviceName} at ${timeSlot}` },
      include_player_ids: playerIds,
      // Android: Heads-up notification settings
      android_importance: 5, // HIGH - Shows as heads-up notification
      android_priority: 10, // For older Android versions
      android_small_icon: "scissors",
      // iOS: High priority for immediate delivery
      ios_badged: true,
      ios_sound: "default",
      // Data payload to trigger foreground service on owner's device
      data: {
        type: "new_order", // Triggers OrderNotificationExtension in Kotlin
        action: "start_service_for_booking",
        order_id: bookingRequestId || "",
        customer_name: customerName || "",
        amount: "0", // Default if not provided
        quantity: "1",
        delivery_type: "pickup",
        triggerType: "booking_request",
      },
    };

    console.log("📡 Sending foreground service trigger to OneSignal:", JSON.stringify(payload, null, 2));

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
          error: "Failed to send foreground service trigger",
          details: responseText,
        }),
        { status: response.status, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    console.log("✅ Foreground service trigger sent successfully");
    return new Response(
      JSON.stringify({
        success: true,
        message: "Foreground service trigger sent successfully",
        playerIdsCount: playerIds.length,
        authorizedCount: authorizedOwnerIds.length,
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
