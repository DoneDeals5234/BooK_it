import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

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

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
  }

  try {
    const body = await req.json();
    const { playerId, bookingId, shopName, tokenNumber, userName, timeSlot, shopId, bookingDate, reminderTime, timezoneOffsetHours } = body;

    if (!playerId || !bookingId) {
      return new Response(
        JSON.stringify({ error: "playerId and bookingId are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    // Calculate sendAfterTimestamp
    let sendAfterTimestamp: number = Math.floor(Date.now() / 1000);
    if (bookingDate && reminderTime) {
      try {
        const [year, month, day] = bookingDate.split('-').map(Number);
        const [reminderHour, reminderMinute] = reminderTime.split(':').map(Number);
        const userTimezoneOffsetHours = timezoneOffsetHours || 0;
        const utcDate = new Date(Date.UTC(year, month - 1, day, reminderHour, reminderMinute, 0, 0));
        const offsetMs = userTimezoneOffsetHours * 60 * 60 * 1000;
        sendAfterTimestamp = Math.floor((utcDate.getTime() - offsetMs) / 1000);
      } catch (err) {
        console.warn(`⚠️ Failed to calculate reminder send time:`, err);
      }
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // INSERT INTO alert_reminders TABLE FOR CRON PROCESSING
    console.log(`💾 Saving reminder to alert_reminders table for booking: ${bookingId}`);
    
    // Resolve user_id from player_id if needed
    const { data: userProfile } = await supabase
      .from("user_profiles")
      .select("user_id")
      .eq("player_id", playerId)
      .single();
    
    const targetUserId = userProfile?.user_id || playerId;

    const { data: reminder, error: insertError } = await supabase
      .from("alert_reminders")
      .insert([
        {
          booking_id: bookingId,
          user_id: targetUserId,
          shop_name: shopName,
          token_number: tokenNumber,
          user_name: userName,
          time_slot: timeSlot,
          shop_id: shopId,
          scheduled_for: new Date(sendAfterTimestamp * 1000).toISOString(),
          sent: false
        }
      ])
      .select()
      .single();

    if (insertError) {
      console.error("❌ Failed to save reminder to database:", insertError);
      throw insertError;
    }

    console.log("✅ Reminder saved to database successfully:", reminder.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Reminder scheduled successfully in database",
        reminderId: reminder.id,
        scheduledFor: reminder.scheduled_for
      }),
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
