import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://database.donedeals.shop";

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
    const { targetPlatform = "both", isNative, ...notificationPayload } = body;

    console.log("🚀 Routing notification:", {
      targetPlatform,
      isNative,
      title: notificationPayload.title,
      recipientType: notificationPayload.userIds ? "specific_users" : "player_ids",
    });

    // Determine which platform(s) to send to
    let sendToWeb = targetPlatform === "both" || targetPlatform === "web";
    let sendToNative = targetPlatform === "both" || targetPlatform === "native";

    const results: any = {};

    // Send to web devices
    if (sendToWeb && notificationPayload.playerIds?.length) {
      console.log("📧 Sending to web devices...");
      const webPayload = {
        ...notificationPayload,
        title: notificationPayload.title,
        body: notificationPayload.body || notificationPayload.messageBody,
        include_player_ids: notificationPayload.playerIds,
      };

      try {
        const webResponse = await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(webPayload),
        });

        const webResult = await webResponse.json();
        results.web = { success: webResponse.ok, ...webResult };
        console.log("📧 Web notification result:", results.web);
      } catch (error) {
        console.error("❌ Error sending web notification:", error);
        results.web = { success: false, error: String(error) };
      }
    }

    // Send to native devices
    if (sendToNative && (notificationPayload.nativePlayerIds?.length || notificationPayload.userIds?.length)) {
      console.log("📱 Sending to native devices...");
      const nativePayload = {
        title: notificationPayload.title,
        body: notificationPayload.body || notificationPayload.messageBody,
        data: notificationPayload.data,
        image: notificationPayload.image,
        big_picture: notificationPayload.big_picture,
        actionButtons: notificationPayload.actionButtons,
        currentUserPlayerId: notificationPayload.currentUserPlayerId,
        excludeCurrentUser: notificationPayload.excludeCurrentUser,
      };

      if (notificationPayload.nativePlayerIds?.length) {
        nativePayload.include_player_ids = notificationPayload.nativePlayerIds;
      }
      if (notificationPayload.userIds?.length) {
        nativePayload.userIds = notificationPayload.userIds;
      }

      try {
        const nativeResponse = await fetch(`${SUPABASE_URL}/functions/v1/send-native-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(nativePayload),
        });

        const nativeResult = await nativeResponse.json();
        results.native = { success: nativeResponse.ok, ...nativeResult };
        console.log("📱 Native notification result:", results.native);
      } catch (error) {
        console.error("❌ Error sending native notification:", error);
        results.native = { success: false, error: String(error) };
      }
    }

    // Check if at least one platform succeeded
    const succeeded = Object.values(results).some((r: any) => r.success);

    if (succeeded) {
      console.log("✅ Notification routing completed successfully");
      return new Response(JSON.stringify({ success: true, results }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    } else {
      console.error("❌ All notification routes failed:", results);
      return new Response(JSON.stringify({ success: false, error: "All notification routes failed", results }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }
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
