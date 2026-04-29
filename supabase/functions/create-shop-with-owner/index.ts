import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface CreateShopRequest {
  shopName: string;
  category: string;
  planId: string;
  ownerEmail: string;
  ownerPassword: string;
}

// Simple password hashing using Deno's built-in crypto
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}

// Validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate password strength
function isStrongPassword(password: string): boolean {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password)
  );
}

Deno.serve(async (req) => {
  // CORS headers
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const body: CreateShopRequest = await req.json();

    // Validate required fields
    if (!body.shopName?.trim()) {
      return new Response(
        JSON.stringify({ error: "Shop name is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!body.category?.trim()) {
      return new Response(
        JSON.stringify({ error: "Shop category is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!body.planId?.trim()) {
      return new Response(
        JSON.stringify({ error: "Plan selection is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!body.ownerEmail?.trim()) {
      return new Response(
        JSON.stringify({ error: "Owner email is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!body.ownerPassword?.trim()) {
      return new Response(
        JSON.stringify({ error: "Owner password is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate email format
    if (!isValidEmail(body.ownerEmail)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate password strength
    if (!isStrongPassword(body.ownerPassword)) {
      return new Response(
        JSON.stringify({
          error:
            "Password must be at least 8 characters with uppercase, lowercase, and numbers",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if email already exists
    const { data: existingOwner } = await supabase
      .from("shop_owners")
      .select("id")
      .eq("email", body.ownerEmail)
      .single();

    if (existingOwner) {
      return new Response(
        JSON.stringify({ error: "Email is already in use" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Verify plan exists
    const { data: plan } = await supabase
      .from("plans")
      .select("id")
      .eq("id", body.planId)
      .single();

    if (!plan) {
      return new Response(
        JSON.stringify({ error: "Invalid plan selection" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(body.ownerPassword);

    // Create shop
    const { data: shop, error: shopError } = await supabase
      .from("shops")
      .insert({
        name: body.shopName.trim(),
        category: body.category,
        plan_id: body.planId,
        owner_email: body.ownerEmail,
        location: "",
        owner_name: "",
        owner_phone: "",
        about: "",
        shop_image_url: "",
        location_image_url: "",
        location_map_link: "https://maps.google.com",
        password: "", // Keep this for backward compatibility but use shop_owners table
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (shopError || !shop) {
      console.error("Error creating shop:", shopError);
      return new Response(
        JSON.stringify({ error: "Failed to create shop" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create shop owner record
    const { data: owner, error: ownerError } = await supabase
      .from("shop_owners")
      .insert({
        shop_id: shop.id,
        email: body.ownerEmail,
        password_hash: passwordHash,
        verified: false,
      })
      .select("id")
      .single();

    if (ownerError || !owner) {
      console.error("Error creating shop owner:", ownerError);
      // Rollback shop creation
      await supabase.from("shops").delete().eq("id", shop.id);
      return new Response(
        JSON.stringify({ error: "Failed to create shop owner account" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        shopId: shop.id,
        email: body.ownerEmail,
        message: "Shop created successfully. You can now login with your email and password.",
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
