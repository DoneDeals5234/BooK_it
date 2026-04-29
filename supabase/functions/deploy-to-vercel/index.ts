import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const VERCEL_API = "https://api.vercel.com"
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const VERCEL_TOKEN = Deno.env.get("VERCEL_AUTH_TOKEN")
    if (!VERCEL_TOKEN) throw new Error("Missing VERCEL_AUTH_TOKEN")

    const { shopId, subdomain, action } = await req.json()

    if (action === "deploy") {
      if (!shopId || !subdomain) throw new Error("Missing shopId or subdomain")

      const supabaseUrl = Deno.env.get("SUPABASE_URL")
      const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")

      const indexHtml = buildIndexHtml(shopId, supabaseUrl, supabaseKey)

      const deploymentData = {
        name: subdomain,
        files: [{ file: "index.html", data: indexHtml }],
        projectSettings: { framework: null }
      }

      const deployResponse = await fetch(`${VERCEL_API}/v13/deployments`, {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${VERCEL_TOKEN}`, 
          "Content-Type": "application/json" 
        },
        body: JSON.stringify(deploymentData)
      })

      const data = await deployResponse.json()
      return new Response(JSON.stringify({ 
        deployment_id: data.id, 
        url: `https://${subdomain}.vercel.app`,
        status: data.readyState 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: corsHeaders })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})

function buildIndexHtml(shopId: string, supabaseUrl: string, supabaseKey: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Shop Website</title>
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='75' font-size='75'%3E%F0%9F%8F%AA%3C/text%3E%3C/svg%3E">
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"><\/script>
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
            <div class="loading-spinner mb-4"><\/div>
            <p class="text-gray-500 font-medium text-sm">Loading your website...<\/p>
        </div>
        <div id="content" class="hidden pb-10"><\/div>
    </div>

    <script>
        const shopId = "${shopId}";
        const supabaseUrl = "${supabaseUrl}";
        const supabaseKey = "${supabaseKey}";
        
        const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

        async function render() {
            try {
                // Fetch website layout
                const { data: website, error: webErr } = await supabaseClient
                    .from('shop_websites')
                    .select('*')
                    .eq('shop_id', shopId)
                    .single();

                if (webErr) throw webErr;

                // Fetch shop data
                const { data: shop } = await supabaseClient
                    .from('shops')
                    .select('*')
                    .eq('id', shopId)
                    .single();
                
                // Fetch reviews
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
                    } else if (comp.type === 'services' && shop && shop.services) {
                        try {
                            let servicesList = shop.services;
                            if (typeof servicesList === 'string') {
                                servicesList = JSON.parse(servicesList);
                            }
                            if (Array.isArray(servicesList) && servicesList.length > 0) {
                                const sDiv = document.createElement('div');
                                sDiv.className = 'rounded-2xl border p-4';
                                sDiv.style.backgroundColor = comp.styles.backgroundColor || '#ffffff';
                                sDiv.innerHTML = '<h4 class="font-bold mb-4 text-xl">Services<\/h4>';
                                servicesList.slice(0, 5).forEach(s => {
                                    const html = '<div class="flex justify-between py-2 border-b last:border-0 text-sm"><span>' + (s.name || '') + '<\/span><span class="font-bold">' + (s.price || '') + '<\/span><\/div>';
                                    sDiv.innerHTML += html;
                                });
                                div.appendChild(sDiv);
                            }
                        } catch (e) {
                            console.error('Error rendering services:', e);
                        }
                    } else if (comp.type === 'reviews' && reviews && Array.isArray(reviews) && reviews.length > 0) {
                        const rDiv = document.createElement('div');
                        rDiv.innerHTML = '<h4 class="font-bold text-xl mb-4">Reviews<\/h4>';
                        reviews.slice(0, 3).forEach(r => {
                            const userName = r.user_name || r.userName || 'Anonymous';
                            const reviewText = r.review_text || r.reviewText || '';
                            const rating = r.rating || 0;
                            const stars = Array(Math.floor(rating)).fill('★').join('');
                            const html = '<div class="bg-gray-50 p-4 rounded-xl border mb-3 text-left"><div class="flex justify-between font-bold text-sm mb-1"><span>' + userName + '<\/span><span>' + stars + '<\/span><\/div><p class="text-sm italic">"' + reviewText + '"<\/p><\/div>';
                            rDiv.innerHTML += html;
                        });
                        div.appendChild(rDiv);
                    }
                    container.appendChild(div);
                });

                document.getElementById('loading').style.display = 'none';
                container.classList.remove('hidden');

            } catch (err) {
                console.error('Render Error:', err);
                document.getElementById('loading').innerHTML = '<p class="text-red-500">Error loading website<\/p>';
            }
        }
        
        render();
    <\/script>
</body>
</html>`;
}
