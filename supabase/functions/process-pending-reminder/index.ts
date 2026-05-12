import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://database.donedeals.shop";
const SUPABASE_SERVICE_KEY = Deno.env.get("SERVICE_ROLE_KEY") || "";

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
    const { bookingId } = await req.json() as { bookingId: string };
    if (!bookingId) {
      return new Response(JSON.stringify({ error: "Missing bookingId" }), { status: 400, headers: corsHeaders() });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Get the reminder
    const { data: reminder, error: fetchError } = await supabase
      .from("alert_reminders")
      .select("*")
      .eq("booking_id", bookingId)
      .single();

    if (fetchError || !reminder) {
      return new Response(JSON.stringify({ error: "Reminder not found" }), { status: 404, headers: corsHeaders() });
    }

    if (reminder.sent) {
      return new Response(JSON.stringify({ success: true, message: "Already sent" }), { status: 200, headers: corsHeaders() });
    }

    // TRIGGER FCM NOTIFICATION (Immediately)
    console.log(`🔔 Sending manual FCM reminder for user ${reminder.user_id}...`);
    
    const notifyUrl = `${SUPABASE_URL}/functions/v1/send-notification-by-userid`;
    const resp = await fetch(notifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        user_ids: [reminder.user_id],
        title: "🔔 Appointment Reminder",
        body: `Are you ready to come to ${reminder.shop_name} for your appointment at ${reminder.time_slot}?`,
        data: {
          bookingId: reminder.booking_id,
          tokenNumber: String(reminder.token_number),
          shopName: reminder.shop_name,
          userName: reminder.user_name,
          timeSlot: reminder.time_slot,
          shopId: reminder.shop_id,
          actionType: "reminder",
        }
      }),
    });

    const respData = await resp.json();
    console.log("✅ Manual FCM reminder sent:", respData);

    // Mark as sent
    await supabase
      .from("alert_reminders")
      .update({ sent: true, sent_at: new Date().toISOString() })
      .eq("id", reminder.id);

    return new Response(JSON.stringify({ success: true, message: "Reminder sent via FCM", details: respData }), { status: 200, headers: corsHeaders() });

  } catch (error) {
    console.error("❌ Error:", error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: corsHeaders() });
  }
});
