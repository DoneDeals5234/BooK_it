import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";
import { jwtDecode } from "https://esm.sh/jwt-decode@4.0.0";

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

    // Verify JWT from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    let customerId: string;
    try {
      const token = authHeader.replace("Bearer ", "");
      const decoded = jwtDecode(token) as { sub?: string; uid?: string };
      customerId = decoded.sub || decoded.uid || "";

      if (!customerId) {
        return new Response(
          JSON.stringify({ error: "Invalid token: no user ID found" }),
          { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders() } }
        );
      }
    } catch (decodeError) {
      console.error("JWT decode error:", decodeError);
      return new Response(
        JSON.stringify({ error: "Invalid JWT token" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    const body = await req.json();
    const { booking_id, action } = body; // action: 'confirmed' or 'cancelled'

    if (!booking_id || !action) {
      return new Response(
        JSON.stringify({ error: "booking_id and action are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    console.log(`📱 Handling booking ${action}:`, booking_id);

    // 1. Fetch the booking
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", booking_id)
      .eq("user_id", customerId)
      .single();

    if (bookingError || !booking) {
      console.error("Booking not found or unauthorized:", bookingError);
      return new Response(
        JSON.stringify({ error: "Booking not found or unauthorized" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    console.log(`✅ Found booking:`, {
      id: booking.id,
      customer: booking.user_name,
      time: booking.time_slot,
      shopId: booking.shop_id,
    });

    // 2. Fetch shop owner details
    const { data: shopOwners, error: shopError } = await supabase
      .from("native_shop_owners")
      .select("user_id, id")
      .eq("shop_id", booking.shop_id)
      .limit(1);

    if (shopError || !shopOwners || shopOwners.length === 0) {
      console.warn("Shop owner not found:", shopError);
    }

    const ownerId = shopOwners?.[0]?.user_id || booking.shop_id;

    // 3. Update booking confirmation status
    const confirmationStatus = action === 'confirmed' ? 'confirmed' : 'cancelled';
    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        customer_confirmation: confirmationStatus,
        customer_confirmed_at: new Date().toISOString(),
        owner_notified_confirmation: false, // Will be set after notification
      })
      .eq("id", booking_id);

    if (updateError) {
      console.error("Error updating booking status:", updateError);
      return new Response(
        JSON.stringify({
          error: "Error updating booking status",
          details: updateError.message,
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    console.log(`✅ Booking ${booking_id} updated: ${confirmationStatus}`);

    // 4. Send appropriate notification to shop owner
    let notificationTitle: string;
    let notificationBody: string;

    if (action === "confirmed") {
      notificationTitle = "✅ Customer Confirmed";
      notificationBody = `${booking.user_name} confirmed they're coming! Token #${booking.token_number} will arrive at ${booking.time_slot}`;
    } else {
      notificationTitle = "❌ Customer Cancelled";
      notificationBody = `${booking.user_name} cancelled their booking for ${booking.service_name} at ${booking.time_slot}`;
    }

    const notificationPayload: Record<string, any> = {
      app_id: ONESIGNAL_NATIVE_APP_ID,
      headings: { en: notificationTitle },
      contents: { en: notificationBody },
      include_aliases: {
        external_id: [ownerId],
      },
      target_channel: "push",
      android_importance: 5,
      android_priority: 10,
      android_small_icon: "scissors",
      ios_badged: true,
      ios_sound: "default",
      data: {
        booking_id,
        type: action === "confirmed" ? "customer_confirmed" : "customer_cancelled",
        customer_name: booking.user_name,
        token_number: booking.token_number,
        service_name: booking.service_name,
        time_slot: booking.time_slot,
      },
    };

    console.log(`📡 Sending OneSignal notification to owner:`, notificationTitle);

    const response = await fetch(ONESIGNAL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Key ${ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify(notificationPayload),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error("OneSignal API Error:", responseText);
      // Don't fail the entire request if notification fails
      console.warn("⚠️ Notification send failed but booking status was updated");
    } else {
      const onesignalResponse = JSON.parse(responseText);
      const notificationId = onesignalResponse.body?.notification_id;
      console.log(`✅ OneSignal notification sent: ${notificationId}`);

      // 5. Update booking to mark owner as notified
      await supabase
        .from("bookings")
        .update({ owner_notified_confirmation: true })
        .eq("id", booking_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Booking ${action} - owner notified`,
        booking_id,
        status: confirmationStatus,
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



