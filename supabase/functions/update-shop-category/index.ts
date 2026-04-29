import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface UpdateCategoryRequest {
  shopId: string;
  newCategory: string;
}

// Valid shop categories
const VALID_CATEGORIES = [
  "salon",
  "parlour",
  "restaurant",
  "gym",
  "clinic",
  "shoes",
  "clothes",
  "cosmetics",
  "groceries",
  "stationery",
];

Deno.serve(async (req) => {
  // CORS headers
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, PUT",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const body: UpdateCategoryRequest = await req.json();

    // Validate required fields
    if (!body.shopId?.trim()) {
      return new Response(
        JSON.stringify({ error: "Shop ID is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!body.newCategory?.trim()) {
      return new Response(
        JSON.stringify({ error: "New category is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate category is in allowed list
    if (!VALID_CATEGORIES.includes(body.newCategory.toLowerCase())) {
      return new Response(
        JSON.stringify({
          error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if shop exists
    const { data: shop } = await supabase
      .from("shops")
      .select("id, category")
      .eq("id", body.shopId)
      .single();

    if (!shop) {
      return new Response(
        JSON.stringify({ error: "Shop not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Update shop category
    const { error: updateError } = await supabase
      .from("shops")
      .update({
        category: body.newCategory.toLowerCase(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.shopId);

    if (updateError) {
      console.error("Error updating shop category:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update shop category" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        shopId: body.shopId,
        newCategory: body.newCategory.toLowerCase(),
        previousCategory: shop.category,
        message: "Shop category updated successfully",
      }),
      {
        status: 200,
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
