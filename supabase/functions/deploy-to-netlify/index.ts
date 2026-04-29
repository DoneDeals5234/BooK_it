// supabase/functions/deploy-to-netlify/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import JSZip from 'https://esm.sh/jszip@3.10.1'

const NETLIFY_API = "https://api.netlify.com/api/v1"
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const NETLIFY_TOKEN = Deno.env.get("NETLIFY_AUTH_TOKEN")
    if (!NETLIFY_TOKEN) throw new Error("Missing NETLIFY_AUTH_TOKEN")

    const { shopId, subdomain, action, siteId } = await req.json()

    // --- ACTION: CREATE SITE ---
    if (action === "create-site") {
      const response = await fetch(`${NETLIFY_API}/sites`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${NETLIFY_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: subdomain })
      })
      const data = await response.json()
      if (response.status === 422) return new Response(JSON.stringify({ error: "Name taken" }), { status: 422, headers: corsHeaders })
      return new Response(JSON.stringify({ site_id: data.id, url: data.ssl_url || data.url }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    // --- ACTION: DEPLOY CONTENT ---
    if (action === "deploy") {
      if (!siteId || !shopId) throw new Error("Missing siteId or shopId")

      const zip = new JSZip();
      
      const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Shop Website</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='75' font-size='75'>🏪</text></svg>">
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@3.3.5/tailwind.min.css" rel="stylesheet">
    <style>
        body { margin: 0; font-family: sans-serif; }
        .component-container { padding: 0 16px; }
        .loading-spinner { border: 4px solid #f3f3f3; border-top: 4px solid #ef4444; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
</head>
<body class="bg-gray-50">
    <div id="root" class="max-w-md mx-auto bg-white min-h-screen shadow-sm">
        <div id="loading" class="flex flex-col items-center justify-center min-h-screen">
            <div class="loading-spinner mb-4"></div>
            <p class="text-gray-500 font-medium text-sm">Loading your website...</p>
        </div>
        <div id="content" class="hidden pb-10"></div>
    </div>

    <script>
        const shopId = "${shopId}";
        const supabaseUrl = "${Deno.env.get("SUPABASE_URL")}";
        const supabaseKey = "${Deno.env.get("SUPABASE_ANON_KEY")}";
        
        // Use the global 'supabase' object from the CDN script
        const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

        async function render() {
            try {
                // 1. Fetch Website Data
                const { data: website, error: webErr } = await supabaseClient
                    .from('shop_websites')
                    .select('*')
                    .eq('shop_id', shopId)
                    .single();

                if (webErr) throw webErr;

                // 2. Fetch Extra Shop Data
                const { data: shop, error: shopErr } = await supabaseClient
                    .from('shops')
                    .select('*')
                    .eq('id', shopId)
                    .single();

                // 3. Fetch Reviews
                const { data: reviews } = await supabaseClient
                    .from('reviews')
                    .select('*')
                    .eq('shop_id', shopId);

                const layout = typeof website.layout_json === 'string' ? JSON.parse(website.layout_json) : website.layout_json;
                const components = layout.components || [];
                const container = document.getElementById('content');

                components.forEach(comp => {
                    const div = document.createElement('div');
                    div.className = 'component-container';
                    div.style.textAlign = comp.styles.alignment || 'left';
                    div.style.paddingTop = (comp.styles.padding || 0) + 'px';
                    div.style.paddingBottom = (comp.styles.padding || 0) + 'px';

                    if (comp.type === 'text') {
                        const el = document.createElement('div');
                        el.textContent = comp.content;
                        el.style.fontSize = (comp.styles.fontSize || 16) + 'px';
                        el.style.color = comp.styles.color || '#000000';
                        el.style.fontWeight = comp.styles.fontWeight || 'normal';
                        el.style.fontFamily = comp.styles.fontFamily || 'inherit';
                        div.appendChild(el);
                    } else if (comp.type === 'image') {
                        const img = document.createElement('img');
                        img.src = comp.content;
                        img.className = 'max-w-full mx-auto';
                        img.style.borderRadius = (comp.styles.borderRadius || 0) + 'px';
                        img.style.width = comp.styles.width || '100%';
                        div.appendChild(img);
                    } else if (comp.type === 'button') {
                        const btn = document.createElement('button');
                        btn.textContent = comp.content;
                        btn.className = 'px-6 py-2 font-medium transition-transform active:scale-95';
                        btn.style.backgroundColor = comp.styles.backgroundColor || '#ef4444';
                        btn.style.color = comp.styles.color || '#ffffff';
                        btn.style.borderRadius = (comp.styles.borderRadius || 0) + 'px';
                        btn.onclick = () => alert('Booking coming soon!');
                        div.appendChild(btn);
                    } else if (comp.type === 'divider') {
                        const hr = document.createElement('div');
                        hr.style.height = (comp.styles.height || '1') + 'px';
                        hr.style.backgroundColor = comp.styles.backgroundColor || '#e2e8f0';
                        div.appendChild(hr);
                    } else if (comp.type === 'services' && shop) {
                        const services = typeof shop.services === 'string' ? JSON.parse(shop.services) : shop.services;
                        if (Array.isArray(services)) {
                            const sDiv = document.createElement('div');
                            sDiv.className = 'rounded-2xl border p-4';
                            sDiv.style.backgroundColor = comp.styles.backgroundColor || '#ffffff';
                            sDiv.innerHTML = '<h4 class="font-bold mb-4 text-xl">Prices</h4>';
                            services.slice(0, 5).forEach(s => {
                                sDiv.innerHTML += \`<div class="flex justify-between py-2 border-b last:border-0 text-sm"><span>\${s.name}</span><span class="font-bold">\${s.price}</span></div>\`;
                            });
                            div.appendChild(sDiv);
                        }
                    } else if (comp.type === 'reviews' && reviews) {
                        const rDiv = document.createElement('div');
                        rDiv.innerHTML = '<h4 class="font-bold text-xl mb-4">Reviews</h4>';
                        reviews.slice(0, 3).forEach(r => {
                            rDiv.innerHTML += \`<div class="bg-gray-50 p-4 rounded-xl border mb-3 text-left"><div class="flex justify-between font-bold text-sm mb-1"><span>\${r.userName}</span><span>\${'★'.repeat(r.rating)}</span></div><p class="text-sm italic">"\${r.reviewText}"</p></div>\`;
                        });
                        div.appendChild(rDiv);
                    }
                    container.appendChild(div);
                });

                document.getElementById('loading').style.display = 'none';
                container.classList.remove('hidden');

            } catch (err) {
                console.error(err);
                document.getElementById('loading').innerHTML = '<p class="text-red-500">Error loading website</p>';
            }
        }
        render();
    </script>
</body>
</html>`;

      // Force text/html MIME type with Netlify _headers file
      const headersContent = `/*\n  Content-Type: text/html; charset=UTF-8\n  X-Content-Type-Options: nosniff`;
      
      zip.file("index.html", indexHtml);
      zip.file("_headers", headersContent);
      
      const content = await zip.generateAsync({ type: "uint8array" });

      const deployResponse = await fetch(`${NETLIFY_API}/sites/${siteId}/deploys`, {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${NETLIFY_TOKEN}`,
          "Content-Type": "application/zip"
        },
        body: content
      });

      const deployData = await deployResponse.json();
      return new Response(JSON.stringify({ deploy_id: deployData.id, state: deployData.state }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: corsHeaders })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})
