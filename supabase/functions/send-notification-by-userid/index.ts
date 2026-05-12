import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Firebase FCM Service Account Loading ─────────────────────────────────────
let FCM_SERVICE_ACCOUNT: any = null;
let FCM_PROJECT_ID = "barber-app-6993a";

async function loadFcmServiceAccount() {
  if (FCM_SERVICE_ACCOUNT) return FCM_SERVICE_ACCOUNT;
  try {
    const HARDCODED_B64 = "ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIsCiAgInByb2plY3RfaWQiOiAiYmFyYmVyLWFwcC02OTkzYSIsCiAgInByaXZhdGVfa2V5X2lkIjogIjlmYzg3MDI3NjAyOGE4ZjE3NzRkMGJiNGI3MDA0MWVhNmI3NjJiMzkiLAogICJwcml2YXRlX2tleSI6ICItLS0tLUJFR0lOIFBSSVZBVEUgS0VZLS0tLS1cbk1JSUV2UUlCQURBTkJna3Foa2lHOXcwQkFRRUZBQVNDQktjd2dnU2pBZ0VBQW9JQkFRQ3BhMkJueXhqekx1elhcbnN5SElUM1hVejc0UkpvVkRjNmhYc3UvZWFuUHBYdERoSUV6Y0FiVjNtSTVpWk4zYkJaTndyeG54SEVlc3A1THBcbmxpZnFmU2xyY0RYZkZKVmt2K2cvVGx2ZlVIZ2lMZjN4MDV2Y0JxYmNLNmJSZjZmdENhU0FFSGZTQUJvQzJGZGRcbkhiUUpuTi9iRktNMmw3b3pKZHM4SzNxMXN5bk8rc0s3OCt4emNtMnhYMUpzdHRHT092MkxIN3kwNkdjS0hLWUNcbmU5UkF2Z3NhR09YZDRzMHJxNGdmZ1ZrN2k5RnJVd0RIeHYzRFNQM1VCR28yQ1FLR21EVElSNUpZMkluQU1yMS9cbmQzL1dheFozVjVDS3lGdXNmSmtMOFBvOThrTlJwdHBzRHU3TVJpb3VpY2dSOHBOREtRTHgyL2FSbGd6NGJhMFRcbkZ3V2NWN3B4QWdNQkFBRUNnZ0VBRXJTc1hFbHNZODFXa1NwU0hJL0pic25STG91V1F6Qk44Z0Ryd3g3MTFWcUdcbnJaU25aOU00ZWcvNkNKc2ljOEJWMnljNk1nanhVUHJmbWJMZWpXRnNaVlJxWGtzamc1QTgwR0NTZkVHaVFnUFpcbitnMW5OQS8zOUc5TlordzBXbE9xT2dtWGNUUlpxdDdBSnFQVThRckZIS2RXcmZ4cXJxTUxaY1ZYTXlDcENSVXdcbnlyVm1YS1R5OEdTSEZFZFZqdFZ6dE12LzV5L2NXZU9OUHJsdGRaRENHN0VSdHlZb1JtR0dVR0VqUURlbVlyd0FcbjFGRHN2MUs3VndRaEFab2Y2U0ZGYkwwU0RzWktSeWc0YlhTdHkzSVNrQ2crVXgrVHE5emxiVnorYi84cVhTR0FcbmJIUlg4Ui90dWprTldFc1IrRDE2VTMxRlV4MEE0eEhPVkJIWm9WaGR3UUtCZ1FEWmxkZ3RTaWsyY3NRNzlQVUNcbjd3K1RzVERVMFZRMTAxM3grU1ZpeUFHL0U5NjdVQUJBYlpkMnhBSzRHalUveXRKSHJ0bndFVFNaOGxKeGtkTExcbkNKTlF5TWpWbDZOMDZURXBYUWwrenc0Z3FFczBMSVJYSS9ad1k1ZlZuZmhrOXpvaTV3bnp2NWlVQ2l3SzUwNU5cbk1od1NWbjdDb2F2b2lOK3ZRNG9wbC92aUxRS0JnUURIVkpiVG04dTFBT3llYjFLQytlcGVUeDRsbmo2NzFoZ0hcbmwxTG1IWVdLMTBZQThQTWdtek8rRkZVSmhTVVdrUDVERUJjTHRLVTArbnFqWTIzSFRDb0V3aUdGa2NtaWNlQldcblgvTU41dllDQ3FzTmJPcDdTSzVOcDQ0VG02eUVuMWpaampEV0QrLy9XbE9RcnZGMTdFYTZnNXFYYUl0VDF6Q0tcbjFhRUpNRXlYMVFLQmdRQ051cVpxc2REd2o0YzFTdFZCeVBpTGlySzFIWGxONmxWYVphQ3RuSHhPdTZHc3YycTZcbmpPaEpTMW8rRTR3MTltWk1uUitHMlo0NjNQWkkxZVRKcmRkUG1zbi9IMXd3cmlrQXVZS1M0RXBpaVYwYktoZzJcbkxzMjYzWlNzWjg3Qjdhd255ZmpZbGlmTDNtaGIzZGxLUFdhOXB5dkFtZERCa2s2cCtrT0gzbUVMTFFLQmdBK1pcbmppaEhkQnpaVXF0Zm1QeUpKSTkyNzZ3UUEyYmQ3WW1DalVsWEhDRnVrWnIzUUgvWHhhZmxuWFllUm5YS3FTdUVcbmNkbEhyUHBGZEIyZlpYTUlnZTFYYUJvMCs2dkw3N3V5ektuVTNvSHdaY3lxTG51eGgzcXFWMU12aHNQbVdLVEdcbkhRcFR1dnVvRFF3d3ROTCt4OVpIQUcxREVFeGlkZmtYbVAvSUdPWjFBb0dBR1dkVU81dnR5N2pzQ0NOeVMxZFRcbnhUR1BERmFPOU9CbUk2RVVGTFREOTl0cW91YUZML0s4ZVU4Sks4ZGE2ZFF3YzR4clJudE9iRzRNV1hJUnR1eUdcbmpBWVE5dmx5VnMrdjV5WFdsUWE1WDI3ZHN4cmdEWUU2OFE2bmFIdm5WL2NWemRZR0kvSUNzMWs1K1FoMHJwTm5cbmgycSttNTBJZUZMYlcvS0V1WWhmNGtNPVxuLS0tLS1FTkQgUFJJVkFURSBLRVktLS0tLVxuIiwKICAiY2xpZW50X2VtYWlsIjogImZpcmViYXNlLWFkbWluc2RrLWZic3ZjQGJhcmJlci1hcHAtNjk5M2EuaWFtLmdzZXJ2aWNlYWNjb3VudC5jb20iLAogICJjbGllbnRfaWQiOiAiMTA5MzQ3NTc1NDY3MjM5Nzg5NDgyIiwKICAiYXV0aF91cmkiOiAiaHR0cHM6Ly9hY2NvdW50cy5nb29nbGUuY29t28vb2F1dGgyL2F1dGgiLAogICJ0b2tlbl91cmkiOiAiaHR0cHM6Ly9vYXV0aDIuZ29vZ2xlYXBpcy5jb20vdG9rZW4iLAogICJhdXRoX3Byb3ZpZGVyX3g1MDlfY2VydF91cmwiOiAiaHR0cHM6Ly93d3cuZ29vZ2xlYXBpcy5jb20vb2F1dGgyL3YxL2NlcnRzIiwKICAiY2xpZW50X3g1MDlfY2VydF91cmwiOiAiaHR0cHM6Ly93d3cuZ29vZ2xlYXBpcy5jb20vcm9ib3QvdjEvbWV0YWRhdGEveDUwOS9maXJlYmFzZS1hZG1pbnNkay1mYnN2YyU0MGJhcmJlci1hcHAtNjk5M2EuaWFtLmdzZXJ2aWNlYWNjb3VudC5jb20iLAogICJ1bml2ZXJzZV9kb21haW4iOiAiZ29vZ2xlYXBpcy5jb20iCn0K";

    const b64 = HARDCODED_B64 || Deno.env.get("FCM_SERVICE_ACCOUNT_B64");
    if (b64) {
      FCM_SERVICE_ACCOUNT = JSON.parse(atob(b64));
      FCM_PROJECT_ID = FCM_SERVICE_ACCOUNT.project_id || FCM_PROJECT_ID;
      console.log("✅ Successfully loaded FCM service account.");
      return FCM_SERVICE_ACCOUNT;
    }
    throw new Error("Could not load Firebase Service Account.");
  } catch (e) {
    console.error("❌ Failed to load FCM service account:", e);
    throw e;
  }
}

