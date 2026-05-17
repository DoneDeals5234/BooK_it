import { supabase } from '@/lib/supabase';

export interface WebsiteComponent {
  id: string;
  type: 'text' | 'image' | 'button' | 'divider' | 'gallery' | 'services' | 'reviews' | 'products' | 'navbar';
  content: any; // string (text/url) or array (gallery)
  styles: {
    fontSize?: number;
    color?: string;
    backgroundColor?: string;
    padding?: number;
    alignment?: 'left' | 'center' | 'right';
    width?: string;
    height?: string;
    borderRadius?: number;
    fontWeight?: 'normal' | 'bold' | 'bolder';
    fontFamily?: string;
  };
  position: {
    x: number;
    y: number;
    order: number; // for vertical stacking
  };
  linkTo?: string; // Page ID or external URL
}

export interface ShopWebsite {
  id: string;
  shop_id: string;
  shop_name: string; // slug format: "john-barber-shop"
  layout_json: {
    components: WebsiteComponent[];
    theme?: {
      primaryColor?: string;
      fontFamily?: string;
    };
  };
  is_published: boolean;
  published_at?: string;
  views_count: number;
  custom_domain?: string;
  vercel_deployment_id?: string;
  vercel_url?: string;
  custom_subdomain?: string;
  created_at?: string;
  updated_at?: string;
}

export const updateVercelDetails = async (
  shopId: string,
  details: { deployment_id: string; url: string; subdomain: string }
) => {
  const { data, error } = await supabase
    .from('shop_websites')
    .update({
      vercel_deployment_id: details.deployment_id,
      vercel_url: details.url,
      custom_subdomain: details.subdomain,
      updated_at: new Date().toISOString(),
    })
    .eq('shop_id', shopId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const saveWebsiteDraft = async (shopId: string, shopName: string, layout: any) => {
  const slug = shopName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  console.log('💾 Saving website draft:', { shopId, slug });

  // Ensure layout is an object, not a string
  const layoutData = typeof layout === 'string' ? JSON.parse(layout) : layout;

  const { data, error } = await supabase
    .from('shop_websites')
    .upsert({
      shop_id: shopId,
      shop_name: slug,
      layout_json: layoutData,
      is_published: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'shop_id' })
    .select()
    .single();

  if (error) {
    console.error('❌ Save draft error:', error);
    throw new Error(`Failed to save draft: ${error.message} (${error.code})`);
  }

  console.log('✅ Draft saved successfully:', data);
  return data;
};

export const publishWebsite = async (shopId: string, shopName: string, layout: any, customDomain?: string) => {
  const slug = shopName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  console.log('🚀 Publishing website:', { shopId, slug, customDomain });

  // Ensure layout is an object, not a string
  const layoutData = typeof layout === 'string' ? JSON.parse(layout) : layout;

  const { data, error } = await supabase
    .from('shop_websites')
    .upsert({
      shop_id: shopId,
      shop_name: slug,
      layout_json: layoutData,
      custom_domain: customDomain || null,
      is_published: true,
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'shop_id' })
    .select()
    .single();

  if (error) {
    console.error('❌ Publish error:', error);
    throw new Error(`Failed to publish website: ${error.message} (${error.code})`);
  }

  console.log('✅ Website published successfully:', data);
  return data;
};

export const getWebsiteByShopId = async (shopId: string) => {
  const { data, error } = await supabase
    .from('shop_websites')
    .select('*')
    .eq('shop_id', shopId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw error;

  if (data && data.layout_json && typeof data.layout_json === 'string') {
    try {
      data.layout_json = JSON.parse(data.layout_json);
    } catch (parseErr) {
      console.warn('⚠️ Could not parse layout_json:', parseErr);
    }
  }

  return data;
};

export const getWebsiteBySlug = async (slug: string) => {
  console.log('🔍 Fetching website for slug:', slug);

  const { data, error } = await supabase
    .from('shop_websites')
    .select('*')
    .eq('shop_name', slug)
    .eq('is_published', true)
    .maybeSingle();

  if (error) {
    console.error('❌ Supabase error fetching website:', error);
    if (error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch website: ${error.message}`);
    }
  } else if (data) {
    console.log('✅ Website data fetched:', data);

    // Ensure layout_json is parsed if it's a string
    if (data.layout_json && typeof data.layout_json === 'string') {
      try {
        data.layout_json = JSON.parse(data.layout_json);
        console.log('✅ Parsed layout_json from string');
      } catch (parseErr) {
        console.warn('⚠️ Could not parse layout_json:', parseErr);
      }
    }
  }

  return data || null;
};

export const getWebsiteBySubdomainOrDomain = async (subdomainOrDomain: string) => {
  console.log('🔍 Fetching website for subdomain or domain:', subdomainOrDomain);

  let query = supabase.from('shop_websites').select('*').eq('is_published', true);

  if (subdomainOrDomain.startsWith('custom:')) {
    const domain = subdomainOrDomain.replace('custom:', '');
    query = query.eq('custom_domain', domain);
  } else {
    const { data, error } = await supabase
      .from('shop_websites')
      .select('*')
      .eq('is_published', true)
      .or(`custom_subdomain.eq."${subdomainOrDomain}",shop_name.eq."${subdomainOrDomain}"`)
      .maybeSingle();

    if (error) {
      console.error('❌ Error fetching website by subdomain:', error);
      throw error;
    }

    if (data && data.layout_json && typeof data.layout_json === 'string') {
      try {
        data.layout_json = JSON.parse(data.layout_json);
      } catch (e) {
        console.warn('⚠️ Could not parse layout_json:', e);
      }
    }
    return data || null;
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    console.error('❌ Error fetching website by custom domain:', error);
    throw error;
  }

  if (data && data.layout_json && typeof data.layout_json === 'string') {
    try {
      data.layout_json = JSON.parse(data.layout_json);
    } catch (e) {
      console.warn('⚠️ Could not parse layout_json:', e);
    }
  }
  return data || null;
};

export const incrementViews = async (websiteId: string) => {
  const { error } = await supabase.rpc('increment_website_views', { website_id: websiteId });
  if (error) {
    // If RPC doesn't exist yet, we'll do a simple update
    const { data: website } = await supabase
      .from('shop_websites')
      .select('views_count')
      .eq('id', websiteId)
      .single();
    
    if (website) {
      await supabase
        .from('shop_websites')
        .update({ views_count: website.views_count + 1 })
        .eq('id', websiteId);
    }
  }
};
