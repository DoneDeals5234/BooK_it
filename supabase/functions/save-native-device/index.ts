import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://database.donedeals.shop";
// Fallback to the known service role key if environment variable is not set
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UtZGVtbyIsImlhdCI6MTY0MTc2OTIwMCwiZXhwIjoxNzk5NTM1NjAwfQ.Qzqn3LHHNm0gW_QEQtwmhhisO0qLQnDApr9qDJ_rhfY";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
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
    const { userId, email, password, playerId, deviceType = "native" } = body;

    console.log('🚀 [START] save-native-device operation');
    console.log('📦 Input Payload:', JSON.stringify({ userId, email, password: password ? '******' : 'MISSING', playerId, deviceType }));

    if (!userId) {
      console.error('❌ Error: userId is missing in request body');
      return new Response(
        JSON.stringify({ error: "userId is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    // Initialize Supabase client with SERVICE ROLE to bypass RLS
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const results = {
      native_devices: "not_attempted",
      user_devices: "not_attempted",
      user_profiles: "not_attempted"
    };

    // --- 1. SYNC TO native_devices ---
    console.log(`🔍 [1/3] Upserting native_devices for user: ${userId}`);
    try {
      const nativeData: any = {
        user_id: userId,
        email: email || "",
        player_id: playerId || null,
        device_type: deviceType,
        last_active: new Date().toISOString(),
      };

      if (password && password.trim() !== "") {
        console.log("🔐 Including password in native_devices upsert");
        nativeData.password = password;
      }

      const { data, error: err } = await supabase
        .from("native_devices")
        .upsert(nativeData, { onConflict: 'user_id' })
        .select();

      if (err) throw err;
      results.native_devices = "upserted";
      console.log(`✅ native_devices sync: success`);
    } catch (e) {
      console.error(`❌ native_devices sync failed:`, e.message);
      results.native_devices = `error: ${e.message}`;
    }

    // --- 2. SYNC TO user_devices (Unified Table) ---
    console.log(`🔍 [2/3] Upserting user_devices for user: ${userId}`);
    try {
      const userData: any = {
        user_id: userId,
        email: email || "",
        player_id: playerId || null,
        is_available: false,
        updated_at: new Date().toISOString()
      };

      // Only update password if provided and not empty
      if (password && password.trim() !== "") {
        console.log("🔐 Including password in upsert");
        userData.password = password;
      }

      const { data, error: err } = await supabase
        .from("user_devices")
        .upsert(userData, { onConflict: 'user_id' })
        .select();

      if (err) throw err;
      results.user_devices = "upserted";
      console.log(`✅ user_devices sync: success`);
    } catch (e) {
      console.error(`❌ user_devices sync failed:`, e.message);
      results.user_devices = `error: ${e.message}`;
    }

    // --- 3. SYNC TO user_profiles ---
    if (playerId) {
      console.log(`🔍 [3/3] Syncing player_id to user_profiles for user: ${userId}`);
      try {
        const { error: err } = await supabase
          .from("user_profiles")
          .update({ player_id: playerId })
          .eq("user_id", userId);

        if (err) throw err;
        results.user_profiles = "updated";
        console.log("✅ user_profiles sync: updated");
      } catch (e) {
        console.error(`❌ user_profiles sync failed:`, e.message);
        results.user_profiles = `error: ${e.message}`;
      }
    } else {
      console.log("⏭️ Skipping user_profiles sync (no playerId provided)");
      results.user_profiles = "skipped_no_player_id";
    }

    console.log('🏁 [FINISH] save-native-device completed');
    return new Response(
      JSON.stringify({
        success: true,
        message: "Operation completed",
        results
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } }
    );

  } catch (error) {
    console.error("❌ Fatal Error in Edge Function:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders() } }
    );
  }
});
