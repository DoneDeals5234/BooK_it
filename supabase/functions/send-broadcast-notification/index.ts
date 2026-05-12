import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Fetch ALL native device tokens
    console.log("🔍 Fetching all native device tokens for broadcast...");
    const { data: devices, error: fetchError } = await supabase
      .from("native_devices")
      .select("fcm_token")
      .not("fcm_token", "is", null);

    if (fetchError) {
      throw fetchError;
    }

    const tokens = [...new Set(devices.map(d => d.fcm_token))];
    console.log(`📊 Found ${tokens.length} unique tokens for broadcast.`);

    if (tokens.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No devices found for broadcast" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    // TRIGGER FCM BROADCAST via send-native-notification internal logic
    // We'll call send-notification for each token (or batch them)
    // For simplicity, we'll call the send-notification function
    
    const notifyUrl = `${SUPABASE_URL}/functions/v1/send-notification`;
    const resp = await fetch(notifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        tokens: tokens,
        title: title,
        messageBody: messageBody,
        data: data || {},
        image: image
      }),
    });

    const respData = await resp.json();
    console.log("✅ Broadcast sent via FCM:", respData);

    return new Response(
      JSON.stringify({ success: true, message: "Broadcast sent successfully via FCM", details: respData }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } }
    );
  } catch (error) {
    console.error("❌ Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders() } }
    );
  }
});