async function getFcmAccessToken(): Promise<string> {
  const account = await loadFcmServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: account.token_uri,
    iat: now,
    exp: now + 3600,
  };

  const enc = new TextEncoder();
  function base64url(data: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < data.length; i++) binary += String.fromCharCode(data[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  const headerB64 = base64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64url(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const pemKey = account.private_key;
  const pemBody = pemKey.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\n/g, '');
  const binaryKey = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey("pkcs8", binaryKey, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, enc.encode(signingInput));
  const jwt = `${signingInput}.${base64url(new Uint8Array(signature))}`;

  const tokenRes = await fetch(account.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

async function sendFcmNotification(fcmToken: string, title: string, body: string, data: Record<string, string> = {}) {
  try {
    const accessToken = await getFcmAccessToken();
    const FCM_API_URL = `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`;

    const message = {
      message: {
        token: fcmToken,
        notification: { title, body },
        android: {
          priority: "HIGH",
          notification: { sound: "default", channel_id: "default", click_action: "OPEN_ACTIVITY" },
        },
        data,
      },
    };

    const res = await fetch(FCM_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(message),
    });

    return { success: res.ok, status: res.status, response: await res.text() };
  } catch (e) {
    return { success: false, status: 0, response: String(e) };
  }
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://database.donedeals.shop";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("OK", { status: 200, headers: corsHeaders() });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const { user_ids, userIds, title, body: messageBody, data: dataIn } = body;

    const finalUserIds = user_ids || userIds || [];

    if (!finalUserIds || finalUserIds.length === 0) {
      return new Response(JSON.stringify({ error: "user_ids required" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders() } });
    }

    console.log(`📱 Sending FCM notifications to ${finalUserIds.length} users...`);

    // Fetch FCM tokens from native_devices
    const { data: devices } = await supabase
      .from("native_devices")
      .select("fcm_token")
      .in("user_id", finalUserIds)
      .not("fcm_token", "is", null);

    const fcmTokens = [...new Set((devices || []).map((d: any) => d.fcm_token))];

    if (fcmTokens.length === 0) {
      console.warn("⚠️ No FCM tokens found for users");
      return new Response(JSON.stringify({ success: false, error: "No tokens found" }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } });
    }

    const fcmData: Record<string, string> = {};
    if (dataIn) Object.entries(dataIn).forEach(([k, v]) => { fcmData[k] = String(v); });

    console.log(`🔥 Dispatching FCM to ${fcmTokens.length} devices...`);
    const results = await Promise.all(fcmTokens.map(token => sendFcmNotification(token, title, messageBody, fcmData)));

    const successCount = results.filter(r => r.success).length;

    return new Response(JSON.stringify({
      success: successCount > 0,
      successCount,
      totalCount: fcmTokens.length,
      notification_id: "fcm_" + Date.now()
    }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } });

  } catch (error) {
    console.error("❌ Error:", error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders() } });
  }
});
