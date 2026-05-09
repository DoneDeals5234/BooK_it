import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ONESIGNAL_NATIVE_APP_ID =
  Deno.env.get("ONESIGNAL_NATIVE_APP_ID") ||
  "71048c28-503e-49e5-89b1-0de00ccdca4b";
const ONESIGNAL_NATIVE_API_KEY =
  "os_v2_app_oeciykcqhze6lcnrbxqaztokjnzez2oi76me4sv3y3p6gy5eu4kvf5qxzpuuraw25tybywnd3vg443ug2ln3os34jkyqd42llsnfjty";

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

  try {
    const body = await req.json();
    const { title, messageBody, image, data } = body;

    if (!title || !messageBody) {
      return new Response(
        JSON.stringify({ error: "title and messageBody are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    const payload: Record<string, unknown> = {
      app_id: ONESIGNAL_NATIVE_APP_ID,
      headings: { en: title },
      contents: { en: messageBody },
      included_segments: ["All"],
      android_importance: 5,
      android_priority: 10,
      android_small_icon: "scissors",
      ios_badged: true,
      ios_sound: "default",
    };

    if (image) {
      payload.big_picture = image;
      payload.large_icon = image;
    }

    if (data) {
      payload.data = data;
    }

    console.log("📡 Sending BROADCAST payload to OneSignal:", JSON.stringify(payload, null, 2));

    const response = await fetch(ONESIGNAL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Key ${ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error("❌ OneSignal API Error:", responseText);
      return new Response(
        JSON.stringify({ error: "Failed to send broadcast", details: responseText }),
        { status: response.status, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Broadcast sent successfully" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } }
    );
  } catch (error) {
    console.error("❌ Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders() } }
    );
  }
});



